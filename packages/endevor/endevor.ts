/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Contributors:
 *   Broadcom, Inc. - initial API and implementation
 */

import {
  toVersion2Api,
  fromStageNumber,
  stringifyWithHiddenCredential,
  isError,
  isDefined,
  isChangeRegressionError,
  toSeveralTasksProgress,
  getElementExtension,
} from './utils';

import {
  AddUpdElement,
  ElmSpecDictionary,
  EndevorClient,
  GenerateElmDictionary,
  ListElmDictionary,
  PrintElmCompDictionary,
  QueryAcmDictionary,
  RetrieveElmDictionary,
  SigninElmDictionary,
} from '@broadcom/endevor-for-zowe-cli/lib/api';
import {
  ActionChangeControlValue,
  Dependency,
  Element,
  ElementMapPath,
  ElementSearchLocation,
  ElementWithDependencies,
  ElementWithFingerprint,
  Service,
  ServiceLocation,
  ElementContent,
  ListingContent,
  DomainUpdateParams,
  ServiceInstance,
  SdkUpdateParams,
  OverrideSignOut,
  ElementWithDependenciesWithSignout,
} from './_doc/Endevor';
import {
  Session,
  SessConstants,
  ISession as ClientConfig,
} from '@zowe/imperative';
import { CredentialType } from './_doc/Credential';
import { UnreachableCaseError } from './typeHelpers';
import { parseToType } from '@local/type-parser/parser';
import {
  DependentElement,
  DependentElements,
  Element as ExternalElement,
  SuccessListDependenciesResponse,
  SuccessPrintResponse,
  Repository,
  SuccessListElementsResponse,
  ErrorResponse,
  SuccessRetrieveResponse,
  SuccessListRepositoriesResponse,
  UpdateResponse,
  GenerateResponse,
  SignInResponse,
  AddResponse,
} from './_ext/Endevor';
import { Logger } from '@local/extension/_doc/Logger';
import { ANY_VALUE } from './const';
import { ProgressReporter } from './_doc/Progress';
import { PromisePool } from 'promise-pool-tool';
import {
  getTypedErrorFromEndevorError,
  SignoutError,
  FingerprintMismatchError,
  DuplicateElementError,
} from './_doc/Error';

