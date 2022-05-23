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

import { Credential } from './Credential';
import * as fs from 'fs';
import { SignoutError } from './Error';

export type ServiceProtocol = 'http' | 'https';
export const enum ServiceBasePath {
  LEGACY = '/EndevorService/rest',
  V1 = '/EndevorService/api/v1',
  V2 = '/EndevorService/api/v2',
}
export type ServiceLocation = Readonly<{
  protocol: ServiceProtocol;
  port: number;
  hostname: string;
  basePath: string;
}>;

export const enum ServiceApiVersion {
  UNKNOWN = 'unknown',
  V1 = 'v1',
  V2 = 'v2',
}
export type Service = Readonly<{
  location: ServiceLocation;
  credential: Credential;
  rejectUnauthorized: boolean;
  apiVersion: ServiceApiVersion;
}>;

export type ServiceInstance = Readonly<{
  service: Service;
  // name: string - here should be instance name, but our extension is too profiles oriented
  requestPoolMaxSize: number;
}>;

export type Value = string;
export type StageNumber = '1' | '2';

// We do not use wildcards as a values.
// Every value is uppercased by default, except the instance.
export type InstanceSearchPath = Readonly<{
  instance: Value;
}> &
  Partial<
    Readonly<{
      environment: Value;
      stageNumber: StageNumber;
      system: Value;
      subsystem: Value;
      type: Value;
    }>
  >;
export type ElementSearchPath = InstanceSearchPath &
  Partial<
    Readonly<{
      element: Value;
    }>
  >;

export type ChangeControlValue = Readonly<{
  ccid: Value;
  comment: Value;
}>;
export type ActionChangeControlValue = ChangeControlValue;

export type ElementSearchLocation = ElementSearchPath &
  Partial<ChangeControlValue>;

export type EnvironmentStageMapPath = Readonly<{
  environment: Value;
  stageNumber: StageNumber;
}>;

export type IntermediateEnvironmentStage = EnvironmentStageMapPath &
  Readonly<{
    nextEnvironment: Value;
    nextStageNumber: StageNumber;
  }>;

export type LastEnvironmentStage = EnvironmentStageMapPath;

export type EnvironmentStage =
  | IntermediateEnvironmentStage
  | LastEnvironmentStage;

export type SystemMapPath = EnvironmentStageMapPath &
  Readonly<{
    system: Value;
  }>;

export type System = SystemMapPath & {
  nextSystem: Value;
};

export type SubSystemMapPath = SystemMapPath &
  Readonly<{
    subSystem: Value;
  }>;

export type SubSystem = SubSystemMapPath &
  Readonly<{
    nextSubSystem: Value;
  }>;

export type ElementMapPath = Readonly<{
  instance: Value;
}> &
  SubSystemMapPath &
  Readonly<{
    type: Value;
    name: Value;
  }>;

export type Element = ElementMapPath &
  Readonly<{
    extension: Value;
  }>;
export type ElementContent = string;

export type Dependency = Element;

export type ElementWithDependencies = Readonly<{
  content: ElementContent;
  dependencies: ReadonlyArray<[Dependency, ElementContent | Error]>;
}>;

export type ElementWithDependenciesWithSignout = Readonly<{
  content: ElementContent;
  dependencies: ReadonlyArray<
    [Dependency, ElementContent | SignoutError | Error]
  >;
}>;

export type ElementWithFingerprint = Readonly<{
  content: ElementContent;
  fingerprint: Value;
}>;

export type ListingContent = string;

export type GenerateParams = Readonly<{
  copyBack: boolean;
  noSource: boolean;
  overrideSignOut: boolean;
}>;
export type GenerateWithCopyBackParams = Readonly<{ noSource?: boolean }>;
export type GenerateSignOutParams = Readonly<{
  overrideSignOut?: boolean;
}>;

export type DomainUpdateParams = Readonly<{
  content: ElementContent;
  fingerprint: Value;
  ccid: Value;
  comment: Value;
}>;

export type SdkUpdateParams = Readonly<{
  fingerprint: string;
  fromFile: fs.ReadStream;
  ccid?: string;
  comment?: string;
}>;

export type OverrideSignOut = boolean;

export type SignOutParams = Readonly<{
  signoutChangeControlValue: ActionChangeControlValue;
  overrideSignOut?: OverrideSignOut;
}>;
