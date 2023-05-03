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

import { ANY_VALUE } from '@local/endevor/const';
import { Credential, CredentialType } from '@local/endevor/_doc/Credential';
import { Element, ServiceLocation } from '@local/endevor/_doc/Endevor';
import { MarkdownString } from 'vscode';
import { Source } from '../store/storage/_doc/Storage';
import { EndevorId } from '../store/_doc/v2/Store';
import { ElementSearchLocation } from '../_doc/Endevor';
import {
  LocationNode,
  NonExistingLocationNode,
  NonExistingServiceNode,
  ServiceNode,
} from './_doc/ServiceLocationTree';

export const isNonExistingServiceNode = (
  value: ServiceNode
): value is NonExistingServiceNode => {
  return (
    value.type === 'SERVICE_PROFILE/NON_EXISTING' ||
    value.type === 'SERVICE/NON_EXISTING'
  );
};

export const isNonExistingLocationNode = (
  value: LocationNode
): value is NonExistingLocationNode => {
  return (
    value.type === 'LOCATION_PROFILE/NON_EXISTING' ||
    value.type === 'LOCATION/NON_EXISTING'
  );
};

export const toServiceTooltip = (
  {
    serviceId,
    serviceLocation,
    credential,
  }: {
    serviceId: EndevorId;
    serviceLocation?: {
      location: ServiceLocation;
      rejectUnauthorized: boolean;
    };
    credential?: Credential;
  },
  warning?: string
): MarkdownString => {
  return new MarkdownString(
    `
**Connection name:** ${serviceId.name}
${
  serviceId.source === Source.SYNCHRONIZED
    ? `
**Source:** Zowe`
    : ''
}
${
  warning
    ? `
$(warning) *${warning}*`
    : ''
}
${
  serviceLocation?.location
    ? `

***Connection information***
| | |
| :--------- | :----- |
| **Protocol:** | ${serviceLocation.location.protocol} |
| **Host:** | ${serviceLocation.location.hostname} |
| **Port:** | ${serviceLocation.location.port} |
| **Base path:** | ${serviceLocation.location.basePath} |
| **API version:** | ${
        serviceLocation.location.basePath.endsWith('v2') ||
        serviceLocation.location.basePath.endsWith('v2/')
          ? 'V2'
          : 'V1'
      } |
| **Uncertified connections:** | ${
        serviceLocation.rejectUnauthorized ? 'Rejected' : 'Allowed'
      } |`
    : ''
}
${
  credential
    ? `

***Credential information***
| | |
| :--------- | :----- |
| **Type:** | ${
        credential.type === CredentialType.BASE ? 'Basic' : 'Token-based'
      } |
${
  credential.type === CredentialType.BASE
    ? `| **User:** | ${credential.user} |
| **Password:** | ******** |`
    : ''
}`
    : ''
}
`,
    true
  );
};

export const toSearchLocationTooltip = (
  {
    locationId,
    location,
  }: {
    locationId: EndevorId;
    location?: ElementSearchLocation;
  },
  warning?: string
): MarkdownString => {
  return new MarkdownString(
    `
**Inventory location name:** ${locationId.name}
${
  locationId.source === Source.SYNCHRONIZED
    ? `
**Source:** Zowe`
    : ''
}
${
  warning
    ? `
$(warning) *${warning}*`
    : ''
}
${
  location
    ? `

***Inventory location information***
| | |
| :--------- | :----- |
| **Configuration:** | ${location.configuration} |
| **Environment:** | ${
        location.environment && location.environment !== ANY_VALUE
          ? location.environment
          : '*All*'
      } |
| **Stage #:** | ${location.stageNumber ? location.stageNumber : '*All*'} |
| **System:** | ${
        location.system && location.system !== ANY_VALUE
          ? location.system
          : '*All*'
      } |
| **Subsystem:** | ${
        location.subsystem && location.subsystem !== ANY_VALUE
          ? location.subsystem
          : '*All*'
      } |
| **Type:** | ${
        location.type && location.type !== ANY_VALUE ? location.type : '*All*'
      } |
| **Element:** | ${
        location.element && location.element !== ANY_VALUE
          ? location.element
          : '*All*'
      } |
${
  location.ccid || location.comment
    ? `

***Action confirmation values***
| | |
| :--------- | :----- |
${location.ccid ? `| **CCID:** | ${location.ccid} |` : ''}
${location.comment ? `| **Comment:** | ${location.comment} |` : ''}
`
    : ''
}`
    : ''
}`,
    true
  );
};

export const toElementTooltip = (element: Element): MarkdownString => {
  return new MarkdownString(`
**Element name:** ${element.name}${element.noSource ? ' *(no-source)*' : ''}

***Type information***
| | |
| :--------- | :----- |
| **Type:** | ${element.type} |
| **Extension:** | ${element.extension ? element.extension : '*N/A*'}

***Inventory information***
| | |
| :--------- | :----- |
| **Environment:** | ${element.environment} |
| **Stage #:** | ${element.stageNumber} |
| **System:** | ${element.system} |
| **Subsystem:** | ${element.subSystem} |

***Other***
| | |
| :--------- | :----- |
| **Last Action CCID:** | ${
    element.lastActionCcid ? element.lastActionCcid : '*N/A*'
  } |
`);
};