export const getInstanceNames =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (serviceLocation: ServiceLocation) =>
  async (rejectUnauthorized: boolean): Promise<ReadonlyArray<string>> => {
    const session = toEndevorSession(serviceLocation)(rejectUnauthorized);
    progress.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.listInstances(session);
    } catch (error) {
      logger.trace(`List instances got error: ${error.message}`);
      progress.report({ increment: 100 });
      return [];
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListRepositoriesResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessListRepositoriesResponse, response);
    } catch (e) {
      logger.trace(`Response was not successful because of: ${e.message}`);
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Invalid data format for: ${JSON.stringify(response)}, because of: ${
            e.message
          }`
        );
        progress.report({ increment: 100 });
        return [];
      }
      logger.trace(
        `List instances got response code: ${
          parsedResponse.body.returnCode
        } with reason: ${parsedResponse.body.messages.join('\n').trim()}`
      );
      progress.report({ increment: 100 });
      return [];
    }
    const instances = parsedResponse.body.data
      .map((repository) => {
        try {
          return parseToType(Repository, repository);
        } catch (e) {
          logger.trace(
            `Invalid data format for repository: ${JSON.stringify(
              repository
            )}, it will be skipped: ${e.message}`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((repository) => repository.name);
    progress.report({ increment: 20 });
    return instances;
  };

const toEndevorSession =
  ({ protocol, hostname, port, basePath }: ServiceLocation) =>
  (rejectUnauthorized: boolean): Session => {
    return new Session({
      protocol,
      hostname,
      port,
      basePath: toVersion2Api(basePath),
      rejectUnauthorized,
    });
  };

export const searchForElements =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async ({
    instance,
    environment,
    stageNumber,
    system,
    subsystem,
    type,
    element,
  }: ElementSearchLocation): Promise<ReadonlyArray<Element>> => {
    const session = toSecuredEndevorSession(logger)(service);
    const minimalElementInfo = 'BAS';
    const searchUpInMap = true;
    const firstOccurance = 'FIR';
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: environment || ANY_VALUE,
      'stage-number': fromStageNumber(stageNumber),
      system: system || ANY_VALUE,
      subsystem: subsystem || ANY_VALUE,
      type: type || ANY_VALUE,
      element: element || ANY_VALUE,
      data: minimalElementInfo,
      search: searchUpInMap,
      return: firstOccurance,
    };
    progress.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.listElement(session)(instance)(
        requestArgs
      );
    } catch (error) {
      logger.trace(`List elements got error: ${error.message}`);
      progress.report({ increment: 100 });
      return [];
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListElementsResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessListElementsResponse, response);
    } catch (error) {
      logger.trace(`Response was not successful because of: ${error.message}`);
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Invalid data format for: ${JSON.stringify(response)}, because of: ${
            e.message
          }`
        );
        progress.report({ increment: 100 });
        return [];
      }
      logger.trace(
        `List elements got response code: ${
          parsedResponse.body.returnCode
        } with reason: ${parsedResponse.body.messages.join('\n').trim()}`
      );
      progress.report({ increment: 100 });
      return [];
    }
    const elements = parsedResponse.body.data
      .map((element) => {
        try {
          return parseToType(ExternalElement, element);
        } catch (e) {
          logger.trace(
            `Invalid data format for element: ${JSON.stringify(
              element
            )}, it will be skipped: ${e.message}`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((element) => {
        return {
          environment: element.envName,
          stageNumber: element.stgNum,
          system: element.sysName,
          subSystem: element.sbsName,
          type: element.typeName,
          name: element.elmName,
          extension: getElementExtension(element),
          instance,
        };
      });
    progress.report({ increment: 20 });
    return elements;
  };

const toSecuredEndevorSession =
  (logger: Logger) =>
  ({ location, credential, rejectUnauthorized }: Service): Session => {
    const commonSession: ClientConfig =
      toEndevorSession(location)(rejectUnauthorized).ISession;
    let securedSession: ClientConfig;
    switch (credential.type) {
      case CredentialType.TOKEN:
        securedSession = {
          ...commonSession,
          type: SessConstants.AUTH_TYPE_TOKEN,
          tokenType: credential.tokenType,
          tokenValue: credential.tokenValue,
        };
        break;
      case CredentialType.BASE:
        securedSession = {
          ...commonSession,
          type: SessConstants.AUTH_TYPE_BASIC,
          user: credential.user,
          password: credential.password,
        };
        break;
      default:
        throw new UnreachableCaseError(credential);
    }
    logger.trace(
      `Setup Endevor session: \n${stringifyWithHiddenCredential(
        securedSession
      )}`
    );
    return new Session(securedSession);
  };

export const printElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async ({
    instance,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: Element): Promise<ElementContent | undefined> => {
    const requestParms: ElmSpecDictionary & PrintElmCompDictionary = {
      environment,
      'stage-number': fromStageNumber(stageNumber),
      system,
      subsystem: subSystem,
      type,
      element: name,
    };
    const session = toSecuredEndevorSession(logger)(service);
    progress.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.printElement(session)(instance)(
        requestParms
      );
    } catch (error) {
      logger.trace(`Print element got error: ${error.message}`);
      progress.report({ increment: 100 });
      return;
    }
    let parsedResponse: SuccessPrintResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessPrintResponse, response);
    } catch (e) {
      logger.trace(`Response was not successful because of: ${e.message}`);
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Invalid data format for: ${JSON.stringify(response)}, because of: ${
            e.message
          }`
        );
        progress.report({ increment: 100 });
        return;
      }
      logger.trace(
        `Print element got response code: ${
          parsedResponse.body.returnCode
        } with reason: ${parsedResponse.body.messages.join('\n').trim()}`
      );
      progress.report({ increment: 100 });
      return;
    }
    progress.report({ increment: 50 });
    const [elementContent] = parsedResponse.body.data;
    if (!elementContent) {
      logger.trace(
        `Element ${system}/${subSystem}/${type}/${name} content is not presented`
      );
      progress.report({ increment: 100 });
      return;
    }
    progress.report({ increment: 20 });
    return elementContent;
  };

export const printListing =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async ({
    instance,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: Element): Promise<ListingContent | undefined> => {
    const requestParms: ElmSpecDictionary & PrintElmCompDictionary = {
      environment,
      'stage-number': fromStageNumber(stageNumber),
      system,
      subsystem: subSystem,
      type,
      element: name,
      print: 'LISTING',
    };
    const session = toSecuredEndevorSession(logger)(service);
    progress.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.printElement(session)(instance)(
        requestParms
      );
    } catch (error) {
      logger.trace(`Print listing got error: ${error.message}`);
      progress.report({ increment: 100 });
      return;
    }
    let parsedResponse: SuccessPrintResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessPrintResponse, response);
    } catch (e) {
      logger.trace(`Response was not successful because of: ${e.message}`);
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Invalid data format for: ${JSON.stringify(response)}, because of: ${
            e.message
          }`
        );
        progress.report({ increment: 100 });
        return;
      }
      logger.trace(
        `Print element listing got response code: ${
          parsedResponse.body.returnCode
        } with reason: ${parsedResponse.body.messages.join('\n').trim()}`
      );
      progress.report({ increment: 100 });
      return;
    }
    progress.report({ increment: 50 });
    const [listingContent] = parsedResponse.body.data;
    if (!listingContent) {
      logger.trace(
        `Element ${system}/${subSystem}/${type}/${name} listing content is not presented`
      );
      progress.report({ increment: 100 });
      return;
    }
    progress.report({ increment: 20 });
    return listingContent;
  };

