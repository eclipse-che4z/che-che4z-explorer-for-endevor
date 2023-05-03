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

import TelemetryReporter from '@vscode/extension-telemetry';
import { Logger } from '@local/extension/_doc/Logger';
import {
  GenericTelemetryReporter,
  TelemetryMeasurements,
  TelemetryProperties,
} from './_doc/telemetry';

export const createTelemetryReporter =
  (extensionId: string, extensionVersion: string, key: string) =>
  (logger: Logger): GenericTelemetryReporter => {
    if (key) {
      try {
        const reporter = new TelemetryReporter(
          extensionId,
          extensionVersion,
          key
        );
        return makeTelemetryReporter(reporter)(logger);
      } catch (error) {
        logger.trace(
          `Unable to create telemetry reporter because of: ${error.message}`
        );
      }
    }
    return makeTelemetryLogger(logger);
  };

const makeTelemetryReporter =
  (reporter: TelemetryReporter) =>
  (logger: Logger): GenericTelemetryReporter => ({
    sendTelemetryEvent: (
      eventName: string,
      properties?: TelemetryProperties,
      measurements?: TelemetryMeasurements
    ) => {
      try {
        return reporter.sendTelemetryEvent(eventName, properties, measurements);
      } catch (error) {
        logger.trace(
          `Unable to send telemetry event because of: ${error.message}`
        );
      }
      logEvent(logger)(eventName, properties, measurements);
    },
    sendTelemetryException: (
      error: Error,
      properties?: TelemetryProperties,
      measurements?: TelemetryMeasurements
    ) => {
      try {
        return reporter.sendTelemetryException(error, properties, measurements);
      } catch (error) {
        logger.trace(
          `Unable to send telemetry error because of: ${error.message}`
        );
      }
      logError(logger)(error, properties, measurements);
    },
    dispose: () => reporter.dispose(),
  });

const makeTelemetryLogger = (logger: Logger): GenericTelemetryReporter => ({
  sendTelemetryEvent: (
    eventName: string,
    properties?: TelemetryProperties,
    measurements?: TelemetryMeasurements
  ) => logEvent(logger)(eventName, properties, measurements),
  sendTelemetryException: (
    error: Error,
    properties?: TelemetryProperties,
    measurements?: TelemetryMeasurements
  ) => logError(logger)(error, properties, measurements),
  dispose: async () => {
    return;
  },
});

const logEvent =
  (logger: Logger) =>
  (
    eventName: string,
    properties?: TelemetryProperties,
    measurements?: TelemetryMeasurements
  ) => {
    logger.trace(
      `[Telemetry event] ${eventName}${
        properties ? `: ${JSON.stringify(properties)}` : ''
      }${measurements ? `: ${JSON.stringify(measurements)}` : ''}`
    );
  };

const logError =
  (logger: Logger) =>
  (
    error: Error,
    properties?: TelemetryProperties,
    measurements?: TelemetryMeasurements
  ) => {
    logger.trace(
      `[Telemetry error] ${error.message}${
        properties ? `: ${JSON.stringify(properties)}` : ''
      }${measurements ? `: ${JSON.stringify(measurements)}` : ''}`
    );
  };
