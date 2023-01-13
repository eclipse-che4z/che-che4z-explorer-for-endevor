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
  fromStageNumber,
  stringifyWithHiddenCredential,
  isError,
  isDefined,
  toSeveralTasksProgress,
  toCorrectBasePathFormat,
  stringifyPretty,
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
  Component,
  Element,
  ElementMapPath,
  ElementSearchLocation,
  ElementWithDependencies,
  ElementWithFingerprint,
  Service,
  ServiceLocation,
  ElementContent,
  ServiceInstance,
  OverrideSignOut,
  ElementWithDependenciesWithSignout,
  EnvironmentStageResponseObject,
  Value,
  SubSystemResponseObject,
  SystemResponseObject,
  SignOutParams,
  GenerateParams,
  GenerateWithCopyBackParams,
  GenerateSignOutParams,
  ServiceApiVersion,
  Configuration,
  SearchStrategies,
  SDK_FROM_FILE_DESCRIPTION,
  UpdateResponse as InternalUpdateResponse,
  ResponseStatus,
  SystemMapPath,
  EnvironmentStageMapPath,
  SubSystemMapPath,
  ElementTypeMapPath,
  ElementTypeResponseObject,
  PrintListingResponse,
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
  Component as ExternalComponent,
  Components as ExternalComponents,
  Element as ExternalElement,
  SuccessListDependenciesResponse,
  Configuration as ExternalConfiguration,
  SuccessListElementsResponse,
  ErrorResponse,
  SuccessRetrieveResponse,
  SuccessListConfigurationsResponse,
  UpdateResponse,
  AddResponse,
  BaseResponse,
  EnvironmentStage as ExternalEnvironmentStage,
  SuccessListEnvironmentStagesResponse,
  SubSystem as ExternalSubSystem,
  SuccessListSystemsResponse,
  System as ExternalSystem,
  ElementType as ExternalType,
  SuccessListSubSystemsResponse,
  V1ApiVersionResponse,
  V2ApiVersionResponse,
  PrintResponse,
  SuccessListElementTypesResponse,
} from './_ext/Endevor';
import { Logger } from '@local/extension/_doc/Logger';
import { ANY_VALUE } from './const';
import { ProgressReporter } from './_doc/Progress';
import { PromisePool } from 'promise-pool-tool';
import {
  getTypedErrorFromEndevorError,
  SignoutError,
  DuplicateElementError,
  ProcessorStepMaxRcExceededError,
  getTypedErrorFromHttpError,
  SelfSignedCertificateError,
  WrongCredentialsError,
  makeError,
  ErrorContextTypes,
  ConnectionError,
  getTypedErrorFromEndevorCode,
  getTypedErrorFromHttpCode,
} from './_doc/Error';
import { Readable } from 'stream';

const toEndevorSession =
  ({ protocol, hostname, port, basePath }: ServiceLocation) =>
  (rejectUnauthorized: boolean): Session => {
    return new Session({
      protocol,
      hostname,
      port,
      basePath: toCorrectBasePathFormat(basePath),
      rejectUnauthorized,
    });
  };