// TODO: think about specifying only part of the type
interface retrieveElementWithFingerprint {
  // retrieve element with fingerprint without signout or signout override
  (): Promise<ElementWithFingerprint | Error>;
  // retrieve element with fingerprint with signout
  (signoutChangeControlValue: ActionChangeControlValue): Promise<
    ElementWithFingerprint | SignoutError | Error
  >;
  // retrieve element with fingerprint with signout override
  (
    signoutChangeControlValue: ActionChangeControlValue,
    overrideSignOut: OverrideSignOut
  ): Promise<ElementWithFingerprint | SignoutError | Error>;
}

export const retrieveElementWithFingerprint =
  (logger: Logger) =>
  (progressReporter: ProgressReporter) =>
  (service: Service) =>
  ({
    instance,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: Element): retrieveElementWithFingerprint =>
  async (
    signoutChangeControlValue?: ActionChangeControlValue,
    overrideSignOut?: OverrideSignOut
  ): Promise<ElementWithFingerprint | SignoutError | Error> => {
    const requestParms: ElmSpecDictionary & RetrieveElmDictionary = {
      environment,
      'stage-number': fromStageNumber(stageNumber),
      system,
      subsystem: subSystem,
      type,
      element: name,
      'override-signout': overrideSignOut ? overrideSignOut : false,
      signout: isDefined(signoutChangeControlValue),
      ccid: signoutChangeControlValue?.ccid,
      comment: signoutChangeControlValue?.comment,
    };
    const session = toSecuredEndevorSession(logger)(service);
    progressReporter.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.retrieveElement(session)(instance)(
        requestParms
      );
    } catch (error) {
      logger.trace(
        `Retrieve element ${system}/${subSystem}/${type}/${name} got error: ${error.message}`
      );
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve element ${system}/${subSystem}/${type}/${name}`
      );
    }
    progressReporter.report({ increment: 50 });
    let parsedResponse: SuccessRetrieveResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessRetrieveResponse, response);
    } catch (error) {
      logger.trace(
        `Response was not successful for element ${system}/${subSystem}/${type}/${name} because of: ${error.message}`
      );
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Invalid data format for: ${JSON.stringify(response)}, because of: ${
            e.message
          }`
        );
        progressReporter.report({ increment: 100 });
        return new Error(
          `Unable to retrieve element ${system}/${subSystem}/${type}/${name}`
        );
      }
      logger.trace(
        `Retrieve element ${system}/${subSystem}/${type}/${name} got response code: ${
          parsedResponse.body.returnCode
        } with reason: ${parsedResponse.body.messages.join('\n').trim()}`
      );
      if (parsedResponse.body.returnCode) {
        const errorResponseAsString = parsedResponse.body.messages
          .join('\n')
          .trim();
        return getTypedErrorFromEndevorError(name, errorResponseAsString);
      }
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve element ${system}/${subSystem}/${type}/${name}`
      );
    }
    const [elementContent] = parsedResponse.body.data;
    if (!elementContent) {
      logger.trace(
        `Element ${system}/${subSystem}/${type}/${name} content is not presented`
      );
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve element ${system}/${subSystem}/${type}/${name}`
      );
    }
    progressReporter.report({ increment: 20 });
    return {
      content: elementContent.toString(),
      fingerprint: parsedResponse.headers.fingerprint,
    };
  };

