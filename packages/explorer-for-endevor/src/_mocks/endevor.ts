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
import { SignoutError } from '@local/endevor/_doc/Error';

export type PrintingElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (service: Service) => (element: Element) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<
    [Service],
    (element: Element) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<[Element], Promise<ElementContent | Error>>
];

export const mockPrintingElementWith =
  (serviceArg: Service, elementArg: Element) =>
  (mockResult: ElementContent | Error): PrintingElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[element: Element], Promise<ElementContent | Error>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<[Service], (element: Element) => Promise<ElementContent | Error>>()
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
  (mockResults: ReadonlyArray<undefined | Error>): UploadingElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[ElementWithFingerprint], Promise<Error | void>>()
      .withArgs(elementContentArg);
    mockResults.forEach((result, index) => {
      withContentStub.onCall(index).resolves(result);
    });
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

export type AddingElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (content: ElementContent) => Promise<Error | void>
  >,
  sinon.SinonStub<
    [Service],
    (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (content: ElementContent) => Promise<Error | void>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      actionCcid: ChangeControlValue
    ) => (content: ElementContent) => Promise<Error | void>
  >,
  sinon.SinonStub<
    [ChangeControlValue],
    (content: ElementContent) => Promise<Error | void>
  >,
  sinon.SinonStub<[ElementContent], Promise<Error | void>>
];

export const mockAddingElement =
  (
    serviceArg: Service,
    elementArg: ElementMapPath,
    actionCcidArg: ChangeControlValue,
    contentArg: ElementContent
  ) =>
  (mockResults: ReadonlyArray<undefined | Error>): AddingElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[ElementContent], Promise<Error | void>>()
      .withArgs(contentArg);
    mockResults.forEach((result, index) => {
      withContentStub.onCall(index).resolves(result);
    });
    const withActionCcidStub = sinon
      .stub<
        [ChangeControlValue],
        (content: ElementContent) => Promise<Error | void>
      >()
      .withArgs(actionCcidArg)
      .returns(withContentStub);
    const withElementStub = sinon
      .stub<
        [ElementMapPath],
        (
          actionCcid: ChangeControlValue
        ) => (content: ElementContent) => Promise<Error | void>
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
        ) => (content: ElementContent) => Promise<Error | void>
      >()
      .withArgs(serviceArg)
      .returns(withElementStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'addElement')
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

export type RetrieveElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (service: Service) => (element: Element) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<
    [Service],
    (element: Element) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<[Element], Promise<ElementContent | Error>>
];

export const mockRetrieveElementWithoutSignout =
  (serviceArg: Service, elementArg: Element) =>
  (mockResult: ElementContent | Error): RetrieveElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[element: Element], Promise<ElementContent | Error>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<[Service], (element: Element) => Promise<ElementContent | Error>>()
      .withArgs(serviceArg)
      .returns(withContentStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'retrieveElementWithoutSignout')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [generalFunctionStub, withServiceStub, withContentStub];
  };

export type RetrieveElementWithFingerprint = [
  sinon.SinonStub<
    [progressReporter: ProgressReporter],
    (
      service: Service
    ) => (
      element: Element
    ) => (
      signoutChangeControlValue?: ActionChangeControlValue,
      overrideSignOut?: boolean
    ) => Promise<ElementWithFingerprint | SignoutError | Error>
  >,
  sinon.SinonStub<
    [service: Service],
    (
      element: Element
    ) => (
      signoutChangeControlValue?: ActionChangeControlValue,
      overrideSignOut?: boolean
    ) => Promise<ElementWithFingerprint | SignoutError | Error>
  >,
  sinon.SinonStub<
    [element: Element],
    (
      signoutChangeControlValue?: ActionChangeControlValue,
      overrideSignOut?: boolean
    ) => Promise<ElementWithFingerprint | SignoutError | Error>
  >,
  sinon.SinonStub<
    [ActionChangeControlValue?, boolean?],
    Promise<ElementWithFingerprint | SignoutError | Error>
  >
];

