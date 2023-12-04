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

import { Element } from '@local/endevor/_doc/Endevor';

export const renderElementAttributes = (
  element: Element,
  warningMessage?: string
) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${element.name} - Details</title>
</head>
<body>
  ${warningMessage ? '<p>&#x26A0;<i> ' + warningMessage + '</i></p>' : ''}
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
      <td> fullElmName </td>
      <td>: ${element.name} </td>
    </tr>
    <tr>
      <td> vvll </td>
      <td>: ${element.vvll} </td>
    </tr>
    <tr>
      <td> fileExt </td>
      <td>: ${element.extension ? element.extension : ''} </td>
    </tr>
    <tr>
      <td> lastActionCcid </td>
      <td>: ${element.lastActionCcid ? element.lastActionCcid : ''} </td>
    </tr>
    <tr>
      <td> noSource </td>
      <td>: ${element.noSource ? 'yes' : 'no'} </td>
    </tr>   
    <tr>
      <td> processorGroup </td>
      <td>: ${element.processorGroup ? element.processorGroup : ''} </td>
    </tr>   
    <tr>
      <td> signoutId </td>
      <td>: ${element.signoutId ? element.signoutId : ''} </td>
    </tr>   
    <tr>
      <td> componentVvll </td>
      <td>: ${element.componentVvll ? element.componentVvll : ''} </td>
    </tr>  
  </table>
</body>
</html>`;
