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

import { Element } from '@local/endevor/_doc/Endevor';

export const renderElementAttributes = (element: Element) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${element.name} - Details</title>
</head>
<body>
  <table>
    <tr>
      <td> envName </td>
      <td>: ${element.environment} </td>
    </tr>
    <tr>
      <td> stgNum </td>
      <td>: ${element.stageNumber} </td>
    </tr>
    <tr>
      <td> sysName </td>
      <td>: ${element.system} </td>
    </tr>
    <tr>
      <td> sbsName </td>
      <td>: ${element.subSystem} </td>
    </tr>
    <tr>
      <td> typeName </td>
      <td>: ${element.type} </td>
    </tr>
    <tr>
      <td> elmName </td>
      <td>: ${element.name} </td>
    </tr>
    <tr>
      <td> fileExt </td>
      <td>: ${element.extension} </td>
    </tr>
  </table>
</body>
</html>`;
