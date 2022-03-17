/*
 * © 2022 Broadcom Inc and/or its subsidiaries; All rights reserved
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
  EnvironmentStage,
  Value,
  SubSystem,
  System,
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
  BaseResponse,
  EnvironmentStage as ExternalEnvironmentStage,
  SuccessListEnvironmentStagesResponse,
  SubSystem as ExternalSubSystem,
  SuccessListSystemsResponse,
  System as ExternalSystem,
  SuccessListSubSystemsResponse,
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
      logger.trace(
        `Unable to fetch the list instances because of error ${error.message}.`
      );
      progress.report({ increment: 100 });
      return [];
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListRepositoriesResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessListRepositoriesResponse, response);
    } catch (e) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Unable to fetch the list instances because of error ${
            e.message
          }\nof an incorrect response ${JSON.stringify(response)}.`
        );
        progress.report({ increment: 100 });
        return [];
      }
      logger.trace(
        `Unable to fetch the list instances because of response code ${
          parsedResponse.body.returnCode
        } with reason \n${parsedResponse.body.messages.join('\n').trim()}.`
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
            `Unable to fetch the instance ${JSON.stringify(
              repository
            )} because of error ${e.message}.`
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

export const getAllEnvironmentStages =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async (
    instance: string
  ): Promise<ReadonlyArray<EnvironmentStage> | Error> => {
    const session = toSecuredEndevorSession(logger)(service);
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: ANY_VALUE,
      'stage-number': ANY_VALUE,
    };
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.listStage(session)(instance)(requestArgs);
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the environments stages for the instance ${instance} because of error ${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListEnvironmentStagesResponse | ErrorResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error ${
            error.message
          }\nof an incorrect response ${JSON.stringify(response)}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to fetch the environments stages for the instance ${instance} because of response code ${response.body.returnCode}`
        );
      }
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the environments stages for the instance ${instance} because of response code ${
          parsedResponse.body.returnCode
        } with reason \n${parsedResponse.body.messages.join('\n').trim()}`
      );
    }
    try {
      parsedResponse = parseToType(
        SuccessListEnvironmentStagesResponse,
        response
      );
    } catch (error) {
      logger.trace(
        `Unable to fetch the environments stages for the instance ${instance} because of error ${
          error.message
        }\nof an incorrect response ${JSON.stringify(response)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the environments stages for the instance ${instance} because of incorrect response`
      );
    }
    const environments = parsedResponse.body.data
      .map((environment) => {
        try {
          return parseToType(ExternalEnvironmentStage, environment);
        } catch (e) {
          logger.trace(
            `Unable to fetch the environment ${JSON.stringify(
              environment
            )} because of error ${e.message} in the response.`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((environment) => {
        return {
          environment: environment.envName,
          stageNumber: environment.stgNum,
          nextEnvironment:
            environment.nextEnv === null ? undefined : environment.nextEnv,
          nextStageNumber:
            environment.nextStgNum === null
              ? undefined
              : environment.nextStgNum,
        };
      });
    progress.report({ increment: 20 });
    return environments;
  };

export const getAllSystems =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async (instance: Value): Promise<ReadonlyArray<System> | Error> => {
    const session = toSecuredEndevorSession(logger)(service);
    const requestArgs: ElmSpecDictionary = {
      environment: ANY_VALUE,
      'stage-number': ANY_VALUE,
      system: ANY_VALUE,
    };
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.listSystem(session)(instance)(requestArgs);
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the systems from ${instance} because of error ${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListSystemsResponse | ErrorResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error ${
            error.message
          }\nof an incorrect response ${JSON.stringify(response)}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to fetch the systems from ${instance} because of response code ${response.body.returnCode}`
        );
      }
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the systems from ${instance} because of response code ${
          parsedResponse.body.returnCode
        } with reason \n${parsedResponse.body.messages.join('\n').trim()}`
      );
    }
    try {
      parsedResponse = parseToType(SuccessListSystemsResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to fetch the systems from ${instance} because of error ${
          error.message
        }\nof an incorrect response ${JSON.stringify(response)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the systems from ${instance} because of incorrect response`
      );
    }
    const systems = parsedResponse.body.data
      .map((system) => {
        try {
          return parseToType(ExternalSystem, system);
        } catch (e) {
          logger.trace(
            `Unable to fetch the system ${JSON.stringify(
              system
            )} because of error ${e.message} in the response.`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((system) => {
        return {
          environment: system.envName,
          // we treat stage sequence number as a stage number here,
          // because with search for systems in all environments (*),
          // each environment will be treated independently, so sequence number will be the same as stage number
          // TODO: change to stageID
          stageNumber: system.stgSeqNum,
          system: system.sysName,
          nextSystem: system.nextSys,
        };
      });
    progress.report({ increment: 20 });
    return systems;
  };

export const getAllSubSystems =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async (instance: string): Promise<ReadonlyArray<SubSystem> | Error> => {
    const session = toSecuredEndevorSession(logger)(service);
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: ANY_VALUE,
      'stage-number': ANY_VALUE,
      system: ANY_VALUE,
      subsystem: ANY_VALUE,
    };
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.listSubsystem(session)(instance)(
        requestArgs
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the subsystems from ${instance} because of error ${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListSubSystemsResponse | ErrorResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error ${
            error.message
          }\nof an incorrect response ${JSON.stringify(response)}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to fetch the subsystems from ${instance} because of response code ${response.body.returnCode}`
        );
      }
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the subsystems from ${instance} because of response code ${
          parsedResponse.body.returnCode
        } with reason \n${parsedResponse.body.messages.join('\n').trim()}`
      );
    }
    try {
      parsedResponse = parseToType(SuccessListSubSystemsResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to fetch the subsystems from ${instance} because of error ${
          error.message
        }\nof an incorrect response ${JSON.stringify(response)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the subsystems from ${instance} because of incorrect response`
      );
    }
    const subSystems = parsedResponse.body.data
      .map((subSystem) => {
        try {
          return parseToType(ExternalSubSystem, subSystem);
        } catch (e) {
          logger.trace(
            `Unable to fetch the subsystem ${JSON.stringify(
              subSystem
            )} because of error ${e.message} in the response.`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((subSystem): SubSystem => {
        return {
          environment: subSystem.envName,
          // we treat stage sequence number as a stage number here,
          // because with search for systems in all environments (*),
          // each environment will be treated independently, so sequence number will be the same as stage number
          // TODO: change to stageID
          stageNumber: subSystem.stgSeqNum,
          system: subSystem.sysName,
          subSystem: subSystem.sbsName,
          nextSubSystem: subSystem.nextSbs,
        };
      });
    progress.report({ increment: 20 });
    return subSystems;
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
  }: ElementSearchLocation): Promise<ReadonlyArray<Element> | Error> => {
    const session = toSecuredEndevorSession(logger)(service);
    const minimalElementInfo = 'BAS';
    const searchUpInMap = true;
    const firstOccurrence = 'FIR';
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: environment || ANY_VALUE,
      'stage-number': fromStageNumber(stageNumber),
      system: system || ANY_VALUE,
      subsystem: subsystem || ANY_VALUE,
      type: type || ANY_VALUE,
      element: element || ANY_VALUE,
      data: minimalElementInfo,
      search: searchUpInMap,
      return: firstOccurrence,
    };
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.listElement(session)(instance)(
        requestArgs
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the elements from ${requestArgs.environment}/${requestArgs.system}/${requestArgs.subsystem}/${requestArgs.type} because of error ${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListElementsResponse | ErrorResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error ${
            error.message
          }\nof an incorrect response ${JSON.stringify(response)}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to fetch the elements from ${requestArgs.environment}/${requestArgs.system}/${requestArgs.subsystem}/${requestArgs.type} because of response code ${response.body.returnCode}`
        );
      }
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the elements from ${requestArgs.environment}/${
          requestArgs.system
        }/${requestArgs.subsystem}/${
          requestArgs.type
        } because of response code ${
          parsedResponse.body.returnCode
        } with reason \n${parsedResponse.body.messages.join('\n').trim()}`
      );
    }
    try {
      parsedResponse = parseToType(SuccessListElementsResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to fetch the elements from ${requestArgs.environment}/${
          requestArgs.system
        }/${requestArgs.subsystem}/${requestArgs.type} because of error ${
          error.message
        }\nof an incorrect response ${JSON.stringify(response)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the elements from ${requestArgs.environment}/${requestArgs.system}/${requestArgs.subsystem}/${requestArgs.type} because of incorrect response`
      );
    }
    const elements = parsedResponse.body.data
      .map((element) => {
        try {
          return parseToType(ExternalElement, element);
        } catch (e) {
          logger.trace(
            `Unable to fetch the element ${JSON.stringify(
              element
            )} because of error ${e.message} in the response.`
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
  }: Element): Promise<ElementContent | Error> => {
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
      const errorMessage = `Unable to print the element ${system}/${subSystem}/${type}/${name} because of error ${error.message}`;
      progress.report({ increment: 100 });
      return new Error(errorMessage);
    }
    let parsedResponse: SuccessPrintResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessPrintResponse, response);
    } catch (e) {
      logger.trace(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} because of error ${
          e.message
        }\nof an incorrect response ${JSON.stringify(response)}.`
      );
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Unable to print the element ${system}/${subSystem}/${type}/${name} because of error ${
            e.message
          }\nof an incorrect error response ${JSON.stringify(response)}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to print the element ${system}/${subSystem}/${type}/${name} because of incorrect response`
        );
      }
      const errorMessage = `Unable to print the element ${system}/${subSystem}/${type}/${name} because of response code ${
        parsedResponse.body.returnCode
      } with reason\n${parsedResponse.body.messages.join('\n').trim()}`;
      progress.report({ increment: 100 });
      return new Error(errorMessage);
    }
    progress.report({ increment: 50 });
    const [elementContent] = parsedResponse.body.data;
    if (!elementContent) {
      logger.trace(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} because the content is not presented in the response ${JSON.stringify(
          response
        )}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} because of incorrect response`
      );
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
  }: Element): Promise<ListingContent | Error> => {
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
      progress.report({ increment: 100 });
      return new Error(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} listing because of error ${error.message}`
      );
    }
    let parsedResponse: SuccessPrintResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessPrintResponse, response);
    } catch (e) {
      logger.trace(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} listing because of error ${
          e.message
        }\nof an incorrect response ${JSON.stringify(response)}.`
      );
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Unable to print the element ${system}/${subSystem}/${type}/${name} listing because of error ${
            e.message
          }\n of an incorrect error response ${JSON.stringify(response)}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to print the element ${system}/${subSystem}/${type}/${name} listing because of incorrect response`
        );
      }
      const errorMessage = `Unable to print the element ${system}/${subSystem}/${type}/${name} listing because of response code ${
        parsedResponse.body.returnCode
      } with reason\n${parsedResponse.body.messages.join('\n').trim()}`;
      progress.report({ increment: 100 });
      return new Error(errorMessage);
    }
    progress.report({ increment: 50 });
    const [listingContent] = parsedResponse.body.data;
    if (!listingContent) {
      logger.trace(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} listing because the content is not presented in the response ${JSON.stringify(
          response
        )}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} listing because of incorrect response`
      );
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
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of an error ${error.message}`
      );
    }
    progressReporter.report({ increment: 50 });
    let parsedResponse: SuccessRetrieveResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessRetrieveResponse, response);
    } catch (error) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of a failed success response parsing:\n${
            error.message
          }\nand a failed error response parsing:\n${
            e.message
          }\nof an incorrect response:\n${JSON.stringify(response, null, 2)}.`
        );
        progressReporter.report({ increment: 100 });
        return new Error(
          `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of an incorrect response`
        );
      }
      // add extra \n in the beginning of the messages line
      const errorResponseAsString = [
        '',
        ...parsedResponse.body.messages.map((message) => message.trim()),
      ].join('\n');
      const errorMessage = `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of response code ${parsedResponse.body.returnCode} with reason ${errorResponseAsString}`;
      return getTypedErrorFromEndevorError(
        {
          elementName: name,
          endevorMessage: errorResponseAsString,
        },
        errorMessage
      );
    }
    const [elementContent] = parsedResponse.body.data;
    if (!elementContent) {
      progressReporter.report({ increment: 100 });
      logger.trace(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because the content is not presented in the response`
      );
      return new Error(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of an incorrect response`
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
      const error = elementContent;
      return error;
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
      const error = elementContent;
      return error;
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
      const error = elementContent;
      return error;
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
      const errorMessage = `Unable to sign in the element ${system}/${subSystem}/${type}/${name} because of error ${error.message}`;
      progress.report({ increment: 100 });
      return new Error(errorMessage);
    }
    progress.report({ increment: 50 });
    let parsedResponse: SignInResponse;
    try {
      parsedResponse = parseToType(SignInResponse, response);
    } catch (e) {
      logger.trace(
        `Unable to sign in the element ${system}/${subSystem}/${type}/${name} because of error ${
          e.message
        } in the incorrect response ${JSON.stringify(response)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to sign in the element ${system}/${subSystem}/${type}/${name} because of incorrect response`
      );
    }
    if (parsedResponse.body.returnCode) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to sign in the element ${system}/${subSystem}/${type}/${name} because of response code ${
          parsedResponse.body.returnCode
        } with reason\n${parsedResponse.body.messages.join('\n').trim()}`
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
      const error = elementContent;
      return error;
    }
    const dependenciesRequestProgressRatio = 4;
    const dependentElements = await retrieveDependentElements(logger)(
      toSeveralTasksProgress(progressReporter)(dependenciesRequestProgressRatio)
    )(serviceInstance.service)(element);
    if (isError(dependentElements)) {
      const error = dependentElements;
      logger.trace(`${error.message}.`);
      return {
        content: elementContent,
        dependencies: [],
      };
    }
    logger.trace(
      `Element ${element.name} has dependencies: ${JSON.stringify(
        dependentElements
      )}.`
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
      const error = elementContent;
      return error;
    }
    const dependenciesRequestProgressRatio = 4;
    const dependentElements = await retrieveDependentElements(logger)(
      toSeveralTasksProgress(progressReporter)(dependenciesRequestProgressRatio)
    )(serviceInstance.service)(element);
    if (isError(dependentElements)) {
      const error = dependentElements;
      logger.trace(`${error.message}.`);
      return {
        content: elementContent.content,
        dependencies: [],
      };
    }
    logger.trace(
      `Element ${element.name} has dependencies: ${JSON.stringify(
        dependentElements
      )}.`
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
  }: Element): Promise<ReadonlyArray<Dependency> | Error> => {
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
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} dependencies because of error ${error.message}`
      );
    }
    progressReporter.report({ increment: 50 });
    let parsedResponse: SuccessListDependenciesResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessListDependenciesResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} dependencies because of error ${
          error.message
        }\nof an incorrect response ${JSON.stringify(response)}.`
      );
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} dependencies because of error ${
            error.message
          }\nof an incorrect error response ${JSON.stringify(response)}.`
        );
        progressReporter.report({ increment: 100 });
        return new Error(
          `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} dependencies because of incorrect response`
        );
      }
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} dependencies because of response code ${
          parsedResponse.body.returnCode
        } with reason: ${parsedResponse.body.messages.join('\n').trim()}`
      );
    }
    const [elementResponse] = parsedResponse.body.data;
    if (!elementResponse || !elementResponse.components) {
      logger.trace(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} dependencies because the components are not presented in the response ${JSON.stringify(
          response
        )}.`
      );
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} dependencies because of incorrect response`
      );
    }
    const dependencies: DependentElements = elementResponse.components
      .map((element) => {
        try {
          return parseToType(DependentElement, element);
        } catch (error) {
          logger.trace(
            `Unable to retrieve the dependency for the element ${system}/${subSystem}/${type}/${name} because of error ${
              error.message
            }\nof an unexpected response format ${JSON.stringify(element)}.`
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
      progress.report({ increment: 100 });
      return new Error(
        `Unable to generate the element ${system}/${subSystem}/${type}/${name} because of error ${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: GenerateResponse;
    try {
      parsedResponse = parseToType(GenerateResponse, response);
    } catch (e) {
      logger.trace(
        `Unable to generate the element ${system}/${subSystem}/${type}/${name} because of error ${
          e.message
        } in the incorrect response ${JSON.stringify(response)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to generate the element ${system}/${subSystem}/${type}/${name} because of incorrect response`
      );
    }
    if (parsedResponse.body.returnCode) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to generate the element ${system}/${subSystem}/${type}/${name} because of response code ${
          parsedResponse.body.returnCode
        } with reason\n${parsedResponse.body.messages.join('\n').trim()}`
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
      return new Error(
        `Unable to update the element ${system}/${subSystem}/${type}/${name} because of an error ${error.message}`
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
      progress.report({ increment: 100 });
      return new Error(
        `Unable to update the element ${system}/${subSystem}/${type}/${name} because of an error ${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: UpdateResponse;
    try {
      parsedResponse = parseToType(UpdateResponse, response);
    } catch (e) {
      logger.trace(
        `Unable to update the element ${system}/${subSystem}/${type}/${name} because the Endevor response parsing is failed:\n${
          e.message
        }\nof an incorrect response:\n${JSON.stringify(response, null, 2)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to update the element ${system}/${subSystem}/${type}/${name} because of an incorrect response`
      );
    }
    const updateReturnCode = parsedResponse.body.returnCode;
    if (updateReturnCode) {
      // add an extra \n in the beginning of the Endevor messages line
      const errorResponseAsString = [
        '',
        ...parsedResponse.body.messages.map((message) => message.trim()),
      ].join('\n');
      const errorMessage = `Unable to update the element ${system}/${subSystem}/${type}/${name} because of response code ${parsedResponse.body.returnCode} with reason ${errorResponseAsString}`;
      const typedError = getTypedErrorFromEndevorError(
        {
          elementName: name,
          endevorMessage: errorResponseAsString,
        },
        errorMessage
      );
      if (isChangeRegressionError(typedError)) {
        // if the expected regression info message appeared, just leave a trace and update successfully
        logger.trace(`${errorMessage}.`);
      } else {
        logger.trace(
          `Update element was updated, but got a response code ${updateReturnCode} with reason ${errorResponseAsString}.`
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
    return new Error(`Reading element from temp file error ${error.message}`);
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
      return new Error(
        `Unable to add the element ${system}/${subSystem}/${type}/${name} because of error ${error.message}`
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
      progress.report({ increment: 100 });
      return new Error(
        `Unable to add the element ${system}/${subSystem}/${type}/${name} because of error ${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: AddResponse;
    try {
      parsedResponse = parseToType(AddResponse, response);
    } catch (e) {
      logger.trace(
        `Unable to add the element ${system}/${subSystem}/${type}/${name} because of error ${
          e.message
        }\nof an incorrect error response ${JSON.stringify(response)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to add the element ${system}/${subSystem}/${type}/${name} because of incorrect response`
      );
    }
    if (parsedResponse.body.returnCode) {
      const errorResponseAsString = ['', ...parsedResponse.body.messages]
        .join('\n')
        .trim();
      progress.report({ increment: 100 });
      return getTypedErrorFromEndevorError(
        {
          elementName: name,
          endevorMessage: errorResponseAsString,
        },
        `Unable to add the element because of response code ${parsedResponse.body.returnCode} with reason ${errorResponseAsString}`
      );
    }
    progress.report({ increment: 20 });
  };
