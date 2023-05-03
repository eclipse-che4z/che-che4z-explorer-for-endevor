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

import { Logger } from '@local/extension/_doc/Logger';
import { Session } from '@zowe/imperative/lib/rest/src/session/Session';
import { URL } from 'url';
import { TEN_SEC_IN_MS } from './const';
import { UnreachableCaseError } from './typeHelpers';
import { AuthType } from './_doc/Auth';
import { CredentialType, TokenCredential } from './_doc/Credential';
import {
  EnvironmentStageResponseObject,
  ServiceProtocol,
  StageNumber,
  SubSystem,
  SubSystemResponseObject,
  System,
  SystemResponseObject,
  ResponseStatus,
  ElementMapPath,
  ErrorEndevorResponse,
  ErrorResponseType,
  EndevorResponse,
  Service,
  ServiceLocation,
  ServiceApiVersion,
} from './_doc/Endevor';
import { Progress, ProgressReporter } from './_doc/Progress';

export const toUrlParms = (
  urlString: string
): Partial<{
  protocol: ServiceProtocol;
  hostname: string;
  port: number;
  pathname: string;
  username: string;
  password: string;
}> => {
  let urlParms;
  try {
    urlParms = new URL(urlString);
  } catch (_e) {
    return {};
  }
  const { protocol, hostname, port, pathname, username, password } = urlParms;
  const resolvedProtocol = toEndevorProtocol(protocol);
  let resolvedPort = undefined;
  if (port) resolvedPort = parseInt(port);
  else {
    if (resolvedProtocol) {
      switch (resolvedProtocol) {
        case 'http': {
          const defaultHttpPort = 80;
          resolvedPort = defaultHttpPort;
          break;
        }
        case 'https': {
          const defaultHttpsPort = 443;
          resolvedPort = defaultHttpsPort;
          break;
        }
        default:
          throw new UnreachableCaseError(resolvedProtocol);
      }
    }
  }
  return {
    protocol: resolvedProtocol,
    hostname,
    username,
    password,
    port: resolvedPort,
    pathname: pathname === '/' ? undefined : pathname,
  };
};

export const toEndevorProtocol = (
  protocol: string
): ServiceProtocol | undefined => {
  if (protocol === 'http') return protocol;
  if (protocol === 'http:') return 'http';
  if (protocol === 'https') return protocol;
  if (protocol === 'https:') return 'https';
  return undefined;
};

export const toServiceApiVersion = (
  apiVersionString: string | undefined
): ServiceApiVersion | undefined => {
  if (!apiVersionString) return;
  const cleanedApiVersionString = apiVersionString.trim();
  switch (true) {
    case cleanedApiVersionString.startsWith('2'):
      return ServiceApiVersion.V2;
    case cleanedApiVersionString.startsWith('1'):
      return ServiceApiVersion.V1;
    default:
      return;
  }
};

export const toEndevorSession =
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

export const toSecuredEndevorSession =
  (logger: Logger) =>
  ({ location, credential, rejectUnauthorized }: Service): Session => {
    const commonSession =
      toEndevorSession(location)(rejectUnauthorized).ISession;
    let securedSession;
    switch (credential.type) {
      case CredentialType.TOKEN_BEARER:
        securedSession = new Session({
          ...commonSession,
          type: AuthType.BEARER,
          tokenValue: credential.tokenValue,
        });
        break;
      case CredentialType.TOKEN_COOKIE:
        securedSession = new Session({
          ...commonSession,
          type: AuthType.COOKIE,
          tokenType: credential.tokenType,
          tokenValue: credential.tokenValue,
        });
        break;
      case CredentialType.BASE:
        securedSession = new Session({
          ...commonSession,
          type: AuthType.BASIC,
          user: credential.user,
          password: credential.password,
        });
        break;
      default:
        throw new UnreachableCaseError(credential);
    }
    logger.trace(
      `Setup Endevor session:\n${stringifyWithHiddenCredential(
        securedSession.ISession
      )}`
    );
    return securedSession;
  };

export const toEndevorStageNumber = (
  value: string | number
): StageNumber | undefined => {
  if (value.toString() === '1') return '1';
  if (value.toString() === '2') return '2';
  return undefined;
};

export const fromStageNumber = (value: StageNumber | undefined): number => {
  const defaultStageNumber = 1;
  return value ? parseInt(value) : defaultStageNumber;
};

