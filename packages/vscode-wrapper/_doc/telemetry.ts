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

export type TelemetryProperties = {
  readonly [key: string]: string;
} & {
  propertiesTypeVersion: string;
};

export interface TelemetryMeasurements {
  readonly [key: string]: number;
}

export interface GenericTelemetryReporter {
  sendTelemetryEvent: (
    eventName: string,
    properties?: TelemetryProperties,
    measurements?: TelemetryMeasurements
  ) => void;
  sendTelemetryException: (
    error: Error,
    properties?: TelemetryProperties,
    measurements?: TelemetryMeasurements
  ) => void;
  dispose: () => Promise<unknown>;
}
