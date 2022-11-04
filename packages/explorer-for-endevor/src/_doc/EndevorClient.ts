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
  Element,
  EnvironmentStage,
  SubSystem,
  System,
} from '@local/endevor/_doc/Endevor';
import {
  ConnectionError,
  SelfSignedCertificateError,
  WrongCredentialsError,
} from '@local/endevor/_doc/Error';
import { ProgressReporter } from '@local/vscode-wrapper/_doc/window';
import { EndevorId } from '../store/_doc/v2/Store';

export type EndevorClient = Readonly<{
  getAllEnvironmentStages: (
    progress: ProgressReporter
  ) => (
    serviceId: EndevorId
  ) => (
    searchLocationId: EndevorId
  ) => Promise<
    | ReadonlyArray<EnvironmentStage>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  >;
  getAllSystems: (
    progress: ProgressReporter
  ) => (
    serviceId: EndevorId
  ) => (
    searchLocationId: EndevorId
  ) => Promise<
    | ReadonlyArray<System>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  >;
  getAllSubSystems: (
    progress: ProgressReporter
  ) => (
    serviceId: EndevorId
  ) => (
    searchLocationId: EndevorId
  ) => Promise<
    | ReadonlyArray<SubSystem>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  >;
  searchForAllElements: (
    progress: ProgressReporter
  ) => (
    serviceId: EndevorId
  ) => (
    searchLocationId: EndevorId
  ) => Promise<
    | ReadonlyArray<Element>
    | WrongCredentialsError
    | SelfSignedCertificateError
    | ConnectionError
    | Error
  >;
}>;