// Endevor base path should contain no slash at the end
export const toCorrectBasePathFormat = (basePath: string) =>
  basePath.replace(/\/$/, '');

export const isDefined = <T>(value: T | undefined): value is T => {
  return value !== undefined;
};

export const stringifyWithHiddenCredential = (value: unknown): string => {
  return JSON.stringify(value, (key, value) =>
    key === 'password' || key === 'tokenValue' || key === 'base64EncodedAuth'
      ? '*****'
      : value
  );
};

export const stringifyPretty = (value: unknown): string => {
  return JSON.stringify(value, null, 2);
};

export const isErrorEndevorResponse = <
  E extends ErrorResponseType | undefined,
  R
>(
  value: EndevorResponse<E, R>
): value is ErrorEndevorResponse<E> => {
  return value.status === ResponseStatus.ERROR;
};

export const toSeveralTasksProgress =
  (progressReporter: ProgressReporter) =>
  (tasksNumber: number): ProgressReporter => {
    return {
      report: (progress: Progress) => {
        if (progress.increment) {
          const progressPerTask = progress.increment / tasksNumber;
          progressReporter.report({
            increment: progressPerTask,
          });
        } else {
          progressReporter.report(progress);
        }
      },
    };
  };

export const subsystemStageIdToStageNumber =
  (environmentStagesMap: ReadonlyArray<EnvironmentStageResponseObject>) =>
  (
    subsystems: ReadonlyArray<SubSystemResponseObject>
  ): ReadonlyArray<SubSystem> => {
    return subsystems
      .map((subsystem) => {
        const stage = environmentStagesMap.find(
          (envStage) =>
            envStage.environment === subsystem.environment &&
            envStage.stageId === subsystem.stageId
        );
        if (!stage) return;
        return {
          environment: subsystem.environment,
          stageNumber: stage.stageNumber,
          system: subsystem.system,
          subSystem: subsystem.subSystem,
          nextSubSystem: subsystem.nextSubSystem,
        };
      })
      .filter(isDefined);
  };

export const systemStageIdToStageNumber =
  (environmentStagesMap: ReadonlyArray<EnvironmentStageResponseObject>) =>
  (systems: ReadonlyArray<SystemResponseObject>): ReadonlyArray<System> => {
    return systems
      .map((system) => {
        const stage = environmentStagesMap.find(
          (envStage) =>
            envStage.environment === system.environment &&
            envStage.stageId === system.stageId
        );
        if (!stage) return;
        return {
          environment: system.environment,
          stageNumber: stage.stageNumber,
          system: system.system,
          nextSystem: system.nextSystem,
        };
      })
      .filter(isDefined);
  };

export const isUnique = <T>(
  value: T,
  index: number,
  self: ReadonlyArray<T>
): boolean => self.indexOf(value) == index;

export const toSearchPath = (elementMapPath: ElementMapPath): string => {
  const env = elementMapPath.environment;
  const stage = elementMapPath.stageNumber;
  const sys = elementMapPath.system;
  const subSys = elementMapPath.subSystem;
  const type = elementMapPath.type;
  return [env, stage, sys, subSys, type].join('/');
};

export const fromEndevorMapPath = (
  elementMapPath: string
): Omit<ElementMapPath, 'id'> | undefined => {
  const [environment, stageNumber, system, subSystem, type] =
    elementMapPath.split('/');
  if (!environment || !system || !subSystem || !type || !stageNumber) {
    return;
  }
  const stageNum = toEndevorStageNumber(stageNumber);
  if (!stageNum) return;
  return {
    type,
    environment,
    system,
    subSystem,
    stageNumber: stageNum,
  };
};

export const isResponseSuccessful = (response: {
  statusCode: number;
}): boolean => {
  const successHttpStatusStart = '2';
  return response.statusCode.toString().startsWith(successHttpStatusStart);
};

export const toEndevorReportId = (value: string): string => {
  const matcher = value.match('^(?:http.*)?/reports/(.*)$');
  if (matcher && matcher[1]) {
    return matcher[1];
  }
  return value;
};

export const isTokenCredentialExpired = (token: TokenCredential): boolean =>
  // decrease token validity time for 10 seconds to lower a probability of immediate invalidation
  Date.now() - token.tokenCreatedMs >= token.tokenValidForMs - TEN_SEC_IN_MS;
