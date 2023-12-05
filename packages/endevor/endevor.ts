/*
 * © 2023 Broadcom Inc and/or its subsidiaries; All rights reserved
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
  isDefined,
  stringifyPretty,
  isResponseSuccessful,
  isErrorEndevorResponse,
  toSecuredEndevorSession,
  toEndevorSession,
  toServiceApiVersion,
  incrementPartialProgress,
  getReportsFromParsedResponse,
  isEndevorApiError,
  isEndevorResponseError,
  getSearchStrategies,
} from './utils';
import {
  AddUpdElement,
  AddUpdElmDictionary,
  CreateUpdatePackage,
  DefinePkgDictionary,
  ElmSpecDictionary,
  EncodingDictionary,
  EndevorClient,
  GenerateElmDictionary,
  IElementBasicData,
  ListElmDictionary,
  MoveElmDictionary,
  PrintElmCompDictionary,
  PrintMemberDictionary,
  QueryAcmDictionary,
  RetrieveElmDictionary,
  SigninElmDictionary,
} from '@broadcom/endevor-for-zowe-cli/lib/api';
import { IMemberActionRequestOptions } from '@broadcom/endevor-for-zowe-cli/lib/api/elements/doc/IMemberActionRequestOptions';
import {
  ActionChangeControlValue,
  Component,
  ElementData,
  ElementDataWithFingerprint,
  ElementMapPath,
  Service,
  ServiceLocation,
  OverrideSignOut,
  Value,
  SignOutParams,
  GenerateParams,
  GenerateWithCopyBackParams,
  GenerateSignOutParams,
  ServiceApiVersion,
  SearchStrategies,
  ResponseStatus,
  SystemMapPath,
  EnvironmentStageMapPath,
  SubSystemMapPath,
  ElementTypeMapPath,
  PrintResponse,
  PrintActionTypes,
  GenerateResponse,
  ErrorResponseType,
  AuthenticationTokenResponse,
  EnvironmentStagesResponse,
  SystemsResponse,
  SubSystemsResponse,
  ElementTypesResponse,
  ElementsResponse,
  ConfigurationsResponse,
  ApiVersionResponse,
  AddResponse,
  SignInElementResponse,
  RetrieveElementWithSignoutResponse,
  RetrieveElementWithoutSignoutResponse,
  ComponentsResponse,
  SignoutElementResponse,
  UpdateResponse,
  RetrieveSearchStrategies,
  ProcessorGroupsResponse,
  Dataset,
  MembersResponse,
  Member,
  EndevorApiError,
  EndevorResponseError,
  MoveParams,
  MoveResponse,
  AddResponseErrorType,
  ErrorEndevorAuthorizedResponse,
  ErrorEndevorAuthorizedType,
  UpdateResponseErrorType,
  GenerateResponseErrorType,
  RetrieveElementWithSignoutResponseErrorType,
  PrintResponseErrorType,
  PackageCreateResponse,
  CreatePackageParams,
  PackageInformation,
  PackageSclContent,
  ProcessorGroupValue,
} from './_doc/Endevor';
import { UnreachableCaseError } from './typeHelpers';
import { parseToType, parseToTypeAndConvert } from '@local/type-parser/parser';
import {
  Component as ExternalComponent,
  Element as ExternalElement,
  ComponentsResponse as ExternalComponentsResponse,
  Configuration as ExternalConfiguration,
  Member as ExternalMember,
  RetrieveResponse,
  UpdateResponse as ExternalUpdateResponse,
  AddResponse as ExternalAddResponse,
  EnvironmentStage as ExternalEnvironmentStage,
  SubSystem as ExternalSubSystem,
  System as ExternalSystem,
  ElementType as ExternalElementType,
  ProcessorGroup as ExternalProcessorGroup,
  SignInElementResponse as ExternalSignInElementResponse,
  V1ApiVersionResponse,
  V2ApiVersionResponse,
  PrintResponse as ExternalPrintResponse,
  AuthenticationTokenResponse as ExternalAuthenticationTokenResponse,
  ConfigurationsResponse as ExternalConfigurationsResponse,
  MembersResponse as ExternalMembersResponse,
  EnvironmentStagesResponse as ExternalEnvironmentStagesResponse,
  SystemsResponse as ExternalSystemsResponse,
  SubSystemsResponse as ExternalSubSystemsResponse,
  ElementTypesResponse as ExternalElementTypesResponse,
  ElementsResponse as ExternalElementsResponse,
  MoveResponse as ExternalMoveResponse,
  GenerateResponse as ExternalGenerateResponse,
  ProcessorGroupsResponse as ExternalProcessorGroupResponse,
  PackageCreateResponse as ExternalPackageCreateResponse,
  BaseResponseWithUnknownDataOrNull,
  BaseResponseWithNoData,
} from './_ext/Endevor';
import { Logger } from '@local/extension/_doc/Logger';
import { ANY_VALUE, MS_IN_MIN } from './const';
import { ProgressReporter } from './_doc/Progress';
import { ProposedEndevorClient } from './suggestedApi/endevorClient';
import {
  getAddElementErrorType,
  getAuthorizedEndevorClientErrorResponseType,
  getEndevorClientErrorResponseType,
  getGenerateErrorType,
  getGenericAuthorizedEndevorErrorResponseType,
  getPrintElementErrorType,
  getRetrieveElementWithSignOutElementErrorType,
  getUpdateElementErrorType,
} from './error';
import { CredentialTokenType, CredentialType } from './_doc/Credential';
import * as t from 'io-ts';

const executeEndevorRequest =
  <T extends BaseResponseWithUnknownDataOrNull | BaseResponseWithNoData>(
    logger: Logger
  ) =>
  (progress: ProgressReporter) =>
  async (
    externalType: t.Type<T>,
    endevorRequest: () => Promise<unknown>
  ): Promise<T | EndevorApiError | EndevorResponseError> => {
    let response;
    try {
      response = await endevorRequest();
    } catch (error) {
      progress.report({ increment: 100 });
      const messages = error.details?.causeErrors?.message
        ? [error.details.causeErrors.message]
        : error.details?.msg
        ? [error.details.msg]
        : [];
      const connectionCode = error.details?.causeErrors?.code;
      const httpStatusCode = error.details?.httpStatus;
      return new EndevorApiError(messages, connectionCode, httpStatusCode);
    }
    progress.report({ increment: 50 });
    let parsedResponse;
    try {
      parsedResponse = parseToType(externalType, response);
    } catch (error) {
      progress.report({ increment: 100 });
      logger.trace(
        `Unable to parse Endevor response:\n${stringifyPretty(
          response
        )}\nbecause of error:\n${error.message}.`
      );
      return new EndevorResponseError([error.message], undefined, undefined);
    }
    const cleanedResponseMessages = parsedResponse.body.messages.map(
      (message) => message.trim()
    );
    if (!isResponseSuccessful(parsedResponse.body)) {
      progress.report({ increment: 100 });
      return new EndevorResponseError(
        cleanedResponseMessages,
        parsedResponse.body.returnCode,
        getReportsFromParsedResponse(parsedResponse.body.reports)
      );
    }
    parsedResponse.body.messages = cleanedResponseMessages;
    return parsedResponse;
  };

const getErrorEndevorAuthorizedResponse = <
  E extends ErrorResponseType | undefined
>(
  parsedResponse: EndevorApiError | EndevorResponseError,
  getEndevorResponseType?: (
    messages: readonly string[]
  ) => (E extends undefined ? never : E) | ErrorEndevorAuthorizedType
): ErrorEndevorAuthorizedResponse<E> => {
  const errorType = isEndevorApiError(parsedResponse)
    ? getAuthorizedEndevorClientErrorResponseType(
        parsedResponse.details.connectionCode,
        parsedResponse.details.httpStatusCode
      )
    : getEndevorResponseType
    ? getEndevorResponseType(parsedResponse.details.messages)
    : getGenericAuthorizedEndevorErrorResponseType(
        parsedResponse.details.messages
      );
  return {
    status: ResponseStatus.ERROR,
    type: errorType,
    details: parsedResponse.details,
  };
};

export const getApiVersion =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (serviceLocation: ServiceLocation) =>
  async (rejectUnauthorized: boolean): Promise<ApiVersionResponse> => {
    const session = toEndevorSession(serviceLocation)(rejectUnauthorized);
    progress.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.listInstances(session);
    } catch (error) {
      progress.report({ increment: 100 });
      return {
        status: ResponseStatus.ERROR,
        type: getEndevorClientErrorResponseType(
          error.details?.causeErrors?.code
        ),
        details: {
          messages: error.details?.causeErrors?.message
            ? [error.details.causeErrors.message]
            : error.details?.msg
            ? [error.details.msg]
            : [],
          connectionCode: error.details?.errorCause?.code,
          httpStatusCode: error.details?.httpStatus,
        },
      };
    }
    progress.report({ increment: 50 });
    let apiVersion: ServiceApiVersion;
    try {
      parseToType(V2ApiVersionResponse, response);
      apiVersion = ServiceApiVersion.V2;
    } catch (errorV2) {
      try {
        parseToType(V1ApiVersionResponse, response);
        apiVersion = ServiceApiVersion.V1;
      } catch (errorV1) {
        logger.trace(
          `Unable to parse Endevor response:\n${stringifyPretty(
            response
          )}\nbecause of error:\n${errorV2.message}\nand:\n${errorV1.message}.`
        );
        return {
          status: ResponseStatus.ERROR,
          type: ErrorResponseType.GENERIC_ERROR,
          details: {
            messages: [errorV2.message, errorV1.message],
          },
        };
      }
    }
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      result: apiVersion,
    };
  };

export const getConfigurations =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (serviceLocation: ServiceLocation) =>
  async (rejectUnauthorized: boolean): Promise<ConfigurationsResponse> => {
    const session = toEndevorSession(serviceLocation)(rejectUnauthorized);
    progress.report({ increment: 30 });
    const parsedResponse =
      await executeEndevorRequest<ExternalConfigurationsResponse>(logger)(
        progress
      )(ExternalConfigurationsResponse, async () => {
        return EndevorClient.listInstances(session);
      });
    if (isEndevorApiError(parsedResponse)) {
      return {
        status: ResponseStatus.ERROR,
        type: getEndevorClientErrorResponseType(
          parsedResponse.details.connectionCode
        ),
        details: parsedResponse.details,
      };
    }
    if (isEndevorResponseError(parsedResponse)) {
      return {
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.GENERIC_ERROR,
        details: parsedResponse.details,
      };
    }
    const configurations = parsedResponse.body.data
      .map((configuration) => {
        try {
          return parseToType(ExternalConfiguration, configuration);
        } catch (e) {
          logger.trace(
            `Unable to parse Endevor response:\n${stringifyPretty(
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
    return {
      status: ResponseStatus.OK,
      result: configurations,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
      },
    };
  };

export const getAuthenticationToken =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  async (configuration: Value): Promise<AuthenticationTokenResponse> => {
    const session = toSecuredEndevorSession(logger)(service);
    progress.report({ increment: 30 });
    let response;
    try {
      response = await EndevorClient.getAuthToken(session)(configuration);
    } catch (error) {
      progress.report({ increment: 100 });
      return {
        status: ResponseStatus.ERROR,
        type: getAuthorizedEndevorClientErrorResponseType(
          error.details?.causeErrors?.code,
          error.details?.httpStatus
        ),
        details: {
          messages: error.details?.causeErrors?.message
            ? [error.details.causeErrors.message]
            : error.details?.msg
            ? [error.details.msg]
            : [],
          connectionCode: error.details?.errorCause?.code,
          httpStatusCode: error.details?.httpStatus,
        },
      };
    }
    progress.report({ increment: 50 });
    let parsedResponse;
    try {
      parsedResponse = parseToTypeAndConvert(
        ExternalAuthenticationTokenResponse,
        response
      );
    } catch (error) {
      logger.trace(
        `Unable to parse Endevor response:\n${stringifyPretty(
          response
        )}\nbecause of error:\n${error.message}.`
      );
      return {
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.GENERIC_ERROR,
        details: {
          messages: [error.message],
        },
      };
    }
    progress.report({ increment: 20 });
    // TODO move the cleanup and simple data processing to the io-ts conversion
    const cleanedResponseMessages = parsedResponse.body.messages.map(
      (message) => message.trim()
    );
    if (!isResponseSuccessful(parsedResponse.body)) {
      progress.report({ increment: 100 });
      return {
        status: ResponseStatus.ERROR,
        type: getGenericAuthorizedEndevorErrorResponseType(
          cleanedResponseMessages
        ),
        details: {
          messages: cleanedResponseMessages,
          returnCode: parsedResponse.body.returnCode,
        },
      };
    }
    const [authorizationToken] = parsedResponse.body.data;
    return {
      status: ResponseStatus.OK,
      result: authorizationToken
        ? {
            type: CredentialType.TOKEN_BEARER,
            // EWS provides JSON Web Tokens (JWT)
            tokenType: CredentialTokenType.JWT,
            tokenValue: authorizationToken.token,
            // generate an epoch as soon as possible
            // timestamp from the EWS response might be in a different timezone
            tokenCreatedMs: Date.now(),
            tokenValidForMs: authorizationToken.tokenValidFor * MS_IN_MIN,
          }
        : null,
      details: {
        messages: cleanedResponseMessages,
        returnCode: parsedResponse.body.returnCode,
        apiVersion: toServiceApiVersion(
          parsedResponse.headers.version ??
            parsedResponse.headers['api-version']
        ),
      },
    };
  };

export const getAllEnvironmentStages =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (
    environmentSearchParams?: Partial<EnvironmentStageMapPath>
  ): Promise<EnvironmentStagesResponse> => {
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
    progress.report({ increment: 30 });
    const parsedResponse =
      await executeEndevorRequest<ExternalEnvironmentStagesResponse>(logger)(
        progress
      )(ExternalEnvironmentStagesResponse, async () => {
        return EndevorClient.listStage(session)(configuration)(requestArgs);
      });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    // TODO this check is a workaround for the v1 api only, remove when unnecessary
    const environments = (parsedResponse.body.data ?? [])
      .map((environment) => {
        try {
          return parseToType(ExternalEnvironmentStage, environment);
        } catch (error) {
          logger.trace(
            `Unable to parse Endevor response:\n${stringifyPretty(
              environment
            )}\nbecause of an error:\n${error.message}.`
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
    return {
      status: ResponseStatus.OK,
      result: environments,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const getAllSystems =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber, system }: Partial<SystemMapPath>) =>
  async (searchStrategy: SearchStrategies): Promise<SystemsResponse> => {
    const session = toSecuredEndevorSession(logger)(service);
    const { searchUpInMap, firstOccurrence } =
      getSearchStrategies(searchStrategy);
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: environment || ANY_VALUE,
      'stage-number': stageNumber || ANY_VALUE,
      system: system || ANY_VALUE,
      search: searchUpInMap,
      return: firstOccurrence,
    };
    progress.report({ increment: 30 });
    const parsedResponse = await executeEndevorRequest<ExternalSystemsResponse>(
      logger
    )(progress)(ExternalSystemsResponse, async () => {
      return EndevorClient.listSystem(session)(configuration)(requestArgs);
    });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    // TODO this check is a workaround for the v1 api only, remove when unnecessary
    const systems = (parsedResponse.body.data ?? [])
      .map((system) => {
        try {
          return parseToType(ExternalSystem, system);
        } catch (error) {
          logger.trace(
            `Unable to parse Endevor response:\n${stringifyPretty(
              system
            )}\nbecause of error:\n${error.message}.`
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
    return {
      status: ResponseStatus.OK,
      result: systems,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const searchForSystemsInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (system?: Value): Promise<SystemsResponse> => {
    return getAllSystems(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
    })(SearchStrategies.IN_PLACE);
  };

export const searchForSystemsFromEnvironmentStage =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (system?: Value): Promise<SystemsResponse> => {
    return getAllSystems(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
    })(SearchStrategies.ALL);
  };

export const searchForAllSystems =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (system?: Value): Promise<SystemsResponse> => {
    return getAllSystems(logger)(progress)(service)(configuration)({
      system,
    })(SearchStrategies.IN_PLACE);
  };

export const getAllSubSystems =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({
    environment,
    stageNumber,
    system,
    subSystem,
  }: Partial<SubSystemMapPath>) =>
  async (searchStrategy: SearchStrategies): Promise<SubSystemsResponse> => {
    const session = toSecuredEndevorSession(logger)(service);
    const { searchUpInMap, firstOccurrence } =
      getSearchStrategies(searchStrategy);
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: environment || ANY_VALUE,
      'stage-number': stageNumber || ANY_VALUE,
      system: system || ANY_VALUE,
      subsystem: subSystem || ANY_VALUE,
      search: searchUpInMap,
      return: firstOccurrence,
    };
    progress.report({ increment: 30 });
    const parsedResponse =
      await executeEndevorRequest<ExternalSubSystemsResponse>(logger)(progress)(
        ExternalSubSystemsResponse,
        async () => {
          return EndevorClient.listSubsystem(session)(configuration)(
            requestArgs
          );
        }
      );
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    // TODO this check is a workaround for the v1 api only, remove when unnecessary
    const subSystems = (parsedResponse.body.data ?? [])
      .map((subSystem) => {
        try {
          return parseToType(ExternalSubSystem, subSystem);
        } catch (error) {
          logger.trace(
            `Unable to parse Endevor response:\n${stringifyPretty(
              subSystem
            )}\nbecause of error:\n${error.message}.`
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
    return {
      status: ResponseStatus.OK,
      result: subSystems,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const searchForSubSystemsInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (system?: Value, subsystem?: Value): Promise<SubSystemsResponse> => {
    return getAllSubSystems(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
      subSystem: subsystem,
    })(SearchStrategies.IN_PLACE);
  };

export const searchForSubSystemsFromEnvironmentStage =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (system?: Value, subsystem?: Value): Promise<SubSystemsResponse> => {
    return getAllSubSystems(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
      subSystem: subsystem,
    })(SearchStrategies.ALL);
  };

export const searchForAllSubSystems =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (system?: Value, subsystem?: Value): Promise<SubSystemsResponse> => {
    return getAllSubSystems(logger)(progress)(service)(configuration)({
      system,
      subSystem: subsystem,
    })(SearchStrategies.IN_PLACE);
  };

export const getAllElementTypes =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber, system, type }: Partial<ElementTypeMapPath>) =>
  async (searchStrategy: SearchStrategies): Promise<ElementTypesResponse> => {
    const session = toSecuredEndevorSession(logger)(service);
    const { searchUpInMap, firstOccurrence } =
      getSearchStrategies(searchStrategy);
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: environment || ANY_VALUE,
      'stage-number': stageNumber || ANY_VALUE,
      system: system || ANY_VALUE,
      type: type || ANY_VALUE,
      search: searchUpInMap,
      return: firstOccurrence,
    };
    progress.report({ increment: 30 });
    const parsedResponse =
      await executeEndevorRequest<ExternalElementTypesResponse>(logger)(
        progress
      )(ExternalElementTypesResponse, async () => {
        return EndevorClient.listType(session)(configuration)(requestArgs);
      });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    // TODO this check is a workaround for the v1 api only, remove when unnecessary
    const types = (parsedResponse.body.data ?? [])
      .map((type) => {
        try {
          return parseToType(ExternalElementType, type);
        } catch (e) {
          logger.trace(
            `Unable to parse Endevor response:\n${stringifyPretty(
              type
            )}\nbecause of error:\n${e.message}.`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((type) => {
        return {
          environment: type.envName,
          stageNumber: type.stgNum,
          stageId: type.stgId,
          system: type.sysName,
          type: type.typeName,
          nextType: type.nextType,
          description: type.description,
          defaultPrcGrp: type.dfltProcGrp,
          dataFm: type.dataFm === null ? undefined : type.dataFm,
          fileExt: type.fileExt === null ? undefined : type.fileExt,
          lang: type.lang,
        };
      });
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      result: types,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const searchForElementTypesInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: Partial<EnvironmentStageMapPath>) =>
  async (system?: Value, typeName?: Value): Promise<ElementTypesResponse> => {
    return getAllElementTypes(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
      type: typeName,
    })(SearchStrategies.IN_PLACE);
  };

export const searchForElementTypesFromEnvironmentStage =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (system?: Value, typeName?: Value): Promise<ElementTypesResponse> => {
    return getAllElementTypes(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
      type: typeName,
    })(SearchStrategies.ALL);
  };

export const searchForAllElementTypes =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (system?: Value, typeName?: Value): Promise<ElementTypesResponse> => {
    return getAllElementTypes(logger)(progress)(service)(configuration)({
      system,
      type: typeName,
    })(SearchStrategies.IN_PLACE);
  };

export const getProcessorGroupsByType =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  (
    { environment, stageNumber, system, type }: Partial<ElementTypeMapPath>,
    processorGroup?: Value
  ) =>
  async (
    searchStrategy: SearchStrategies
  ): Promise<ProcessorGroupsResponse> => {
    const session = toSecuredEndevorSession(logger)(service);
    const { searchUpInMap, firstOccurrence } =
      getSearchStrategies(searchStrategy);
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: environment || ANY_VALUE,
      'stage-number': stageNumber || ANY_VALUE,
      system: system || ANY_VALUE,
      type: type || ANY_VALUE,
      search: searchUpInMap,
      return: firstOccurrence,
      'proc-group': processorGroup || ANY_VALUE,
    };
    progress.report({ increment: 30 });
    const parsedResponse =
      await executeEndevorRequest<ExternalProcessorGroupResponse>(logger)(
        progress
      )(ExternalProcessorGroupResponse, async () => {
        return EndevorClient.listProcessorGroup(session)(configuration)(
          requestArgs
        );
      });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    // TODO this check is a workaround for the v1 api only, remove when unnecessary
    const processorGroups = (parsedResponse.body.data ?? [])
      .map((procGroup) => {
        try {
          return parseToType(ExternalProcessorGroup, procGroup);
        } catch (e) {
          logger.trace(
            `Unable to parse Endevor response:\n${stringifyPretty(
              procGroup
            )}\nbecause of error:\n${e.message}.`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((procGroup) => {
        return {
          environment: procGroup.envName,
          stageNumber: procGroup.stgNum,
          stageId: procGroup.stgId,
          system: procGroup.sysName,
          type: procGroup.typeName,
          procGroupName: procGroup.procGrpName,
          nextProcGoup: procGroup.nextProcGrp,
          description: procGroup.description,
        };
      });
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      result: processorGroups,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const searchForProcessorGroupsInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (
    typeMap: Partial<ElementTypeMapPath>,
    procGroupName?: Value
  ): Promise<ProcessorGroupsResponse> => {
    return getProcessorGroupsByType(logger)(progress)(service)(configuration)(
      {
        environment: typeMap.environment,
        stageNumber: typeMap.stageNumber,
        system: typeMap.system,
        type: typeMap.type,
      },
      procGroupName
    )(SearchStrategies.IN_PLACE);
  };

const searchForElements =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: element,
  }: Partial<ElementMapPath>) =>
  async (searchStrategy: SearchStrategies): Promise<ElementsResponse> => {
    const session = toSecuredEndevorSession(logger)(service);
    const allElementInfo = 'ALL';
    const { searchUpInMap, firstOccurrence } =
      getSearchStrategies(searchStrategy);
    const requestArgs: ElmSpecDictionary & ListElmDictionary = {
      environment: environment || ANY_VALUE,
      'stage-number': fromStageNumber(stageNumber),
      system: system || ANY_VALUE,
      subsystem: subSystem || ANY_VALUE,
      type: type || ANY_VALUE,
      element: element || ANY_VALUE,
      data: allElementInfo,
      search: searchUpInMap,
      return: firstOccurrence,
    };
    incrementPartialProgress(progress, true)(30);
    const parsedResponse =
      await executeEndevorRequest<ExternalElementsResponse>(logger)(progress)(
        ExternalElementsResponse,
        async () => {
          return EndevorClient.listElement(session)(configuration)(requestArgs);
        }
      );
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    // TODO this check is a workaround for the v1 api only, remove when unnecessary
    const elements = (parsedResponse.body.data ?? [])
      .map((element) => {
        try {
          return parseToType(ExternalElement, element);
        } catch (e) {
          logger.trace(
            `Unable to parse Endevor response:\n${stringifyPretty(
              element
            )}\nbecause of error:\n${e.message}.`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((element) => {
        return {
          id: element.elmName,
          environment: element.envName,
          stageNumber: element.stgNum,
          system: element.sysName,
          subSystem: element.sbsName,
          type: element.typeName,
          name: element.fullElmName,
          extension: element.fileExt ? element.fileExt : undefined,
          lastActionCcid: element.lastActCcid ? element.lastActCcid : undefined,
          noSource: element.nosource === 'Y' ? true : false,
          vvll: element.elmVVLL,
          processorGroup: element.procGrpName,
          signoutId: element.signoutId ? element.signoutId : undefined,
          componentVvll: element.cmpntVVLL ? element.cmpntVVLL : undefined,
          fingerprint: element.fingerprint ? element.fingerprint : undefined,
        };
      });
    incrementPartialProgress(progress)(20);
    return {
      status: ResponseStatus.OK,
      result: elements,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const searchForElementsInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (
    system?: Value,
    subsystem?: Value,
    type?: Value,
    element?: Value
  ): Promise<ElementsResponse> => {
    return searchForElements(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
      subSystem: subsystem,
      type,
      id: element,
    })(SearchStrategies.IN_PLACE);
  };

export const searchForFirstFoundElements =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (
    system?: Value,
    subsystem?: Value,
    type?: Value,
    element?: Value
  ): Promise<ElementsResponse> => {
    return searchForElements(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
      subSystem: subsystem,
      type,
      id: element,
    })(SearchStrategies.FIRST_FOUND);
  };

export const searchForAllElements =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath) =>
  async (
    system?: Value,
    subsystem?: Value,
    type?: Value,
    element?: Value
  ): Promise<ElementsResponse> => {
    return searchForElements(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
      subSystem: subsystem,
      type,
      id: element,
    })(SearchStrategies.ALL);
  };

export const printElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: name,
  }: ElementMapPath): Promise<PrintResponse> => {
    return printElementGeneral(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
      subSystem,
      type,
      id: name,
    })(PrintActionTypes.BROWSE);
  };

export const printListing =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: name,
  }: ElementMapPath): Promise<PrintResponse> => {
    return printElementGeneral(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
      subSystem,
      type,
      id: name,
    })(PrintActionTypes.LISTING);
  };

export const printHistory =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: name,
  }: ElementMapPath): Promise<PrintResponse> => {
    return printElementGeneral(logger)(progress)(service)(configuration)({
      environment,
      stageNumber,
      system,
      subSystem,
      type,
      id: name,
    })(PrintActionTypes.HISTORY);
  };

const printElementGeneral =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: name,
  }: ElementMapPath) =>
  async (printType: PrintActionTypes): Promise<PrintResponse> => {
    const requestParams: ElmSpecDictionary & PrintElmCompDictionary = {
      environment,
      'stage-number': fromStageNumber(stageNumber),
      system,
      subsystem: subSystem,
      type,
      element: name,
      print: printType,
      // disabling headings is not supported for listings
      headings: printType === PrintActionTypes.LISTING,
    };
    const session = toSecuredEndevorSession(logger)(service);
    return printGeneral(logger)(progress)(async () => {
      return EndevorClient.printElement(session)(configuration)(requestParams);
    });
  };

export const printMember =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (member: Member): Promise<PrintResponse> => {
    const requestParams: PrintMemberDictionary & EncodingDictionary = {
      member: member.name,
      'from-dataset': member.dataset.name,
      headings: false,
    };
    const session = toSecuredEndevorSession(logger)(service);
    return printGeneral(logger)(progress)(async () => {
      return EndevorClient.printMember(session)(configuration)(requestParams);
    });
  };

const printGeneral =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  async (endevorRequest: () => Promise<unknown>): Promise<PrintResponse> => {
    progress.report({ increment: 30 });
    const parsedResponse = await executeEndevorRequest<ExternalPrintResponse>(
      logger
    )(progress)(ExternalPrintResponse, async () => {
      return endevorRequest();
    });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<PrintResponseErrorType>(
        parsedResponse,
        getPrintElementErrorType
      );
    }
    const [content] = parsedResponse.body.data ? parsedResponse.body.data : [];
    if (!content) {
      logger.trace(
        `Got the Endevor error response:\n${stringifyPretty(parsedResponse)}.`
      );
      progress.report({ increment: 100 });
      return {
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.GENERIC_ERROR,
        details: {
          messages: [
            `Unable to parse the Endevor response because the content is not present`,
          ],
        },
      };
    }
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      result: content,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

const retrieveElementWithFingerprint =
  (logger: Logger) =>
  (progressReporter: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: name,
  }: ElementMapPath) =>
  (retrieveSearchStrategy: RetrieveSearchStrategies) =>
  async (
    signoutChangeControlValue?: ActionChangeControlValue,
    overrideSignOut?: OverrideSignOut
  ): Promise<RetrieveElementWithSignoutResponse> => {
    let searchUpInMap = true;
    switch (retrieveSearchStrategy) {
      case RetrieveSearchStrategies.IN_PLACE:
        searchUpInMap = false;
        break;
      case RetrieveSearchStrategies.FIRST_FOUND:
        break;
      default:
        throw new UnreachableCaseError(retrieveSearchStrategy);
    }
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
      search: searchUpInMap,
    };
    const session = toSecuredEndevorSession(logger)(service);
    incrementPartialProgress(progressReporter, true)(30);
    const parsedResponse = await executeEndevorRequest<RetrieveResponse>(
      logger
    )(progressReporter)(RetrieveResponse, async () => {
      return ProposedEndevorClient.retrieveElement(session)(configuration)(
        requestParams
      );
    });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<RetrieveElementWithSignoutResponseErrorType>(
        parsedResponse,
        getRetrieveElementWithSignOutElementErrorType
      );
    }
    const elementFingerprint = parsedResponse.headers.fingerprint;
    // It is very unlikely that this condition will ever be sufficed,
    // but because of our types we need to do the check. Sorry.
    if (!elementFingerprint) {
      incrementPartialProgress(progressReporter)(100);
      return {
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.GENERIC_ERROR,
        details: {
          messages: parsedResponse.body.messages.concat([
            'Element fingerprint is missing',
          ]),
          reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
        },
      };
    }
    const [elementContent] = parsedResponse.body.data;
    return {
      status: ResponseStatus.OK,
      result: {
        fingerprint: elementFingerprint,
        content: elementContent ? elementContent.toString() : '',
      },
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const retrieveElementWithoutSignout =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (
    element: ElementMapPath
  ): Promise<RetrieveElementWithoutSignoutResponse> => {
    const retrieveResult = await retrieveElementWithFingerprint(logger)(
      progress
    )(service)(configuration)(element)(RetrieveSearchStrategies.IN_PLACE)();
    if (isErrorEndevorResponse(retrieveResult)) {
      return {
        ...retrieveResult,
        type:
          retrieveResult.type === ErrorResponseType.SIGN_OUT_ENDEVOR_ERROR
            ? ErrorResponseType.GENERIC_ERROR
            : retrieveResult.type,
      };
    }
    return retrieveResult;
  };

export const retrieveElementFirstFound =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (
    element: ElementMapPath
  ): Promise<RetrieveElementWithSignoutResponse> => {
    return retrieveElementWithFingerprint(logger)(progress)(service)(
      configuration
    )(element)(RetrieveSearchStrategies.FIRST_FOUND)();
  };

export const retrieveElementWithSignout =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  (element: ElementMapPath) =>
  async ({
    signoutChangeControlValue,
    overrideSignOut,
  }: SignOutParams): Promise<RetrieveElementWithSignoutResponse> => {
    return retrieveElementWithFingerprint(logger)(progress)(service)(
      configuration
    )(element)(RetrieveSearchStrategies.IN_PLACE)(
      signoutChangeControlValue,
      overrideSignOut ? overrideSignOut : false
    );
  };

export const signOutElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  (element: ElementMapPath) =>
  async ({
    signoutChangeControlValue,
    overrideSignOut,
  }: SignOutParams): Promise<SignoutElementResponse> => {
    const retrieveResponse = await retrieveElementWithFingerprint(logger)(
      progress
    )(service)(configuration)(element)(RetrieveSearchStrategies.IN_PLACE)(
      signoutChangeControlValue,
      overrideSignOut ? overrideSignOut : false
    );
    if (isErrorEndevorResponse(retrieveResponse)) return retrieveResponse;
    return {
      status: retrieveResponse.status,
      details: retrieveResponse.details,
    };
  };

export const signInElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: name,
  }: ElementMapPath): Promise<SignInElementResponse> => {
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
    const parsedResponse =
      await executeEndevorRequest<ExternalSignInElementResponse>(logger)(
        progress
      )(ExternalSignInElementResponse, async () => {
        return EndevorClient.signinElement(session)(configuration)(
          requestParams
        );
      });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const retrieveElementComponents =
  (logger: Logger) =>
  (progressReporter: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: name,
  }: ElementMapPath): Promise<ComponentsResponse> => {
    const requestParams: ElmSpecDictionary & QueryAcmDictionary = {
      environment,
      'stage-number': fromStageNumber(stageNumber),
      system,
      subsystem: subSystem,
      type,
      element: name,
      excCirculars: 'yes',
      excIndirect: 'yes',
    };
    const session = toSecuredEndevorSession(logger)(service);
    incrementPartialProgress(progressReporter, true)(30);
    const parsedResponse =
      await executeEndevorRequest<ExternalComponentsResponse>(logger)(
        progressReporter
      )(ExternalComponentsResponse, async () => {
        return EndevorClient.queryAcmComponent(session)(configuration)(
          requestParams
        );
      });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    // Because of some magic happening in the SDK which alters the
    // endevor web service response we are forced to do this horror.
    const [elementResponse] = parsedResponse.body.data;
    if (!elementResponse || !elementResponse.components) {
      return {
        status: ResponseStatus.ERROR,
        type: ErrorResponseType.GENERIC_ERROR,
        details: {
          messages: parsedResponse.body.messages.concat([
            'Element components not found',
          ]),
          reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
        },
      };
    }
    const components: ReadonlyArray<Component> = elementResponse.components
      .map((component) => {
        try {
          return parseToType(ExternalComponent, component);
        } catch (e) {
          logger.trace(
            `Unable to parse Endevor response:\n${stringifyPretty(
              component
            )}\nbecause of error:\n${e.message}.`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((element) => {
        return {
          id: element.elmName,
          environment: element.envName,
          stageNumber: element.stgNum,
          system: element.sysName,
          subSystem: element.sbsName,
          type: element.typeName,
        };
      });
    incrementPartialProgress(progressReporter)(20);
    return {
      status: ResponseStatus.OK,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
      result: components,
    };
  };

export const moveElements =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: element,
  }: Partial<ElementMapPath>) =>
  ({ ccid, comment }: ActionChangeControlValue) =>
  async ({
    withHistory,
    bypassElementDelete,
    synchronize,
    retainSignout,
    ackElementJump,
  }: MoveParams): Promise<MoveResponse> => {
    const session = toSecuredEndevorSession(logger)(service);
    const requestParams: ElmSpecDictionary & MoveElmDictionary = {
      element: element ?? ANY_VALUE,
      environment: environment ?? ANY_VALUE,
      'stage-number': stageNumber ?? ANY_VALUE,
      system: system ?? ANY_VALUE,
      subsystem: subSystem ?? ANY_VALUE,
      type: type ?? ANY_VALUE,
      'with-history': withHistory ? 'yes' : undefined,
      'bypass-element-delete': bypassElementDelete ? 'yes' : undefined,
      sync: synchronize ? 'yes' : undefined,
      'retain-signout': retainSignout ? 'yes' : undefined,
      jump: ackElementJump ? 'yes' : undefined,
      ccid,
      comment,
    };
    progress.report({ increment: 30 });
    const parsedResponse = await executeEndevorRequest<ExternalMoveResponse>(
      logger
    )(progress)(ExternalMoveResponse, async () => {
      return EndevorClient.moveElement(session)(configuration)(requestParams);
    });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

const generateElements =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: element,
  }: Partial<ElementMapPath>) =>
  ({ ccid, comment }: ActionChangeControlValue) =>
  async ({
    copyBack,
    noSource,
    overrideSignOut,
    processorGroup,
  }: GenerateParams): Promise<GenerateResponse> => {
    const session = toSecuredEndevorSession(logger)(service);
    const requestParams: ElmSpecDictionary & GenerateElmDictionary = {
      element: element ?? ANY_VALUE,
      environment: environment ?? ANY_VALUE,
      'stage-number': stageNumber ?? ANY_VALUE,
      system: system ?? ANY_VALUE,
      subsystem: subSystem ?? ANY_VALUE,
      type: type ?? ANY_VALUE,
      // copy-back + search and nosource options are mutually exclusive according to the Endevor documentation
      search: copyBack && !noSource,
      'copy-back': copyBack && !noSource,
      nosource: noSource,
      'override-signout': overrideSignOut,
      ccid,
      comment,
    };
    if (processorGroup) requestParams['proc-group'] = processorGroup;
    progress.report({ increment: 30 });
    const parsedResponse =
      await executeEndevorRequest<ExternalGenerateResponse>(logger)(progress)(
        ExternalGenerateResponse,
        async () => {
          return EndevorClient.generateElement(session)(configuration)(
            requestParams
          );
        }
      );
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<GenerateResponseErrorType>(
        parsedResponse,
        getGenerateErrorType
      );
    }
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const generateElementInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  (elementSearchParams: ElementMapPath) =>
  (processorGroup: ProcessorGroupValue) =>
  (actionChangeControlParams: ActionChangeControlValue) =>
  async (signOutParams?: GenerateSignOutParams): Promise<GenerateResponse> =>
    generateElements(logger)(progress)(service)(configuration)(
      elementSearchParams
    )(actionChangeControlParams)({
      copyBack: false,
      noSource: false,
      overrideSignOut: signOutParams?.overrideSignOut
        ? signOutParams.overrideSignOut
        : false,
      processorGroup,
    });

export const generateElementWithCopyBack =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  (elementSearchParams: ElementMapPath) =>
  (processorGroup: ProcessorGroupValue) =>
  (actionChangeControlParams: ActionChangeControlValue) =>
  (copyBackParams?: GenerateWithCopyBackParams) =>
  (signOutParams?: GenerateSignOutParams): Promise<GenerateResponse> =>
    generateElements(logger)(progress)(service)(configuration)(
      elementSearchParams
    )(actionChangeControlParams)({
      copyBack: true,
      noSource: copyBackParams?.noSource ? copyBackParams.noSource : false,
      overrideSignOut: signOutParams?.overrideSignOut
        ? signOutParams.overrideSignOut
        : false,
      processorGroup,
    });

export const generateSubSystemElementsInPlace =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  (subSystemSearchParams: SubSystemMapPath) =>
  (actionChangeControlParams: ActionChangeControlValue) =>
  async (signOutParams?: GenerateSignOutParams): Promise<GenerateResponse> =>
    generateElements(logger)(progress)(service)(configuration)(
      subSystemSearchParams
    )(actionChangeControlParams)({
      copyBack: false,
      noSource: false,
      overrideSignOut: signOutParams?.overrideSignOut
        ? signOutParams.overrideSignOut
        : false,
    });

export const updateElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: name,
  }: ElementMapPath) =>
  (processorGroup: ProcessorGroupValue) =>
  ({ ccid, comment }: ActionChangeControlValue) =>
  async ({
    content,
    fingerprint,
    elementFilePath,
  }: ElementDataWithFingerprint): Promise<UpdateResponse> => {
    const elementData = {
      element: name,
      environment,
      stageNumber,
      system,
      subsystem: subSystem,
      type,
    };
    const session = toSecuredEndevorSession(logger)(service);
    const requestParams: AddUpdElmDictionary & { 'from-file-content': string } =
      {
        'from-file': elementFilePath,
        // TODO: use element content directly instead file path when API will support it
        'from-file-content': content,
        'proc-group': processorGroup,
        ccid,
        comment,
        fingerprint,
      };
    progress.report({ increment: 30 });
    const parsedResponse = await executeEndevorRequest<ExternalUpdateResponse>(
      logger
    )(progress)(ExternalUpdateResponse, async () => {
      return AddUpdElement.updElement(
        session,
        configuration,
        elementData,
        requestParams
      );
    });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<UpdateResponseErrorType>(
        parsedResponse,
        getUpdateElementErrorType
      );
    }
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const addElement =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({
    environment,
    stageNumber,
    system,
    subSystem,
    type,
    id: name,
  }: ElementMapPath) =>
  (processorGroup: ProcessorGroupValue) =>
  ({ ccid, comment }: ActionChangeControlValue) =>
  async ({ content, elementFilePath }: ElementData): Promise<AddResponse> => {
    const elementMapPath: IElementBasicData = {
      element: name,
      environment,
      stageNumber,
      system,
      subsystem: subSystem,
      type,
    };
    const session = toSecuredEndevorSession(logger)(service);
    const requestParams: AddUpdElmDictionary & { 'from-file-content': string } =
      {
        'from-file': elementFilePath,
        // TODO: use element content directly instead file path when API will support it
        'from-file-content': content,
        ccid,
        comment,
        'proc-group': processorGroup,
      };
    progress.report({ increment: 30 });
    const parsedResponse = await executeEndevorRequest<ExternalAddResponse>(
      logger
    )(progress)(ExternalAddResponse, async () => {
      return AddUpdElement.addElement(
        session,
        configuration,
        elementMapPath,
        requestParams
      );
    });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<AddResponseErrorType>(
        parsedResponse,
        getAddElementErrorType
      );
    }
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const getMembersFromDataset =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (dataset: Dataset): Promise<MembersResponse> => {
    const session = toSecuredEndevorSession(logger)(service);
    progress.report({ increment: 30 });
    const requestParams: IMemberActionRequestOptions = {
      dsname: dataset.name,
    };
    const parsedResponse = await executeEndevorRequest<ExternalMembersResponse>(
      logger
    )(progress)(ExternalMembersResponse, async () => {
      return ProposedEndevorClient.listDirectory(session)(configuration)(
        requestParams
      );
    });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    const members = parsedResponse.body.data
      .map((member) => {
        try {
          return parseToType(ExternalMember, member);
        } catch (e) {
          logger.trace(
            `Unable to parse Endevor response:\n${stringifyPretty(
              member
            )}\nbecause of error:\n${e.message}.`
          );
          return;
        }
      })
      .filter(isDefined)
      .map((member) => ({
        name: member.mbrName,
        dataset: {
          name: dataset.name,
        },
      }));
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      result: members,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
      },
    };
  };

export const createPackage =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  ({ name, description }: PackageInformation) =>
  ({
    sharable,
    backoutEnabled,
    doNotValidateSCL,
    isEmergency,
  }: CreatePackageParams) =>
  async (sclContent: PackageSclContent): Promise<PackageCreateResponse> => {
    const session = toSecuredEndevorSession(logger)(service);
    const requestParams: DefinePkgDictionary = {
      'from-text': sclContent,
      description,
      promotion: 'yes',
      'validate-scl': doNotValidateSCL ? 'no' : undefined,
      sharable: sharable ? 'yes' : undefined,
      backout: backoutEnabled ? 'yes' : undefined,
      'emergency-package': isEmergency ? 'yes' : undefined,
    };
    progress.report({ increment: 30 });

    const parsedResponse =
      await executeEndevorRequest<ExternalPackageCreateResponse>(logger)(
        progress
      )(ExternalPackageCreateResponse, async () => {
        return CreateUpdatePackage.createPackage(
          session,
          configuration,
          name,
          await CreateUpdatePackage.setupCreateUpdatePackageRequest(
            requestParams,
            true
          )
        );
      });
    if (
      isEndevorApiError(parsedResponse) ||
      isEndevorResponseError(parsedResponse)
    ) {
      progress.report({ increment: 100 });
      return getErrorEndevorAuthorizedResponse<undefined>(parsedResponse);
    }
    progress.report({ increment: 20 });
    return {
      status: ResponseStatus.OK,
      details: {
        messages: parsedResponse.body.messages,
        returnCode: parsedResponse.body.returnCode,
        reportIds: getReportsFromParsedResponse(parsedResponse.body.reports),
      },
    };
  };

export const downloadReportById =
  (logger: Logger) =>
  (progress: ProgressReporter) =>
  (service: Service) =>
  (configuration: Value) =>
  async (reportId: Value): Promise<string | void> => {
    const session = toSecuredEndevorSession(logger)(service);

    progress.report({ increment: 30 });
    let response: string;
    try {
      response = await EndevorClient.downloadReportById(session)(configuration)(
        reportId
      );
      progress.report({ increment: 75 });
    } catch (error) {
      progress.report({ increment: 100 });
      logger.trace(
        `Unable to retrieve the report ${reportId} because of error: ${error}`
      );
      return;
    }
    if (response.startsWith('report not downloaded')) {
      progress.report({ increment: 100 });
      logger.trace(
        `Unable to retrieve the report ${reportId} because of error: ${response}`
      );
      return;
    }
    progress.report({ increment: 100 });
    return response;
  };
