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

import { EventEmitter } from 'vscode';
import { ExternalConfigurationResponse } from '../lspconfig/_doc/Configuration';

type Filename = string;
type Fingerprint = string;
type MemberName = string;
type Content = string;
type Instance = string;

export type ElementInfo = {
  sourceUri?: string;
  environment: string;
  stage: string;
  system: string;
  subsystem: string;
  type: string;
  processorGroup?: string;
  fingerprint?: string;
  element: string;
};

export interface ExternalEndevorApi {
  isEndevorElement: (uri: string) => boolean;
  getEndevorElementInfo: (
    uri: string
  ) => Promise<[ElementInfo, Instance] | Error>;
  listElements: (
    sourceUri: string,
    type: {
      use_map: boolean;
      environment: string;
      stage: string;
      system: string;
      subsystem: string;
      type: string;
    }
  ) => Promise<[Filename, Fingerprint][] | Error>;
  getElement: (
    sourceUri: string,
    type: {
      use_map: boolean;
      environment: string;
      stage: string;
      system: string;
      subsystem: string;
      type: string;
      element: string;
      fingerprint: string;
    }
  ) => Promise<[Content, Fingerprint] | Error>;
  listMembers: (
    sourceUri: string,
    type: {
      dataset: string;
    }
  ) => Promise<MemberName[] | Error>;
  getMember: (
    sourceUri: string,
    type: {
      dataset: string;
      member: string;
    }
  ) => Promise<Content | Error>;
  getConfiguration: (
    sourceUri: string
  ) => Promise<ExternalConfigurationResponse | Error>;
  getElementInvalidateEmitter: () => EventEmitter<ElementInfo[]>;
}
