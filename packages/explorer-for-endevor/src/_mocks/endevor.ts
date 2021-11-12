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

import * as sinon from 'sinon';
import * as endevor from '../endevor';
import {
  ChangeControlValue,
  Element,
  ElementContent,
  ElementMapPath,
  ElementWithFingerprint,
  Service,
} from '@local/endevor/_doc/Endevor';
import { ProgressReporter } from '@local/endevor/_doc/Progress';

export type PrintingElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (element: Element) => Promise<ElementContent | undefined>
  >,
  sinon.SinonStub<
    [Service],
    (element: Element) => Promise<ElementContent | undefined>
  >,
  sinon.SinonStub<[Element], Promise<ElementContent | undefined>>
];

export const mockPrintingElementWith =
  (serviceArg: Service, elementArg: Element) =>
  (mockResult: ElementContent | undefined): PrintingElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[element: Element], Promise<ElementContent | undefined>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<
        [Service],
        (element: Element) => Promise<ElementContent | undefined>
      >()
      .withArgs(serviceArg)
      .returns(withContentStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'printElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [generalFunctionStub, withServiceStub, withContentStub];
  };

export type UploadingElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementContent: ElementWithFingerprint) => Promise<Error | void>
  >,
  sinon.SinonStub<
    [Service],
    (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementContent: ElementWithFingerprint) => Promise<Error | void>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      actionCcid: ChangeControlValue
    ) => (elementContent: ElementWithFingerprint) => Promise<Error | void>
  >,
  sinon.SinonStub<
    [ChangeControlValue],
    (elementContent: ElementWithFingerprint) => Promise<Error | void>
  >,
  sinon.SinonStub<[ElementWithFingerprint], Promise<Error | void>>
];

export const mockUploadingElementWith =
  (
    serviceArg: Service,
    elementArg: ElementMapPath,
    actionCcidArg: ChangeControlValue,
    elementContentArg: ElementWithFingerprint
  ) =>
  (mockResult?: Error): UploadingElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[ElementWithFingerprint], Promise<Error | void>>()
      .withArgs(elementContentArg)
      .returns(Promise.resolve(mockResult));
    const withActionCcidStub = sinon
      .stub<
        [ChangeControlValue],
        (elementContent: ElementWithFingerprint) => Promise<Error | void>
      >()
      .withArgs(actionCcidArg)
      .returns(withContentStub);
    const withElementStub = sinon
      .stub<
        [ElementMapPath],
        (
          actionCcid: ChangeControlValue
        ) => (elementContent: ElementWithFingerprint) => Promise<Error | void>
      >()
      .withArgs(elementArg)
      .returns(withActionCcidStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          element: ElementMapPath
        ) => (
          actionCcid: ChangeControlValue
        ) => (elementContent: ElementWithFingerprint) => Promise<Error | void>
      >()
      .withArgs(serviceArg)
      .returns(withElementStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'updateElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withElementStub,
      withActionCcidStub,
      withContentStub,
    ];
  };