export const mockRetrievingElementWithFingerprint =
  (serviceArg: Service, elementArg: Element) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: {
        signoutChangeControlValue: ActionChangeControlValue;
        overrideSignout?: boolean;
      };
      result: ElementWithFingerprint | SignoutError | Error;
    }>
  ): RetrieveElementWithFingerprint => {
    const withSignoutValueStub = sinon.stub<
      [ActionChangeControlValue?, boolean?],
      Promise<ElementWithFingerprint | SignoutError | Error>
    >();
    mockResults.forEach((mockResult) => {
      if (mockResult.signoutArg) {
        if (mockResult.signoutArg.overrideSignout) {
          withSignoutValueStub
            .withArgs(
              mockResult.signoutArg.signoutChangeControlValue,
              mockResult.signoutArg.overrideSignout
            )
            .resolves(mockResult.result);
        } else {
          withSignoutValueStub
            .withArgs(mockResult.signoutArg.signoutChangeControlValue)
            .resolves(mockResult.result);
        }
      } else {
        withSignoutValueStub.withArgs().resolves(mockResult.result);
      }
    });
    const withElementStub = sinon
      .stub<
        [element: Element],
        (
          signoutChangeControlValue?: ActionChangeControlValue,
          overrideSignout?: boolean
        ) => Promise<ElementWithFingerprint | SignoutError | Error>
      >()
      .withArgs(elementArg)
      .returns(withSignoutValueStub);
    const withServiceStub = sinon
      .stub<
        [service: Service],
        (
          element: Element
        ) => (
          signoutChangeControlValue?: ActionChangeControlValue,
          overrideSignout?: boolean
        ) => Promise<ElementWithFingerprint | SignoutError | Error>
      >()
      .withArgs(serviceArg)
      .returns(withElementStub);
    const anyProgressReporter = sinon.match.any;
    const generalFunctionStub = sinon
      .stub(endevor, 'retrieveElementWithFingerprint')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withElementStub,
      withSignoutValueStub,
    ];
  };

type ChangeControlValueType = Readonly<{
  ccid: string;
  comment: string;
}>;
type ActionChangeControlValue = ChangeControlValueType;

type RetrieveElementWithSignoutStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      element: Element
    ) => (
      signoutChangeControlValue: ActionChangeControlValue
    ) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<
    [Service],
    (
      element: Element
    ) => (
      signoutChangeControlValue: ActionChangeControlValue
    ) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<
    [Element],
    (
      signoutChangeControlValue: ActionChangeControlValue
    ) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<[ActionChangeControlValue], Promise<ElementContent | Error>>
];

export const mockRetrieveElementWithSignout =
  (
    serviceArg: Service,
    elementArg: Element,
    signoutChangeControlValueArg: ActionChangeControlValue
  ) =>
  (mockResult: ElementContent | Error): RetrieveElementWithSignoutStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<
        [changeControlValue: ActionChangeControlValue],
        Promise<ElementContent | Error>
      >()
      .withArgs(signoutChangeControlValueArg)
      .returns(Promise.resolve(mockResult));
    const withSignoutChangeControlValueStub = sinon
      .stub<
        [element: Element],
        (
          signoutChangeControlValue: ActionChangeControlValue
        ) => Promise<ElementContent | Error>
      >()
      .withArgs(elementArg)
      .returns(withContentStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          element: Element
        ) => (
          signoutChangeControlValue: ActionChangeControlValue
        ) => Promise<ElementContent | Error>
      >()
      .withArgs(serviceArg)
      .returns(withSignoutChangeControlValueStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'retrieveElementWithSignout')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withSignoutChangeControlValueStub,
      withContentStub,
    ];
  };

type OverrideSignOutElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      element: Element
    ) => (
      signoutChangeControlValue: ActionChangeControlValue
    ) => Promise<void | Error>
  >,
  sinon.SinonStub<
    [Service],
    (
      element: Element
    ) => (
      signoutChangeControlValue: ActionChangeControlValue
    ) => Promise<void | Error>
  >,
  sinon.SinonStub<
    [Element],
    (
      signoutChangeControlValue: ActionChangeControlValue
    ) => Promise<void | Error>
  >,
  sinon.SinonStub<[ChangeControlValue], Promise<void | Error>>
];