export const retrieveElementWithoutSignout =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async (element: Element): Promise<ElementContent | Error> => {
    const elementContent = await retrieveElementWithFingerprint(logger)(
      progress
    )(service)(element)();
    if (isError(elementContent)) {
      return elementContent;
    }
    return elementContent.content;
  };

export const retrieveElementWithSignout =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementContent | SignoutError | Error> => {
    const elementContent = await retrieveElementWithFingerprint(logger)(
      progress
    )(service)(element)(signoutChangeControlValue);
    if (isError(elementContent)) {
      return elementContent;
    }
    return elementContent.content;
  };

export const retrieveElementWithOverrideSignout =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<ElementContent | SignoutError | Error> => {
    const elementContent = await retrieveElementWithFingerprint(logger)(
      progress
    )(service)(element)(signoutChangeControlValue, true);
    if (isError(elementContent)) {
      return elementContent;
    }
    return elementContent.content;
  };

export const viewElement = retrieveElementWithoutSignout;

export const signOutElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<void | SignoutError | Error> => {
    const elementContent = await retrieveElementWithFingerprint(logger)(
      progress
    )(service)(element)(signoutChangeControlValue);
    if (isError(elementContent)) {
      return elementContent;
    }
  };

export const overrideSignOutElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (element: Element) =>
  async (
    signoutChangeControlValue: ActionChangeControlValue
  ): Promise<void | SignoutError | Error> => {
    const elementContent = await retrieveElementWithFingerprint(logger)(
      progress
    )(service)(element)(signoutChangeControlValue, true);
    if (isError(elementContent)) {
      return elementContent;
    }
  };