export const getApiVersion =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (serviceLocation: ServiceLocation) =>
  async (
    rejectUnauthorized: boolean
  ): Promise<ServiceApiVersion | SelfSignedCertificateError | Error> => {
    const session = toEndevorSession(serviceLocation)(rejectUnauthorized);
    progress.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.listInstances(session);
    } catch (error) {
      progress.report({ increment: 100 });
      const errorCode = error.causeErrors?.code;
      if (errorCode) {
        const errorMessage = error.causeErrors?.message;
        return getTypedErrorFromHttpError(
          {
            code: errorCode,
            message: errorMessage,
          },
          `Unable to fetch the Endevor API version because of error: ${errorMessage}`
        );
      }
      return new Error(
        `Unable to fetch the Endevor API version because of error: ${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let apiVersion: ServiceApiVersion;
    try {
      parseToType(V1ApiVersionResponse, response);
      apiVersion = ServiceApiVersion.V1;
    } catch (error) {
      try {
        parseToType(V2ApiVersionResponse, response);
        apiVersion = ServiceApiVersion.V2;
      } catch (e) {
        logger.trace(
          `Unable to fetch the Endevor API version because of errors:\n${
            error.message
          }\nand:\n${e.message}\nof an incorrect response:\n${stringifyPretty(
            response
          )}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to fetch the Endevor API version because of incorrect response error:\n${e.message}\nand:\n${error.message}`
        );
      }
    }
    progress.report({ increment: 20 });
    return apiVersion;
  };

export const getConfigurations =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (serviceLocation: ServiceLocation) =>
  async (
    rejectUnauthorized: boolean
  ): Promise<ReadonlyArray<Configuration> | Error | ConnectionError> => {
    const session = toEndevorSession(serviceLocation)(rejectUnauthorized);
    progress.report({ increment: 30 });
    let response: BaseResponse;
    const errorMessage = `Unable to get endevor configurations for service`;
    const makeErrorWithReason = makeError(errorMessage);
    try {
      response = await EndevorClient.listInstances(session);
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      const errorCode = error.causeErrors?.code;
      if (errorCode) {
        return makeErrorWithReason({
          type: ErrorContextTypes.CONNECTION_ERROR,
          code: errorCode,
          message: error.causeErrors?.message,
        });
      }
      return makeErrorWithReason({
        type: ErrorContextTypes.API_ERROR,
        error,
      });
    }
    progress.report({ increment: 50 });
    if (response.body.returnCode) {
      let parsedResponse: ErrorResponse;
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Unable to fetch the list of Endevor configurations because of error:\n${
            e.message
          }\nof an incorrect response:\n${stringifyPretty(response)}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to fetch the list of Endevor configurations because of response code ${response.body.returnCode}`
        );
      }
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the list of Endevor configurations because of response code ${
          parsedResponse.body.returnCode
        } with reason:\n${parsedResponse.body.messages.join('\n').trim()}.`
      );
    }
    let parsedResponse: SuccessListConfigurationsResponse;
    try {
      parsedResponse = parseToType(SuccessListConfigurationsResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to fetch the list of Endevor configurations because of error:\n${
          error.message
        }\nof an incorrect response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return new Error(
        `Unable to fetch the list of Endevor configurations because of incorrect response error:\n${error.message}`
      );
    }
    const configurations = parsedResponse.body.data
      .map((configuration) => {
        try {
          return parseToType(ExternalConfiguration, configuration);
        } catch (e) {
          logger.trace(
            `Unable to fetch the Endevor configuration:\n${stringifyPretty(
              configuration
            )}\nbecause of error:\n${e.message}.`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((configuration) => ({
        name: configuration.name,
        description: configuration.description,
      }));
    progress.report({ increment: 20 });
    return configurations;
  };

export const toSecuredEndevorSession =
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

export const getAllEnvironmentStages =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (
    environmentSearchParams?: Partial<EnvironmentStageMapPath>
  ): Promise<
    | ReadonlyArray<EnvironmentStageResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    const session = toSecuredEndevorSession(logger)(service);
    const withSearchUpTheMap =
      environmentSearchParams?.environment !== undefined &&
      environmentSearchParams.stageNumber !== undefined;
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: withSearchUpTheMap
        ? environmentSearchParams.environment
        : ANY_VALUE,
      'stage-number': withSearchUpTheMap
        ? environmentSearchParams.stageNumber
        : ANY_VALUE,
      search: withSearchUpTheMap,
      return: 'ALL',
    };
    const errorMessage = `Unable to fetch the environment stages for the Endevor configuration ${configuration}`;
    const makeErrorWithReason = makeError(errorMessage);
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.listStage(session)(configuration)(
        requestArgs
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      const errorCode = error.causeErrors?.code;
      if (errorCode) {
        return makeErrorWithReason({
          type: ErrorContextTypes.CONNECTION_ERROR,
          code: errorCode,
          message: error.causeErrors?.message,
        });
      }
      return makeErrorWithReason({
        type: ErrorContextTypes.API_ERROR,
        error,
      });
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListEnvironmentStagesResponse | ErrorResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error:\n${
            error.message
          }\nof an incorrect response:\n${stringifyPretty(response)}.`
        );
        progress.report({ increment: 100 });
        return makeErrorWithReason({
          type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
          returnCode: response.body.returnCode,
          error,
        });
      }
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.ENDEVOR_RETURN_CODE_AND_MESSAGES,
        returnCode: parsedResponse.body.returnCode,
        messages: parsedResponse.body.messages,
      });
    }
    try {
      parsedResponse = parseToType(
        SuccessListEnvironmentStagesResponse,
        response
      );
    } catch (error) {
      logger.trace(
        `${errorMessage} because of error:\n${
          error.message
        }\nof an incorrect response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
        returnCode: response.body.returnCode,
        error,
      });
    }
    const environments = parsedResponse.body.data
      .map((environment) => {
        try {
          return parseToType(ExternalEnvironmentStage, environment);
        } catch (e) {
          logger.trace(
            `Unable to fetch the environment stage:\n${stringifyPretty(
              environment
            )}\nbecause of an error in the response:\n${e.message}.`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((environment) => {
        return {
          environment: environment.envName,
          stageNumber: environment.stgNum,
          stageId: environment.stgId,
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
  (configuration: Value) =>
  (searchStrategy: SearchStrategies) =>
  async (
    systemSearchParams?: Partial<SystemMapPath>
  ): Promise<
    | ReadonlyArray<SystemResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    const session = toSecuredEndevorSession(logger)(service);
    let searchUpInMap = true;
    let firstOccurrence = 'FIR';
    switch (searchStrategy) {
      case SearchStrategies.IN_PLACE:
        searchUpInMap = false;
        break;
      case SearchStrategies.ALL:
        firstOccurrence = 'ALL';
        break;
      case SearchStrategies.FIRST_FOUND:
        break;
      default:
        throw new UnreachableCaseError(searchStrategy);
    }
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: systemSearchParams?.environment || ANY_VALUE,
      'stage-number': systemSearchParams?.stageNumber || ANY_VALUE,
      system: systemSearchParams?.system || ANY_VALUE,
      search: searchUpInMap,
      return: firstOccurrence,
    };
    const errorMessage = `Unable to fetch the systems from the Endevor configuration ${configuration}`;
    const makeErrorWithReason = makeError(errorMessage);
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.listSystem(session)(configuration)(
        requestArgs
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      const errorCode = error.causeErrors?.code;
      if (errorCode) {
        return makeErrorWithReason({
          type: ErrorContextTypes.CONNECTION_ERROR,
          code: errorCode,
          message: error.causeErrors?.message,
        });
      }
      return makeErrorWithReason({
        type: ErrorContextTypes.API_ERROR,
        error,
      });
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListSystemsResponse | ErrorResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error:\n${
            error.message
          }\nof an incorrect response:\n${stringifyPretty(response)}.`
        );
        progress.report({ increment: 100 });
        return makeErrorWithReason({
          type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
          returnCode: response.body.returnCode,
          error,
        });
      }
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.ENDEVOR_RETURN_CODE_AND_MESSAGES,
        returnCode: parsedResponse.body.returnCode,
        messages: parsedResponse.body.messages,
      });
    }
    try {
      parsedResponse = parseToType(SuccessListSystemsResponse, response);
    } catch (error) {
      logger.trace(
        `${errorMessage} because of error:\n${
          error.message
        }\nof incorrect response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
        returnCode: response.body.returnCode,
        error,
      });
    }
    const systems = parsedResponse.body.data
      .map((system) => {
        try {
          return parseToType(ExternalSystem, system);
        } catch (e) {
          logger.trace(
            `Unable to fetch the system:\n${stringifyPretty(
              system
            )}\nbecause of error in the response:\n${e.message}.`
          );
          return;
        }
      })
      .map((system) => {
        if (!system) return;
        return {
          environment: system.envName,
          stageId: system.stgId,
          system: system.sysName,
          nextSystem: system.nextSys,
        };
      })
      .filter(isDefined);
    progress.report({ increment: 20 });
    return systems;
  };

export const searchForSystemsInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (
    system?: Value
  ): Promise<
    | ReadonlyArray<SystemResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return getAllSystems(logger)(progress)(service)(configuration)(
      SearchStrategies.IN_PLACE
    )({
      environment,
      stageNumber,
      system,
    });
  };

export const searchForSystemsFromEnvironmentStage =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (
    system?: Value
  ): Promise<
    | ReadonlyArray<SystemResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return getAllSystems(logger)(progress)(service)(configuration)(
      SearchStrategies.ALL
    )({
      environment,
      stageNumber,
      system,
    });
  };

export const searchForAllSystems =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (
    system?: Value
  ): Promise<
    | ReadonlyArray<SystemResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return getAllSystems(logger)(progress)(service)(configuration)(
      SearchStrategies.IN_PLACE
    )({
      system,
    });
  };

export const getAllTypes =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  (searchStrategy: SearchStrategies) =>
  async (
    typeSearchParams?: Partial<ElementTypeMapPath>
  ): Promise<
    | ReadonlyArray<ElementTypeResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    const session = toSecuredEndevorSession(logger)(service);
    let searchUpInMap = true;
    let firstOccurrence = 'FIR';
    switch (searchStrategy) {
      case SearchStrategies.IN_PLACE:
        searchUpInMap = false;
        break;
      case SearchStrategies.ALL:
        firstOccurrence = 'ALL';
        break;
      case SearchStrategies.FIRST_FOUND:
        break;
      default:
        throw new UnreachableCaseError(searchStrategy);
    }
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: typeSearchParams?.environment || ANY_VALUE,
      'stage-number': typeSearchParams?.stageNumber || ANY_VALUE,
      system: typeSearchParams?.system || ANY_VALUE,
      type: typeSearchParams?.type || ANY_VALUE,
      search: searchUpInMap,
      return: firstOccurrence,
    };
    const errorMessage = `Unable to fetch the types from the Endevor configuration ${configuration}`;
    const makeErrorWithReason = makeError(errorMessage);
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.listType(session)(configuration)(
        requestArgs
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      const errorCode = error.causeErrors?.code;
      if (errorCode) {
        return makeErrorWithReason({
          type: ErrorContextTypes.CONNECTION_ERROR,
          code: errorCode,
          message: error.causeErrors?.message,
        });
      }
      return makeErrorWithReason({
        type: ErrorContextTypes.API_ERROR,
        error,
      });
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListElementTypesResponse | ErrorResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error:\n${
            error.message
          }\nof incorrect response:\n${stringifyPretty(response)}.`
        );
        progress.report({ increment: 100 });
        return makeErrorWithReason({
          type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
          returnCode: response.body.returnCode,
          error,
        });
      }
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.ENDEVOR_RETURN_CODE_AND_MESSAGES,
        returnCode: parsedResponse.body.returnCode,
        messages: parsedResponse.body.messages,
      });
    }
    try {
      parsedResponse = parseToType(SuccessListElementTypesResponse, response);
    } catch (error) {
      logger.trace(
        `${errorMessage} because of error:\n${
          error.message
        }\nof an incorrect response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
        returnCode: response.body.returnCode,
        error,
      });
    }
    const types = parsedResponse.body.data
      .map((type) => {
        try {
          return parseToType(ExternalType, type);
        } catch (e) {
          logger.trace(
            `Unable to fetch the types:\n${stringifyPretty(
              type
            )}\nbecause of error in the response:\n${e.message}.`
          );
          return;
        }
      })
      .map((type) => {
        if (!type) return;
        return {
          environment: type.envName,
          stageId: type.stgId,
          system: type.sysName,
          type: type.typeName,
          nextType: type.nextType,
        };
      })
      .filter(isDefined);
    progress.report({ increment: 20 });
    return types;
  };

export const searchForTypesInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (
    system?: Value,
    typeName?: Value
  ): Promise<
    | ReadonlyArray<ElementTypeResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return getAllTypes(logger)(progress)(service)(configuration)(
      SearchStrategies.IN_PLACE
    )({
      environment,
      stageNumber,
      system,
      type: typeName,
    });
  };

export const searchForTypesFromEnvironmentStage =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (
    system?: Value,
    typeName?: Value
  ): Promise<
    | ReadonlyArray<ElementTypeResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return getAllTypes(logger)(progress)(service)(configuration)(
      SearchStrategies.ALL
    )({
      environment,
      stageNumber,
      system,
      type: typeName,
    });
  };

export const searchForAllTypes =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (
    system?: Value,
    typeName?: Value
  ): Promise<
    | ReadonlyArray<ElementTypeResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return getAllTypes(logger)(progress)(service)(configuration)(
      SearchStrategies.IN_PLACE
    )({
      system,
      type: typeName,
    });
  };

export const getAllSubSystems =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  (searchStrategy: SearchStrategies) =>
  async (
    subSystemSearchParams?: Partial<SubSystemMapPath>
  ): Promise<
    | ReadonlyArray<SubSystemResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    const session = toSecuredEndevorSession(logger)(service);
    let searchUpInMap = true;
    let firstOccurrence = 'FIR';
    switch (searchStrategy) {
      case SearchStrategies.IN_PLACE:
        searchUpInMap = false;
        break;
      case SearchStrategies.ALL:
        firstOccurrence = 'ALL';
        break;
      case SearchStrategies.FIRST_FOUND:
        break;
      default:
        throw new UnreachableCaseError(searchStrategy);
    }
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: subSystemSearchParams?.environment || ANY_VALUE,
      'stage-number': subSystemSearchParams?.stageNumber || ANY_VALUE,
      system: subSystemSearchParams?.system || ANY_VALUE,
      subsystem: subSystemSearchParams?.subSystem || ANY_VALUE,
      search: searchUpInMap,
      return: firstOccurrence,
    };
    const errorMessage = `Unable to fetch the subsystems from the Endevor configuration ${configuration}`;
    const makeErrorWithReason = makeError(errorMessage);
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.listSubsystem(session)(configuration)(
        requestArgs
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      const errorCode = error.causeErrors?.code;
      if (errorCode) {
        return makeErrorWithReason({
          type: ErrorContextTypes.CONNECTION_ERROR,
          code: errorCode,
          message: error.causeErrors?.message,
        });
      }
      return makeErrorWithReason({
        type: ErrorContextTypes.API_ERROR,
        error,
      });
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListSubSystemsResponse | ErrorResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error:\n${
            error.message
          }\nof incorrect response:\n${stringifyPretty(response)}.`
        );
        progress.report({ increment: 100 });
        return makeErrorWithReason({
          type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
          returnCode: response.body.returnCode,
          error,
        });
      }
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.ENDEVOR_RETURN_CODE_AND_MESSAGES,
        returnCode: parsedResponse.body.returnCode,
        messages: parsedResponse.body.messages,
      });
    }
    try {
      parsedResponse = parseToType(SuccessListSubSystemsResponse, response);
    } catch (error) {
      logger.trace(
        `${errorMessage} because of error:\n${
          error.message
        }\nof an incorrect response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
        returnCode: response.body.returnCode,
        error,
      });
    }
    const subSystems = parsedResponse.body.data
      .map((subSystem) => {
        try {
          return parseToType(ExternalSubSystem, subSystem);
        } catch (e) {
          logger.trace(
            `Unable to fetch the subsystem:\n${stringifyPretty(
              subSystem
            )}\nbecause of error in the response:\n${e.message}.`
          );
          return;
        }
      })
      .map((subSystem) => {
        if (!subSystem) return;
        return {
          environment: subSystem.envName,
          stageId: subSystem.stgId,
          system: subSystem.sysName,
          subSystem: subSystem.sbsName,
          nextSubSystem: subSystem.nextSbs,
        };
      })
      .filter(isDefined);
    progress.report({ increment: 20 });
    return subSystems;
  };

export const searchForSubSystemsInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (
    system?: Value,
    subsystem?: Value
  ): Promise<
    | ReadonlyArray<SubSystemResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return getAllSubSystems(logger)(progress)(service)(configuration)(
      SearchStrategies.IN_PLACE
    )({
      environment,
      stageNumber,
      system,
      subSystem: subsystem,
    });
  };

export const searchForSubSystemsFromEnvironmentStage =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (
    system?: Value,
    subsystem?: Value
  ): Promise<
    | ReadonlyArray<SubSystemResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return getAllSubSystems(logger)(progress)(service)(configuration)(
      SearchStrategies.ALL
    )({
      environment,
      stageNumber,
      system,
      subSystem: subsystem,
    });
  };

export const searchForAllSubSystems =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (
    system?: Value,
    subsystem?: Value
  ): Promise<
    | ReadonlyArray<SubSystemResponseObject>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return getAllSubSystems(logger)(progress)(service)(configuration)(
      SearchStrategies.IN_PLACE
    )({
      system,
      subSystem: subsystem,
    });
  };

export const searchForElements =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  ({
    configuration,
    environment,
    stageNumber,
    system,
    subsystem,
    type,
    element,
  }: ElementSearchLocation) =>
  async (
    searchStrategy: SearchStrategies
  ): Promise<
    | ReadonlyArray<Element>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    const session = toSecuredEndevorSession(logger)(service);
    const allElementInfo = 'ALL';
    let searchUpInMap = true;
    let firstOccurrence = 'FIR';
    switch (searchStrategy) {
      case SearchStrategies.IN_PLACE:
        searchUpInMap = false;
        break;
      case SearchStrategies.ALL:
        firstOccurrence = 'ALL';
        break;
      case SearchStrategies.FIRST_FOUND:
        break;
      default:
        throw new UnreachableCaseError(searchStrategy);
    }
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: environment || ANY_VALUE,
      'stage-number': fromStageNumber(stageNumber),
      system: system || ANY_VALUE,
      subsystem: subsystem || ANY_VALUE,
      type: type || ANY_VALUE,
      element: element || ANY_VALUE,
      data: allElementInfo,
      search: searchUpInMap,
      return: firstOccurrence,
    };
    const errorMessage = `Unable to fetch the elements from ${requestArgs.environment}/${requestArgs['stage-number']}/${requestArgs.system}/${requestArgs.subsystem}/${requestArgs.type}`;
    const makeErrorWithReason = makeError(errorMessage);
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.listElement(session)(configuration)(
        requestArgs
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      const errorCode = error.causeErrors?.code;
      if (errorCode) {
        return makeErrorWithReason({
          type: ErrorContextTypes.CONNECTION_ERROR,
          code: errorCode,
          message: error.causeErrors?.message,
        });
      }
      return makeErrorWithReason({
        type: ErrorContextTypes.API_ERROR,
        error,
      });
    }
    progress.report({ increment: 50 });
    let parsedResponse: SuccessListElementsResponse | ErrorResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error:\n${
            error.message
          }\nof an incorrect response:\n${stringifyPretty(response)}.`
        );
        progress.report({ increment: 100 });
        return makeErrorWithReason({
          type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
          returnCode: response.body.returnCode,
          error,
        });
      }
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.ENDEVOR_RETURN_CODE_AND_MESSAGES,
        returnCode: parsedResponse.body.returnCode,
        messages: parsedResponse.body.messages,
      });
    }
    try {
      parsedResponse = parseToType(SuccessListElementsResponse, response);
    } catch (error) {
      logger.trace(
        `${errorMessage} because of error:\n${
          error.message
        }\nof an incorrect response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
        returnCode: response.body.returnCode,
        error,
      });
    }
    const elements = parsedResponse.body.data
      .map((element) => {
        try {
          return parseToType(ExternalElement, element);
        } catch (e) {
          logger.trace(
            `Unable to fetch the element:\n${stringifyPretty(
              element
            )}\nbecause of error in the response:\n${e.message}.`
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
          name: element.fullElmName,
          extension: element.fileExt ? element.fileExt : undefined,
          lastActionCcid: element.lastActCcid,
          configuration,
        };
      });
    progress.report({ increment: 20 });
    return elements;
  };

export const searchForElementsInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async ({
    configuration,
    environment,
    stageNumber,
    system,
    subsystem,
    type,
    element,
  }: ElementSearchLocation): Promise<
    | ReadonlyArray<Element>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return searchForElements(logger)(progress)(service)({
      configuration,
      environment,
      stageNumber,
      system,
      subsystem,
      type,
      element,
    })(SearchStrategies.IN_PLACE);
  };

export const searchForFirstFoundElements =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async ({
    configuration,
    environment,
    stageNumber,
    system,
    subsystem,
    type,
    element,
  }: ElementSearchLocation): Promise<
    | ReadonlyArray<Element>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return searchForElements(logger)(progress)(service)({
      configuration,
      environment,
      stageNumber,
      system,
      subsystem,
      type,
      element,
    })(SearchStrategies.FIRST_FOUND);
  };

export const searchForAllElements =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async ({
    configuration,
    environment,
    stageNumber,
    system,
    subsystem,
    type,
    element,
  }: ElementSearchLocation): Promise<
    | ReadonlyArray<Element>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  > => {
    return searchForElements(logger)(progress)(service)({
      configuration,
      environment,
      stageNumber,
      system,
      subsystem,
      type,
      element,
    })(SearchStrategies.ALL);
  };

export const printElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async ({
    configuration,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: ElementMapPath): Promise<ElementContent | Error> => {
    const requestParams: ElmSpecDictionary & PrintElmCompDictionary = {
      environment,
      'stage-number': fromStageNumber(stageNumber),
      system,
      subsystem: subSystem,
      type,
      element: name,
    };
    const session = toSecuredEndevorSession(logger)(service);
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.printElement(session)(configuration)(
        requestParams
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} because of error:\n${error.message}`
      );
    }
    progress.report({ increment: 50 });
    if (response.body.returnCode) {
      let parsedResponse: ErrorResponse;
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Unable to provide a failed response reason because of error ${
            e.message
          }\nof an incorrect response ${JSON.stringify(response)}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to print the element ${system}/${subSystem}/${type}/${name} because of incorrect response error:\n${e.message}\nwith response code ${response.body.returnCode}`
        );
      }
      // TODO move messages processing to some util function
      // add extra \n in the beginning of the messages line
      const errorResponseAsString = [
        '',
        ...parsedResponse.body.messages.map((message) => message.trim()),
      ].join('\n');
      const errorMessage = `Unable to print the element ${system}/${subSystem}/${type}/${name} because of response code ${parsedResponse.body.returnCode} with reason:\n${errorResponseAsString}`;
      return getTypedErrorFromEndevorError(
        {
          elementName: name,
          endevorMessage: errorResponseAsString,
        },
        errorMessage
      );
    }
    let parsedResponse: PrintResponse;
    try {
      parsedResponse = parseToType(PrintResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} because of error:\n${
          error.message
        }\nof an incorrect response ${JSON.stringify(response)}.`
      );
      return new Error(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} because of incorrect response error:\n${error.message}`
      );
    }
    const [elementContent] = parsedResponse.body.data;
    if (!elementContent) {
      progress.report({ increment: 100 });
      logger.trace(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} because the content is not presented in the response:\n${stringifyPretty(
          response
        )}.`
      );
      return new Error(
        `Unable to print the element ${system}/${subSystem}/${type}/${name} because of an incorrect response error:\nContent is not presented in the response`
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
    configuration,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: ElementMapPath): Promise<PrintListingResponse> => {
    const requestParams: ElmSpecDictionary & PrintElmCompDictionary = {
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
      response = await EndevorClient.printElement(session)(configuration)(
        requestParams
      );
    } catch (error) {
      const errorCode = error.causeErrors?.code;
      if (errorCode) {
        return {
          status: ResponseStatus.ERROR,
          additionalDetails: {
            error: getTypedErrorFromHttpCode(error.causeErrors?.message),
          },
        };
      }
      progress.report({ increment: 100 });
      return {
        status: ResponseStatus.ERROR,
        additionalDetails: {
          error,
        },
      };
    }
    progress.report({ increment: 50 });
    let parsedResponse: PrintResponse;
    try {
      parsedResponse = parseToType(PrintResponse, response);
    } catch (e) {
      logger.trace(
        `Unable to parse the Endevor response because of an error:\n${
          e.message
        }\nog incorrect response format:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return {
        status: ResponseStatus.ERROR,
        additionalDetails: {
          error: new Error(
            `Unable to parse the Endevor response because of incorrect response error:\n${e.message}`
          ),
        },
      };
    }
    const successHttpStatusStart = '2';
    const updateFailed = !parsedResponse.body.statusCode
      .toString()
      .startsWith(successHttpStatusStart);
    if (updateFailed) {
      logger.trace(
        `Got the Endevor error response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return {
        status: ResponseStatus.ERROR,
        additionalDetails: {
          returnCode: parsedResponse.body.returnCode,
          error: getTypedErrorFromEndevorCode(
            [
              '',
              ...parsedResponse.body.messages.map((message) => message.trim()),
            ].join('\n')
          ),
        },
      };
    }
    const [content] = parsedResponse.body.data;
    if (!content) {
      logger.trace(
        `Got the Endevor error response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return {
        status: ResponseStatus.ERROR,
        additionalDetails: {
          error: new Error(
            `Unable to parse the Endevor response because the content is not presented`
          ),
        },
      };
    }
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      content,
      additionalDetails: {
        returnCode: parsedResponse.body.returnCode,
        message: [
          '',
          ...parsedResponse.body.messages.map((message) => message.trim()),
        ].join('\n'),
      },
    };
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
    configuration,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: ElementMapPath): retrieveElementWithFingerprint =>
  async (
    signoutChangeControlValue?: ActionChangeControlValue,
    overrideSignOut?: OverrideSignOut
  ): Promise<ElementWithFingerprint | SignoutError | Error> => {
    const requestParams: ElmSpecDictionary & RetrieveElmDictionary = {
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
    let response: BaseResponse;
    try {
      response = await EndevorClient.retrieveElement(session)(configuration)(
        requestParams
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of an error:\n${error.message}`
      );
    }
    progressReporter.report({ increment: 50 });
    if (response.body.returnCode) {
      let parsedResponse: ErrorResponse;
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Unable to provide a failed response reason because of error:\n${
            e.message
          }\nof an incorrect response ${stringifyPretty(response)}.`
        );
        progressReporter.report({ increment: 100 });
        return new Error(
          `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of incorrect response error:\n${e.message}\nwith response code ${response.body.returnCode}`
        );
      }
      // TODO move messages processing to some util function
      // add extra \n in the beginning of the messages line
      const errorResponseAsString = [
        '',
        ...parsedResponse.body.messages.map((message) => message.trim()),
      ].join('\n');
      const errorMessage = `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of response code ${parsedResponse.body.returnCode} with reason:\n${errorResponseAsString}`;
      return getTypedErrorFromEndevorError(
        {
          elementName: name,
          endevorMessage: errorResponseAsString,
        },
        errorMessage
      );
    }
    let parsedResponse: SuccessRetrieveResponse;
    try {
      parsedResponse = parseToType(SuccessRetrieveResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of error:\n${
          error.message
        }\nof an incorrect response:\n${stringifyPretty(response)}.`
      );
      return new Error(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of incorrect response error:\n${error.message}`
      );
    }
    const [elementContent] = parsedResponse.body.data;
    if (!elementContent) {
      progressReporter.report({ increment: 100 });
      logger.trace(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because the content is not presented in the response:\n${stringifyPretty(
          response
        )}.`
      );
      return new Error(
        `Unable to retrieve the element ${system}/${subSystem}/${type}/${name} because of an incorrect response error:\nContent is not presented in the response`
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
  async (element: ElementMapPath): Promise<ElementContent | Error> => {
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
  (element: ElementMapPath) =>
  async ({
    signoutChangeControlValue,
    overrideSignOut,
  }: SignOutParams): Promise<ElementContent | SignoutError | Error> => {
    const elementContent = await retrieveElementWithFingerprint(logger)(
      progress
    )(service)(element)(
      signoutChangeControlValue,
      overrideSignOut ? overrideSignOut : false
    );
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
  (element: ElementMapPath) =>
  async ({
    signoutChangeControlValue,
    overrideSignOut,
  }: SignOutParams): Promise<void | SignoutError | Error> => {
    const elementContent = await retrieveElementWithFingerprint(logger)(
      progress
    )(service)(element)(
      signoutChangeControlValue,
      overrideSignOut ? overrideSignOut : false
    );
    if (isError(elementContent)) {
      return elementContent;
    }
  };

export const signInElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async ({
    configuration,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: ElementMapPath): Promise<void | Error> => {
    const session = toSecuredEndevorSession(logger)(service);
    const requestParams: ElmSpecDictionary & SigninElmDictionary = {
      element: name,
      environment,
      'stage-number': stageNumber,
      system,
      subsystem: subSystem,
      type,
    };
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.signinElement(session)(configuration)(
        requestParams
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to sign in the element ${system}/${subSystem}/${type}/${name} because of error:\n${error.message}`
      );
    }
    progress.report({ increment: 50 });
    if (response.body.returnCode) {
      let parsedResponse: ErrorResponse;
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error:\n${
            error.message
          }\nof an incorrect response:\n${JSON.stringify(response, null, 2)}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to sign in the element ${system}/${subSystem}/${type}/${name} because of incorrect response error:\n${error.message}\nwith response code ${response.body.returnCode}`
        );
      }
      progress.report({ increment: 100 });
      // TODO move messages processing to some util function
      // add extra \n in the beginning of the messages line
      const errorResponseAsString = [
        '',
        ...parsedResponse.body.messages.map((message) => message.trim()),
      ].join('\n');
      return new Error(
        `Unable to sign in the element ${system}/${subSystem}/${type}/${name} because of response code ${parsedResponse.body.returnCode} with reason:\n${errorResponseAsString}`
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
  (element: ElementMapPath): retrieveElementWithDependencies =>
  async (
    signoutChangeControlValue?: ActionChangeControlValue
  ): Promise<ElementWithDependenciesWithSignout | SignoutError | Error> => {
    const elementProgressRatio = 4;
    let elementContent: string | Error;
    if (!isDefined(signoutChangeControlValue)) {
      elementContent = await retrieveElementWithoutSignout(logger)(
        toSeveralTasksProgress(progressReporter)(elementProgressRatio)
      )(serviceInstance.service)(element);
    } else {
      elementContent = await retrieveElementWithSignout(logger)(
        toSeveralTasksProgress(progressReporter)(elementProgressRatio)
      )(serviceInstance.service)(element)({ signoutChangeControlValue });
    }
    if (isError(elementContent)) {
      const error = elementContent;
      return error;
    }
    const componentsRequestProgressRatio = 4;
    const components = await retrieveComponentsUsedByElement(logger)(
      toSeveralTasksProgress(progressReporter)(componentsRequestProgressRatio)
    )(serviceInstance.service)(element);
    if (isError(components)) {
      const error = components;
      logger.trace(`${error.message}.`);
      return {
        content: elementContent,
        dependencies: [],
      };
    }
    logger.trace(
      `Element ${element.name} has dependencies: ${stringifyPretty(
        components
      )}.`
    );
    const componentsProgressRatio = 2;
    const componentsWithContent = await retrieveComponentsContent(logger)(
      undefined
    )(toSeveralTasksProgress(progressReporter)(componentsProgressRatio))(
      serviceInstance
    )(components);
    return {
      content: elementContent,
      dependencies: componentsWithContent.map(([component, content]) => {
        return [
          {
            ...component,
            // TODO: provide more data from separate element meta request
            lastActionCcid: '',
            // extension: undefined,
            // TODO use full (long) names from the meta request instead
            name: component.name,
          },
          content,
        ];
      }),
    };
  };

export const retrieveElementWithDependenciesWithoutSignout =
  (logger: Logger) =>
  (progressReporter: ProgressReporter) =>
  (serviceInstance: ServiceInstance) =>
  async (element: ElementMapPath): Promise<ElementWithDependencies | Error> => {
    return retrieveElementWithDependencies(logger)(progressReporter)(
      serviceInstance
    )(element)();
  };

export const retrieveElementWithDependenciesWithSignout =
  (logger: Logger) =>
  (progressReporter: ProgressReporter) =>
  (serviceInstance: ServiceInstance) =>
  (element: ElementMapPath) =>
  async ({
    signoutChangeControlValue,
    overrideSignOut,
  }: SignOutParams): Promise<
    ElementWithDependenciesWithSignout | SignoutError | Error
  > => {
    if (overrideSignOut) {
      const elementContent = await retrieveElementWithFingerprint(logger)(
        progressReporter
      )(serviceInstance.service)(element)(signoutChangeControlValue, true);
      if (isError(elementContent)) {
        const error = elementContent;
        return error;
      }
      const componentsRequestProgressRatio = 4;
      const components = await retrieveComponentsUsedByElement(logger)(
        toSeveralTasksProgress(progressReporter)(componentsRequestProgressRatio)
      )(serviceInstance.service)(element);
      if (isError(components)) {
        const error = components;
        logger.trace(`${error.message}.`);
        return {
          content: elementContent.content,
          dependencies: [],
        };
      }
      logger.trace(
        `Element ${element.name} has dependencies: ${stringifyPretty(
          components
        )}.`
      );
      const componentsProgressRatio = 2;
      const componentsWithContent = await retrieveComponentsContent(logger)(
        undefined
      )(toSeveralTasksProgress(progressReporter)(componentsProgressRatio))(
        serviceInstance
      )(components);
      return {
        content: elementContent.content,
        dependencies: componentsWithContent.map(([component, content]) => {
          return [
            {
              ...component,
              // TODO: provide more data from separate element meta request
              lastActionCcid: '',
              // extension: undefined,
              // TODO use full (long) names from the meta request instead
              name: component.name,
            },
            content,
          ];
        }),
      };
    } else {
      return retrieveElementWithDependencies(logger)(progressReporter)(
        serviceInstance
      )(element)(signoutChangeControlValue);
    }
  };

const retrieveComponentsUsedByElement =
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
    configuration,
  }: ElementMapPath): Promise<ReadonlyArray<Component> | Error> => {
    const requestParams: ElmSpecDictionary & QueryAcmDictionary = {
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
      response = await EndevorClient.queryAcmComponent(session)(configuration)(
        requestParams
      );
    } catch (error) {
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve components used by the element ${system}/${subSystem}/${type}/${name} because of error:\n${error.message}`
      );
    }
    progressReporter.report({ increment: 50 });
    let parsedResponse: SuccessListDependenciesResponse | ErrorResponse;
    try {
      parsedResponse = parseToType(SuccessListDependenciesResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to retrieve components used by the element ${system}/${subSystem}/${type}/${name} because of error:\n${
          error.message
        }\nof an incorrect response:\n${stringifyPretty(response)}.`
      );
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (e) {
        logger.trace(
          `Unable to retrieve components used by the element ${system}/${subSystem}/${type}/${name} because of error:\n${
            error.message
          }\nof an incorrect error response:\n${stringifyPretty(response)}.`
        );
        progressReporter.report({ increment: 100 });
        return new Error(
          `Unable to retrieve components used by the element ${system}/${subSystem}/${type}/${name} because of incorrect response error:\n${e.message}\nand:\n${error.message}`
        );
      }
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve components used by the element ${system}/${subSystem}/${type}/${name} because of response code ${
          parsedResponse.body.returnCode
        } with reason:\n${parsedResponse.body.messages.join('\n').trim()}`
      );
    }
    const [elementResponse] = parsedResponse.body.data;
    if (!elementResponse || !elementResponse.components) {
      logger.trace(
        `Unable to retrieve components used by the element ${system}/${subSystem}/${type}/${name} because the components are not presented in the response:\n${JSON.stringify(
          response
        )}.`
      );
      progressReporter.report({ increment: 100 });
      return new Error(
        `Unable to retrieve components used by the element ${system}/${subSystem}/${type}/${name} because of incorrect response error:\nComponents are not presented in the response`
      );
    }
    const dependencies: ExternalComponents = elementResponse.components
      .map((element) => {
        try {
          return parseToType(ExternalComponent, element);
        } catch (error) {
          logger.trace(
            `Unable to retrieve component used by the element ${system}/${subSystem}/${type}/${name} because of error:\n${
              error.message
            }\nof an unexpected response format:\n${stringifyPretty(element)}.`
          );
          return;
        }
      })
      .filter(isDefined);
    progressReporter.report({ increment: 20 });
    return dependencies.map((dependency) => {
      return {
        configuration,
        environment: dependency.envName,
        stageNumber: dependency.stgNum,
        system: dependency.sysName,
        subSystem: dependency.sbsName,
        type: dependency.typeName,
        name: dependency.elmName,
      };
    });
  };

const retrieveComponentsContent =
  (logger: Logger) =>
  (signoutChangeControlValue: ActionChangeControlValue | undefined) =>
  (progressReporter: ProgressReporter) =>
  ({ service, requestPoolMaxSize }: ServiceInstance) =>
  async (
    components: ReadonlyArray<Component>
  ): Promise<
    ReadonlyArray<[Component, ElementContent | SignoutError | Error]>
  > => {
    const dependenciesNumber = components.length;
    const dependenciesReporter: ProgressReporter =
      toSeveralTasksProgress(progressReporter)(dependenciesNumber);
    let contents: (string | Error)[];
    if (!isDefined(signoutChangeControlValue)) {
      contents = await new PromisePool(
        components
          .filter((component) => component.name.trim()) // endevor can return name with space inside
          .map(
            (component) => () =>
              retrieveElementWithoutSignout(logger)(dependenciesReporter)(
                service
              )({
                environment: component.environment,
                stageNumber: component.stageNumber,
                system: component.system,
                subSystem: component.subSystem,
                type: component.type,
                name: component.name,
                configuration: component.configuration,
              })
          ),
        {
          concurrency: requestPoolMaxSize,
        }
      ).start();
    } else {
      contents = await new PromisePool(
        components
          .filter((component) => component.name.trim()) // endevor can return name with space inside
          .map(
            (component) => () =>
              retrieveElementWithSignout(logger)(dependenciesReporter)(service)(
                {
                  environment: component.environment,
                  stageNumber: component.stageNumber,
                  system: component.system,
                  subSystem: component.subSystem,
                  type: component.type,
                  name: component.name,
                  configuration: component.configuration,
                }
              )({ signoutChangeControlValue })
          ),
        {
          concurrency: requestPoolMaxSize,
        }
      ).start();
    }
    return components.map((component, index) => {
      const dependencyContent = contents[index];
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return [component, dependencyContent!];
    });
  };

const generateElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  ({
    configuration,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: ElementMapPath) =>
  ({ ccid: actionCcid, comment }: ActionChangeControlValue) =>
  async ({
    copyBack,
    noSource,
    overrideSignOut,
  }: GenerateParams): Promise<
    void | SignoutError | ProcessorStepMaxRcExceededError | Error
  > => {
    const session = toSecuredEndevorSession(logger)(service);
    const requestParams: ElmSpecDictionary & GenerateElmDictionary = {
      element: name,
      environment,
      'stage-number': stageNumber,
      system,
      subsystem: subSystem,
      type,
      // copy-back + search and nosource options are mutually exclusive according to the Endevor documentation
      search: copyBack && !noSource,
      'copy-back': copyBack && !noSource,
      nosource: noSource,
      'override-signout': overrideSignOut,
      ccid: actionCcid,
      comment,
    };
    progress.report({ increment: 30 });
    let response: BaseResponse;
    try {
      response = await EndevorClient.generateElement(session)(configuration)(
        requestParams
      );
      response = parseToType(BaseResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      return new Error(
        `Unable to generate the element ${system}/${subSystem}/${type}/${name} because of error:\n${error.message}`
      );
    }
    progress.report({ increment: 50 });
    let parsedResponse: ErrorResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error ${
            error.message
          }\nof an incorrect response ${stringifyPretty(response)}.`
        );
        progress.report({ increment: 100 });
        return new Error(
          `Unable to generate the element ${system}/${subSystem}/${type}/${name} because of incorrect response error:\n${error.message}\nwith response code ${response.body.returnCode}`
        );
      }
      // TODO move messages processing to some util function
      // add extra \n in the beginning of the messages line
      const errorResponseAsString = [
        '',
        ...parsedResponse.body.messages.map((message) => message.trim()),
      ].join('\n');
      const errorMessage = `Unable to generate the element ${system}/${subSystem}/${type}/${name} because of response code ${response.body.returnCode} with reason:\n${errorResponseAsString}`;
      const typedError = getTypedErrorFromEndevorError(
        {
          elementName: name,
          endevorMessage: errorResponseAsString,
        },
        errorMessage
      );
      progress.report({ increment: 100 });
      return typedError;
    }
    progress.report({ increment: 20 });
  };

export const generateElementInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (elementToGenerate: ElementMapPath) =>
  (actionChangeControlValue: ActionChangeControlValue) =>
  async (
    signOutParams?: GenerateSignOutParams
  ): Promise<void | SignoutError | ProcessorStepMaxRcExceededError | Error> =>
    generateElement(logger)(progress)(service)(elementToGenerate)(
      actionChangeControlValue
    )({
      copyBack: false,
      noSource: false,
      overrideSignOut: signOutParams?.overrideSignOut
        ? signOutParams.overrideSignOut
        : false,
    });

export const generateElementWithCopyBack =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (targetElementLocation: ElementMapPath) =>
  (actionChangeControlValue: ActionChangeControlValue) =>
  (copyBackParams?: GenerateWithCopyBackParams) =>
  (
    signOutParams?: GenerateSignOutParams
  ): Promise<void | SignoutError | ProcessorStepMaxRcExceededError | Error> =>
    generateElement(logger)(progress)(service)(targetElementLocation)(
      actionChangeControlValue
    )({
      copyBack: true,
      noSource: copyBackParams?.noSource ? copyBackParams.noSource : false,
      overrideSignOut: signOutParams?.overrideSignOut
        ? signOutParams.overrideSignOut
        : false,
    });

export const updateElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  ({
    configuration,
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
  }: ElementWithFingerprint): Promise<InternalUpdateResponse> => {
    const elementData = {
      element: name,
      environment,
      stageNumber,
      system,
      subsystem: subSystem,
      type,
    };
    const session = toSecuredEndevorSession(logger)(service);
    const requestParams = {
      fromFile: Readable.from(content),
      fromFileDescription: SDK_FROM_FILE_DESCRIPTION,
      ccid,
      comment,
      fingerprint,
    };
    progress.report({ increment: 30 });
    let response;
    try {
      response = await AddUpdElement.updElement(
        session,
        configuration,
        elementData,
        requestParams
      );
    } catch (error) {
      progress.report({ increment: 100 });
      const errorCode = error.causeErrors?.code;
      if (errorCode) {
        return {
          status: ResponseStatus.ERROR,
          additionalDetails: {
            error: getTypedErrorFromHttpCode(error.causeErrors?.message),
          },
        };
      }
      return {
        status: ResponseStatus.ERROR,
        additionalDetails: {
          error,
        },
      };
    }
    progress.report({ increment: 50 });
    let parsedResponse: UpdateResponse;
    try {
      parsedResponse = parseToType(UpdateResponse, response);
    } catch (error) {
      progress.report({ increment: 100 });
      logger.trace(`Update response:\n${stringifyPretty(response)}.`);
      return {
        status: ResponseStatus.ERROR,
        additionalDetails: {
          error: new Error(
            `Endevor response parsing is failed because of incorrect response error:\n${error.message}`
          ),
        },
      };
    }
    const successHttpStatusStart = '2';
    const updateFailed = !parsedResponse.body.statusCode
      .toString()
      .startsWith(successHttpStatusStart);
    if (updateFailed) {
      progress.report({ increment: 100 });
      return {
        status: ResponseStatus.ERROR,
        additionalDetails: {
          returnCode: parsedResponse.body.returnCode,
          error: getTypedErrorFromEndevorCode(
            [
              '',
              ...parsedResponse.body.messages.map((message) => message.trim()),
            ].join('\n')
          ),
        },
      };
    }
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      additionalDetails: {
        returnCode: parsedResponse.body.returnCode,
        message: [
          '',
          ...parsedResponse.body.messages.map((message) => message.trim()),
        ].join('\n'),
      },
    };
  };

export const addElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  ({
    configuration,
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    name,
  }: ElementMapPath) =>
  ({ ccid, comment }: ActionChangeControlValue) =>
  async (
    content: string
  ): Promise<void | DuplicateElementError | Error | ConnectionError> => {
    const elementData = {
      element: name,
      environment,
      stageNumber,
      system,
      subsystem: subSystem,
      type,
    };
    const session = toSecuredEndevorSession(logger)(service);
    const requestParams = {
      fromFile: Readable.from(content),
      ccid,
      comment,
    };
    if (isError(requestParams)) {
      const error = requestParams;
      return new Error(
        `Unable to add the element ${system}/${subSystem}/${type}/${name} because of error ${error.message}`
      );
    }
    const errorMessage = `Unable to add element ${system}/${subSystem}/${type}/${name} for Endevor configuration ${configuration}`;
    const makeErrorWithReason = makeError(errorMessage);
    progress.report({ increment: 30 });
    let response;
    try {
      response = await AddUpdElement.addElement(
        session,
        configuration,
        elementData,
        requestParams
      );
    } catch (error) {
      progress.report({ increment: 100 });
      const errorCode = error.causeErrors?.code;
      if (errorCode) {
        return makeErrorWithReason({
          type: ErrorContextTypes.CONNECTION_ERROR,
          code: errorCode,
          message: error.causeErrors?.message,
        });
      }
      return makeErrorWithReason({
        type: ErrorContextTypes.API_ERROR,
        error,
      });
    }
    progress.report({ increment: 50 });
    let parsedResponse: AddResponse;
    if (response.body.returnCode) {
      try {
        parsedResponse = parseToType(ErrorResponse, response);
      } catch (error) {
        logger.trace(
          `Unable to provide a failed response reason because of error:\n${
            error.message
          }\nof an incorrect response:\n${stringifyPretty(response)}.`
        );
        progress.report({ increment: 100 });
        return makeErrorWithReason({
          type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
          returnCode: response.body.returnCode,
          error,
        });
      }
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.ENDEVOR_RETURN_CODE_AND_MESSAGES,
        returnCode: parsedResponse.body.returnCode,
        messages: parsedResponse.body.messages,
      });
    }
    try {
      parsedResponse = parseToType(AddResponse, response);
    } catch (error) {
      logger.trace(
        `Unable to add the element ${system}/${subSystem}/${type}/${name} because of error:\n${
          error.message
        }\nof an incorrect error response:\n${stringifyPretty(response)}.`
      );
      progress.report({ increment: 100 });
      return makeErrorWithReason({
        type: ErrorContextTypes.INCORRECT_RESPONSE_ERROR,
        returnCode: response.body.returnCode,
        error,
      });
    }
    progress.report({ increment: 20 });
  };