export const mockOverrideSignOutElement =
  (
    serviceArg: Service,
    elementArg: Element,
    signoutChangeControlValueArg: ActionChangeControlValue
  ) =>
  (mockResult: void | Error): OverrideSignOutElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<
        [changeControlValue: ActionChangeControlValue],
        Promise<void | Error>
      >()
      .withArgs(signoutChangeControlValueArg)
      .returns(Promise.resolve(mockResult));
    const withSignoutChangeControlValueStub = sinon
      .stub<
        [element: Element],
        (
          signoutChangeControlValue: ActionChangeControlValue
        ) => Promise<void | Error>
      >()
      .withArgs(elementArg)
      .returns(withContentStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          element: Element
        ) => (
          signoutChangeControlValue: ActionChangeControlValue
        ) => Promise<void | Error>
      >()
      .withArgs(serviceArg)
      .returns(withSignoutChangeControlValueStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'overrideSignOutElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withSignoutChangeControlValueStub,
      withContentStub,
    ];
  };

type SignOutElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      element: Element
    ) => (
      signoutChangeControlValue: ActionChangeControlValue
    ) => Promise<void | Error>
  >,
  sinon.SinonStub<
    [Service],
    (
      element: Element
    ) => (
      signoutChangeControlValue: ActionChangeControlValue
    ) => Promise<void | Error>
  >,
  sinon.SinonStub<
    [Element],
    (
      signoutChangeControlValue: ActionChangeControlValue
    ) => Promise<void | Error>
  >,
  sinon.SinonStub<[ChangeControlValue], Promise<void | Error>>
];

export const mockSignOutElement =
  (
    serviceArg: Service,
    elementArg: Element,
    signoutChangeControlValueArg: ActionChangeControlValue
  ) =>
  (mockResult: void | Error): SignOutElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<
        [changeControlValue: ActionChangeControlValue],
        Promise<void | Error>
      >()
      .withArgs(signoutChangeControlValueArg)
      .returns(Promise.resolve(mockResult));
    const withSignoutChangeControlValueStub = sinon
      .stub<
        [element: Element],
        (
          signoutChangeControlValue: ActionChangeControlValue
        ) => Promise<void | Error>
      >()
      .withArgs(elementArg)
      .returns(withContentStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          element: Element
        ) => (
          signoutChangeControlValue: ActionChangeControlValue
        ) => Promise<void | Error>
      >()
      .withArgs(serviceArg)
      .returns(withSignoutChangeControlValueStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'signOutElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withSignoutChangeControlValueStub,
      withContentStub,
    ];
  };

type SignInElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (service: Service) => (element: Element) => Promise<void | Error>
  >,
  sinon.SinonStub<[Service], (element: Element) => Promise<void | Error>>,
  sinon.SinonStub<[Element], Promise<void | Error>>
];

export const mockSignInElement =
  (serviceArg: Service, elementArg: Element) =>
  (mockResult: void | Error): SignInElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[element: Element], Promise<void | Error>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<[Service], (element: Element) => Promise<void | Error>>()
      .withArgs(serviceArg)
      .returns(withContentStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'signInElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [generalFunctionStub, withServiceStub, withContentStub];
  };

export const mockRetrieveElementWithOverrideSignout =
  (
    serviceArg: Service,
    elementArg: Element,
    signoutChangeControlValueArg: ActionChangeControlValue
  ) =>
  (mockResult: ElementContent | Error): RetrieveElementWithSignoutStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<
        [changeControlValue: ActionChangeControlValue],
        Promise<ElementContent | Error>
      >()
      .withArgs(signoutChangeControlValueArg)
      .returns(Promise.resolve(mockResult));
    const withSignoutChangeControlValueStub = sinon
      .stub<
        [element: Element],
        (
          signoutChangeControlValue: ActionChangeControlValue
        ) => Promise<ElementContent | Error>
      >()
      .withArgs(elementArg)
      .returns(withContentStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          element: Element
        ) => (
          signoutChangeControlValue: ActionChangeControlValue
        ) => Promise<ElementContent | Error>
      >()
      .withArgs(serviceArg)
      .returns(withSignoutChangeControlValueStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'retrieveElementWithOverrideSignout')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withSignoutChangeControlValueStub,
      withContentStub,
    ];
  };
