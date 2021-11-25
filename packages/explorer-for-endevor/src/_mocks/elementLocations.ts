/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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

import * as elementLocations from '../element-locations/elementLocations';
import * as sinon from 'sinon';
import { ElementSearchLocation } from '@local/endevor/_doc/Endevor';

type GetEndevorServiceByNameStub = sinon.SinonStub<
  [string],
  Promise<ElementSearchLocation | undefined>
>;

export const mockGetElementLocationByName =
  (name: string) =>
  (mockResult: ElementSearchLocation): GetEndevorServiceByNameStub => {
    return sinon
      .stub(elementLocations, 'getElementLocationByName')
      .withArgs(name)
      .resolves(mockResult);
  };
