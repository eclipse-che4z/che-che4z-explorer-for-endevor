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
  Element,
  EndevorResponse,
  ErrorResponseType,
} from '@local/endevor/_doc/Endevor';
import { Uri } from 'vscode';
import { ElementConnectionDescription } from './Configurations';
import { ElementHistoryData } from '../tree/_doc/ChangesTree';

export type BasicElementUriQuery<T> = Readonly<{
  element: Element;
}> &
  Readonly<T>;

export type ElementChangeUriQuery<T> = BasicElementUriQuery<T> &
  Readonly<{
    vvll: string;
  }>;

export type FragmentType = {
  fragment: string;
};

export type UriFunctions = {
  getConfigurations: (
    elementUri: Uri
  ) => Promise<ElementConnectionDescription | undefined>;
  getHistoryData: (elementUri: Uri) => ElementHistoryData | undefined;
  logActivity?: (
    elementUri: Uri
  ) =>
    | ((
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void)
    | undefined;
};
