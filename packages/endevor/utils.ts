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

import { URL } from 'url';
import { UnreachableCaseError } from './typeHelpers';
import { ServiceProtocol, StageNumber } from './_doc/Endevor';
import {
  FingerprintMismatchError,
  ChangeRegressionError,
  SignoutError,
  DuplicateElementError,
  ProcessorStepMaxRcExceededError,
  SelfSignedCertificateError,
} from './_doc/Error';
import { Progress, ProgressReporter } from './_doc/Progress';

export const toUrlParms = (
  urlString: string
): Partial<{
  protocol: ServiceProtocol;
  hostname: string;
  port: number;
  pathname: string;
}> => {
  let urlParms;
  try {
    urlParms = new URL(urlString);
  } catch (_e) {
    return {};
  }
  const { protocol, hostname, port, pathname } = urlParms;
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
    key === 'password' || key === 'token' || key === 'base64EncodedAuth'
      ? '*****'
      : value
  );
};

export const isError = <T>(value: T | Error): value is Error => {
  return value instanceof Error;
};

export const isSignoutError = <T>(
  value: T | SignoutError
): value is SignoutError => {
  return value instanceof SignoutError;
};

export const isFingerprintMismatchError = <T>(
  value: T | FingerprintMismatchError
): value is FingerprintMismatchError => {
  return value instanceof FingerprintMismatchError;
};

export const isDuplicateElementError = <T>(
  value: T | DuplicateElementError
): value is DuplicateElementError => {
  return value instanceof DuplicateElementError;
};

export const isChangeRegressionError = <T>(
  value: T | ChangeRegressionError
): value is ChangeRegressionError => {
  return value instanceof ChangeRegressionError;
};

export const isProcessorStepMaxRcExceededError = <T>(
  value: T | ProcessorStepMaxRcExceededError
): value is ProcessorStepMaxRcExceededError => {
  return value instanceof ProcessorStepMaxRcExceededError;
};

export const isSelfSignedCertificateError = <T>(
  value: T | SelfSignedCertificateError
): value is SelfSignedCertificateError => {
  return value instanceof SelfSignedCertificateError;
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

export const getElementExtension = (element: {
  typeName: string;
  fileExt?: string | null;
}): string =>
  element.fileExt
    ? element.fileExt.toLowerCase()
    : element.typeName.toLowerCase();
