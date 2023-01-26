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
import {
  ChangeRegressionError,
  ConnectionError,
  FingerprintMismatchError,
  NoComponentInfoError,
  SelfSignedCertificateError,
  SignoutError,
  WrongCredentialsError,
} from './Error';

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
  V1 = 'v1',
  V2 = 'v2',
}
export type Service = Readonly<{
  location: ServiceLocation;
  credential: Credential;
  rejectUnauthorized: boolean;
  apiVersion?: ServiceApiVersion;
}>;

export type ServiceInstance = Readonly<{
  service: Service;
  // name: string - here should be instance name, but our extension is too profiles oriented
  requestPoolMaxSize: number;
}>;

export type Value = string;
export type StageNumber = '1' | '2';

export type Configuration = Readonly<{
  name: string;
  description: string;
}>;

// We do not use wildcards as a values.
// Every value is uppercased by default, except the instance.
type ConfigurationSearchPath = Readonly<{
  configuration: Value;
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
type ElementSearchPath = ConfigurationSearchPath &
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

export type LastEnvironmentStageResponseObject = Readonly<{
  environment: Value;
  stageNumber: StageNumber;
  stageId: Value;
}>;

export type IntermediateEnvironmentStageResponseObject =
  LastEnvironmentStageResponseObject &
    Readonly<{
      nextEnvironment: Value;
      nextStageNumber: StageNumber;
    }>;

export type EnvironmentStageResponseObject =
  | IntermediateEnvironmentStageResponseObject
  | LastEnvironmentStageResponseObject;

export type SystemMapPath = EnvironmentStageMapPath &
  Readonly<{
    system: Value;
  }>;

export type System = SystemMapPath & {
  nextSystem: Value;
};

export type SystemResponseObject = Readonly<{
  environment: Value;
  stageId: Value;
  system: Value;
  nextSystem: Value;
}>;

export type SubSystemMapPath = SystemMapPath &
  Readonly<{
    subSystem: Value;
  }>;

export type SubSystem = SubSystemMapPath &
  Readonly<{
    nextSubSystem: Value;
  }>;

export type ElementTypeMapPath = SystemMapPath & {
  type: Value;
};

export type ElementType = ElementTypeMapPath &
  Readonly<{
    nextType: Value;
  }>;

export type ElementTypeResponseObject = Readonly<{
  environment: Value;
  stageId: Value;
  system: Value;
  type: Value;
  nextType: Value;
}>;

export type SubSystemResponseObject = Readonly<{
  environment: Value;
  stageId: Value;
  system: Value;
  subSystem: Value;
  nextSubSystem: Value;
}>;

export type ElementMapPath = Readonly<{
  configuration: Value;
}> &
  SubSystemMapPath &
  Readonly<{
    type: Value;
    name: Value;
  }>;

export type Component = ElementMapPath;

export type Element = ElementMapPath &
  Partial<
    Readonly<{
      lastActionCcid: Value;
      extension: Value;
    }>
  >;
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

export type OverrideSignOut = boolean;

export type SignOutParams = Readonly<{
  signoutChangeControlValue: ActionChangeControlValue;
  overrideSignOut?: OverrideSignOut;
}>;

export const enum SearchStrategies {
  IN_PLACE = 'IN_PLACE',
  FIRST_FOUND = 'FIRST_FOUND',
  ALL = 'ALL',
}

// it is private static within the SDK, so we have to copy it :(
export const SDK_FROM_FILE_DESCRIPTION = 'via Zowe CLI command';

export const enum ResponseStatus {
  OK = 'OK',
  ERROR = 'ERROR',
}

export type SuccessUpdateResponse = {
  status: ResponseStatus.OK;
  additionalDetails: Readonly<{
    returnCode: number;
  }> &
    Partial<{
      // can be enhanced to provide similar warning management as we have for the errors
      message: string;
    }>;
};

export type ErrorUpdateResponse = {
  status: ResponseStatus.ERROR;
  additionalDetails: Readonly<
    | {
        error:
          | FingerprintMismatchError
          | ChangeRegressionError
          | SignoutError
          | WrongCredentialsError
          | Error;
        returnCode: number;
      }
    | {
        error: ConnectionError | SelfSignedCertificateError | Error;
      }
  >;
};

export type UpdateResponse = SuccessUpdateResponse | ErrorUpdateResponse;

export type SuccessPrintListingResponse = {
  status: ResponseStatus.OK;
  content: ListingContent;
  additionalDetails: Readonly<{
    returnCode: number;
  }> &
    Partial<{
      // can be enhanced to provide similar warning management as we have for the errors
      message: string;
    }>;
};

export type ErrorPrintListingResponse = {
  status: ResponseStatus.ERROR;
  additionalDetails: Readonly<
    | {
        error: NoComponentInfoError | WrongCredentialsError | Error;
        returnCode: number;
      }
    | {
        error: ConnectionError | SelfSignedCertificateError | Error;
      }
  >;
};

export type PrintListingResponse =
  | SuccessPrintListingResponse
  | ErrorPrintListingResponse;