export const signInElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async ({
    instance,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: Element): Promise<void | Error> => {
    const session = toSecuredEndevorSession(logger)(service);
    const requestParms: ElmSpecDictionary & SigninElmDictionary = {
      element: name,
      environment,
      'stage-number': stageNumber,
      system,
      subsystem: subSystem,
      type,
    };
    progress.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.signinElement(session)(instance)(
        requestParms
      );
    } catch (error) {
      logger.trace(`Sign in element got error: ${error.message}`);
      progress.report({ increment: 100 });
      return new Error(
        `Unable to sign in element ${system}/${subSystem}/${type}/${name}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: SignInResponse;
    try {
      parsedResponse = parseToType(SignInResponse, response);
    } catch (e) {
      logger.trace(
        `Invalid data format for: ${JSON.stringify(response)}, because of: ${
          e.message
        }`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to sign in element ${system}/${subSystem}/${type}/${name}`
      );
    }
    if (parsedResponse.body.returnCode) {
      logger.trace(
        `Sign in element got response code: ${
          parsedResponse.body.returnCode
        } with reason: ${parsedResponse.body.messages.join('\n').trim()}`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to sign in element ${system}/${subSystem}/${type}/${name}`
      );
    }
    progress.report({ increment: 20 });
  };

// TODO: think about specifying only part of the type
interface retrieveElementWithDependencies {
  // retrieve element with dependencies without signout
  (): Promise<ElementWithDependencies | Error>;
  // retrieve element with dependencies with signout
  (signoutChangeControlValue: ActionChangeControlValue): Promise<
    ElementWithDependenciesWithSignout | SignoutError | Error
  >;
}

const retrieveElementWithDependencies =
  (logger: Logger) =>
  (progressReporter: ProgressReporter) =>
  (serviceInstance: ServiceInstance) =>
  (element: Element): retrieveElementWithDependencies =>
  async (
    signoutControlValue?: ActionChangeControlValue
  ): Promise<ElementWithDependenciesWithSignout | SignoutError | Error> => {
    const elementProgressRatio = 4;
    let elementContent: string | Error;
    if (!isDefined(signoutControlValue)) {
      elementContent = await retrieveElementWithoutSignout(logger)(
        toSeveralTasksProgress(progressReporter)(elementProgressRatio)
      )(serviceInstance.service)(element);
    } else {
      elementContent = await retrieveElementWithSignout(logger)(
        toSeveralTasksProgress(progressReporter)(elementProgressRatio)
      )(serviceInstance.service)(element)(signoutControlValue);
    }
    if (isError(elementContent)) {
      return elementContent;
    }
    const dependenciesRequestProgressRatio = 4;
    const dependentElements = await retrieveDependentElements(logger)(
      toSeveralTasksProgress(progressReporter)(dependenciesRequestProgressRatio)
    )(serviceInstance.service)(element);
    logger.trace(
      `Element ${element.name} has dependencies: ${JSON.stringify(
        dependentElements
      )}`
    );
    const dependenciesProgressRatio = 2;
    const dependencies = await retrieveElementDependencies(logger)(undefined)(
      toSeveralTasksProgress(progressReporter)(dependenciesProgressRatio)
    )(serviceInstance)(dependentElements);
    return {
      content: elementContent,
      dependencies,
    };
  };

export const retrieveElementWithDependenciesWithoutSignout =
  (logger: Logger) =>
  (progressReporter: ProgressReporter) =>
  (serviceInstance: ServiceInstance) =>
  async (element: Element): Promise<ElementWithDependencies | Error> => {
    return retrieveElementWithDependencies(logger)(progressReporter)(
      serviceInstance
    )(element)();
  };

export const retrieveElementWithDependenciesWithSignout =
  (logger: Logger) =>
  (progressReporter: ProgressReporter) =>
  (serviceInstance: ServiceInstance) =>
  (element: Element) =>
  (
    signoutControlValue: ActionChangeControlValue
  ): Promise<ElementWithDependenciesWithSignout | SignoutError | Error> => {
    return retrieveElementWithDependencies(logger)(progressReporter)(
      serviceInstance
    )(element)(signoutControlValue);
  };

export const retrieveElementWithDependenciesOverrideSignout =
  (logger: Logger) =>
  (progressReporter: ProgressReporter) =>
  (serviceInstance: ServiceInstance) =>
  (element: Element) =>
  async (
    signoutControlValue: ActionChangeControlValue
  ): Promise<ElementWithDependenciesWithSignout | SignoutError | Error> => {
    const elementContent = await retrieveElementWithFingerprint(logger)(
      progressReporter
    )(serviceInstance.service)(element)(signoutControlValue, true);
    if (isError(elementContent)) {
      return elementContent;
    }

    const dependenciesRequestProgressRatio = 4;
    const dependentElements = await retrieveDependentElements(logger)(
      toSeveralTasksProgress(progressReporter)(dependenciesRequestProgressRatio)
    )(serviceInstance.service)(element);
    logger.trace(
      `Element ${element.name} has dependencies: ${JSON.stringify(
        dependentElements
      )}`
    );
    const dependenciesProgressRatio = 2;
    const dependencies = await retrieveElementDependencies(logger)(undefined)(
      toSeveralTasksProgress(progressReporter)(dependenciesProgressRatio)
    )(serviceInstance)(dependentElements);
    return {
      content: elementContent.content,
      dependencies,
    };
  };

const retrieveDependentElements =
  (logger: Logger) =>
  (progressReporter: ProgressReporter) =>
  (service: Service) =>
  async ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
    instance,
  }: Element): Promise<ReadonlyArray<Dependency>> => {
    const requestParms: ElmSpecDictionary & QueryAcmDictionary = {
      environment,
      'stage-number': fromStageNumber(stageNumber),
      system,
      subsystem: subSystem,
      type,
      element: name,
      excCirculars: 'yes',
      excIndirect: 'no',
      excRelated: 'no',
    };
    const session = toSecuredEndevorSession(logger)(service);
    progressReporter.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.queryAcmComponent(session)(instance)(
        requestParms
      );
    } catch (error) {
      logger.trace(`Retrieve element dependencies got error: ${error.message}`);
      progressReporter.report({ increment: 100 });
      return [];
    }
    progressReporter.report({ increment: 50 });
    let parsedResponse: SuccessListDependenciesResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessListDependenciesResponse, response);
    } catch (error) {
      try {
        logger.trace(
          `Response was not successful because of: ${error.message}`
        );
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Invalid data format for: ${response}, because of: ${error.message}`
        );
        progressReporter.report({ increment: 100 });
        return [];
      }
      logger.trace(
        `Retrieve element dependencies got response code: ${
          parsedResponse.body.returnCode
        } with reason: ${parsedResponse.body.messages.join('\n').trim()}`
      );
      progressReporter.report({ increment: 100 });
      return [];
    }
    const [elementResponse] = parsedResponse.body.data;
    if (!elementResponse || !elementResponse.components) {
      logger.trace(
        `Element ${system}/${subSystem}/${type}/${name} dependencies are not presented`
      );
      progressReporter.report({ increment: 100 });
      return [];
    }
    const dependencies: DependentElements = elementResponse.components
      .map((element) => {
        try {
          return parseToType(DependentElement, element);
        } catch (error) {
          logger.trace(
            `Invalid data format for element: ${element}, it will be skipped: ${error.message}`
          );
          return;
        }
      })
      .filter(isDefined);
    progressReporter.report({ increment: 20 });
    return dependencies.map((dependency) => {
      return {
        instance,
        environment: dependency.envName,
        stageNumber: dependency.stgNum,
        system: dependency.sysName,
        subSystem: dependency.sbsName,
        type: dependency.typeName,
        name: dependency.elmName,
        extension: getElementExtension({
          typeName: dependency.typeName,
          fileExt: dependency.fileExt,
        }),
      };
    });
  };

