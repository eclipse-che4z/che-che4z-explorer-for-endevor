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

import { CommandId } from '../commands/id';
import { AddNewProfileNode } from '../_doc/ElementTree';

export const addNewProfileButton: AddNewProfileNode = {
  type: 'BUTTON_ADD_PROFILE',
  label: 'Add a New Profile',
  command: {
    title: 'Add a New Profile',
    command: CommandId.ADD_NEW_SERVICE,
  },
};
