/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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
import { ServiceLocation, ServiceProtocol, StageNumber } from './_doc/Endevor';
import { Progress, ProgressReporter } from './_doc/Progress';

export const toVersion2Api = (basePath: string) =>
  basePath.includes('EndevorService/rest') ||
  basePath.includes('EndevorService/api/v1')
    ? '/EndevorService/api/v2/'
    : basePath;

export const toEndevorProtocol = (
  protocol: string
): ServiceProtocol | undefined => {
  if (protocol === 'http') return protocol;
  if (protocol === 'http:') return 'http';
  if (protocol === 'https') return protocol;
  if (protocol === 'https:') return 'https';
  return undefined;
};

export const toBaseUrl = (endevorUrl: ServiceLocation): string => {
  return (
    endevorUrl.protocol +
    '://' +
    endevorUrl.hostname +
    ':' +
    endevorUrl.port +
    endevorUrl.basePath
  );
};

export const fromBaseUrl = (baseUrl: string): ServiceLocation => {
  const { protocol, hostname, port, pathname } = new URL(baseUrl);
  const defaultProtocol = 'http';
  return {
    protocol: toEndevorProtocol(protocol) ?? defaultProtocol,
    hostname,
    port: parseInt(port),
    basePath: pathname,
  };
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

export const toSeveralTasksProgress = (progressReporter: ProgressReporter) => (
  tasksNumber: number
): ProgressReporter => {
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