const retrieveElementDependencies =
  (logger: Logger) =>
  (controlValue: ActionChangeControlValue | undefined) =>
  (progressReporter: ProgressReporter) =>
  ({ service, requestPoolMaxSize }: ServiceInstance) =>
  async (
    dependencies: ReadonlyArray<Dependency>
  ): Promise<
    ReadonlyArray<[Dependency, ElementContent | SignoutError | Error]>
  > => {
    const dependenciesNumber = dependencies.length;
    const dependenciesReporter: ProgressReporter =
      toSeveralTasksProgress(progressReporter)(dependenciesNumber);
    let contents: (string | Error)[];
    if (!isDefined(controlValue)) {
      contents = await new PromisePool(
        dependencies
          .filter((dependency) => dependency.name.trim()) // endevor can return name with space inside
          .map(
            (dependency) => () =>
              retrieveElementWithoutSignout(logger)(dependenciesReporter)(
                service
              )({
                environment: dependency.environment,
                stageNumber: dependency.stageNumber,
                system: dependency.system,
                subSystem: dependency.subSystem,
                type: dependency.type,
                name: dependency.name,
                instance: dependency.instance,
                extension: dependency.extension,
              })
          ),
        {
          concurrency: requestPoolMaxSize,
        }
      ).start();
    } else {
      contents = await new PromisePool(
        dependencies
          .filter((dependency) => dependency.name.trim()) // endevor can return name with space inside
          .map(
            (dependency) => () =>
              retrieveElementWithSignout(logger)(dependenciesReporter)(service)(
                {
                  environment: dependency.environment,
                  stageNumber: dependency.stageNumber,
                  system: dependency.system,
                  subSystem: dependency.subSystem,
                  type: dependency.type,
                  name: dependency.name,
                  instance: dependency.instance,
                  extension: dependency.extension,
                }
              )(controlValue)
          ),
        {
          concurrency: requestPoolMaxSize,
        }
      ).start();
    }
    return dependencies.map((dependency, index) => {
      const dependencyContent = contents[index];
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [dependency, dependencyContent!];
    });
  };

export const generateElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  ({
    instance,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: Element) =>
  ({ ccid: actionCcid, comment }: ActionChangeControlValue) =>
  async (copyBack: boolean): Promise<void | Error> => {
    const session = toSecuredEndevorSession(logger)(service);
    const requestParms: ElmSpecDictionary & GenerateElmDictionary = {
      element: name,
      environment,
      'stage-number': stageNumber,
      system,
      subsystem: subSystem,
      type,
      'copy-back': copyBack,
      ccid: actionCcid,
      comment,
    };
    progress.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.generateElement(session)(instance)(
        requestParms
      );
    } catch (error) {
      logger.trace(`Generate element got error: ${error.message}`);
      progress.report({ increment: 100 });
      return new Error(
        `Unable to generate element ${system}/${subSystem}/${type}/${name}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: GenerateResponse;
    try {
      parsedResponse = parseToType(GenerateResponse, response);
    } catch (e) {
      logger.trace(
        `Invalid data format for: ${JSON.stringify(response)}, because of: ${
          e.message
        }`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to generate element ${system}/${subSystem}/${type}/${name}`
      );
    }
    if (parsedResponse.body.returnCode) {
      logger.trace(
        `Generate element got response code: ${
          parsedResponse.body.returnCode
        } with reason: ${parsedResponse.body.messages.join('\n').trim()}`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to generate element ${system}/${subSystem}/${type}/${name}`
      );
    }
    progress.report({ increment: 20 });
  };

export const updateElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  ({
    instance,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: ElementMapPath) =>
  ({ ccid, comment }: ActionChangeControlValue) =>
  async ({
    content,
    fingerprint,
  }: ElementWithFingerprint): Promise<
    void | FingerprintMismatchError | SignoutError | Error
  > => {
    const elementData = {
      element: name,
      environment,
      stageNumber,
      system,
      subsystem: subSystem,
      type,
    };
    const session = toSecuredEndevorSession(logger)(service);
    const requestParms = toUpdateRequest({
      content,
      fingerprint,
      ccid,
      comment,
    });
    if (isError(requestParms)) {
      const error = requestParms;
      logger.info(error.message);
      return new Error(
        `Unable to update element ${system}/${subSystem}/${type}/${name}`
      );
    }
    progress.report({ increment: 30 });
    let response;
    try {
      response = await AddUpdElement.updElement(
        session,
        instance,
        elementData,
        requestParms
      );
    } catch (error) {
      logger.trace(`Update element got error: ${error.message}`);
      progress.report({ increment: 100 });
      return new Error(
        `Unable to update element ${system}/${subSystem}/${type}/${name}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: UpdateResponse;
    try {
      parsedResponse = parseToType(UpdateResponse, response);
    } catch (e) {
      logger.trace(
        `Invalid data format for: ${JSON.stringify(response)}, because of: ${
          e.message
        }`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to update element ${system}/${subSystem}/${type}/${name}`
      );
    }
    const updateReturnCode = parsedResponse.body.returnCode;
    if (updateReturnCode) {
      const errorResponseAsString = parsedResponse.body.messages
        .join('\n')
        .trim();
      const typedError = getTypedErrorFromEndevorError(
        name,
        errorResponseAsString
      );
      if (isChangeRegressionError(typedError)) {
        // if expected regression info message appeared, just leave a trace and update successfully
        logger.trace(typedError.message);
      } else {
        logger.trace(
          `Update element got response code: ${updateReturnCode} with reason: ${errorResponseAsString}`
        );
        progress.report({ increment: 100 });
        return typedError;
      }
    }
    progress.report({ increment: 20 });
  };

const toUpdateRequest = ({
  fingerprint,
  content,
  ccid,
  comment,
}: DomainUpdateParams): SdkUpdateParams | Error => {
  let tempFile;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const string2fileStream = require('string-to-file-stream');
    tempFile = string2fileStream(content);
  } catch (error) {
    return new Error(`Reading element from temp file error: ${error.message}`);
  }
  return {
    fromFile: tempFile,
    ccid,
    comment,
    fingerprint,
  };
};

export const addElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  ({
    instance,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: ElementMapPath) =>
  ({ ccid, comment }: ActionChangeControlValue) =>
  async (content: string): Promise<void | DuplicateElementError | Error> => {
    const elementData = {
      element: name,
      environment,
      stageNumber,
      system,
      subsystem: subSystem,
      type,
    };
    const session = toSecuredEndevorSession(logger)(service);
    const requestParms = toUpdateRequest({
      content,
      fingerprint: '',
      ccid,
      comment,
    });
    if (isError(requestParms)) {
      const error = requestParms;
      logger.info(error.message);
      return new Error(
        `Unable to add element ${system}/${subSystem}/${type}/${name}`
      );
    }
    progress.report({ increment: 30 });
    let response;
    try {
      response = await AddUpdElement.addElement(
        session,
        instance,
        elementData,
        requestParms
      );
    } catch (error) {
      logger.trace(`Add element got error: ${error.message}`);
      progress.report({ increment: 100 });
      return new Error(
        `Unable to add element ${system}/${subSystem}/${type}/${name}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: AddResponse;
    try {
      parsedResponse = parseToType(AddResponse, response);
    } catch (e) {
      logger.trace(
        `Invalid data format for: ${JSON.stringify(response)}, because of: ${
          e.message
        }`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to add element ${system}/${subSystem}/${type}/${name}`
      );
    }
    if (parsedResponse.body.returnCode) {
      const errorResponseAsString = parsedResponse.body.messages
        .join('\n')
        .trim();
      logger.trace(
        `Add element got response code: ${parsedResponse.body.returnCode} with reason: ${errorResponseAsString}`
      );
      progress.report({ increment: 100 });
      return getTypedErrorFromEndevorError(name, errorResponseAsString);
    }
    progress.report({ increment: 20 });
  };
