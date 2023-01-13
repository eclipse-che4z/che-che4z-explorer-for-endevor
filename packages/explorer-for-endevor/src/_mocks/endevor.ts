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
  SignOutParams,
  GenerateWithCopyBackParams,
  GenerateSignOutParams,
  UpdateResponse,
} from '@local/endevor/_doc/Endevor';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import {
  ProcessorStepMaxRcExceededError,
  SignoutError,
} from '@local/endevor/_doc/Error';

export type PrintingElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (element: ElementMapPath) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<
    [Service],
    (element: ElementMapPath) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<[ElementMapPath], Promise<ElementContent | Error>>
];

export const mockPrintingElementWith =
  (serviceArg: Service, elementArg: ElementMapPath) =>
  (mockResult: ElementContent | Error): PrintingElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[element: ElementMapPath], Promise<ElementContent | Error>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<
        [Service],
        (element: ElementMapPath) => Promise<ElementContent | Error>
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
    ) => (elementContent: ElementWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementContent: ElementWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      actionCcid: ChangeControlValue
    ) => (elementContent: ElementWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [ChangeControlValue],
    (elementContent: ElementWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<[ElementWithFingerprint], Promise<UpdateResponse>>
];

export const mockUploadingElementWith =
  (
    serviceArg: Service,
    elementArg: ElementMapPath,
    actionCcidArg: ChangeControlValue,
    elementContentArg: ElementWithFingerprint
  ) =>
  (mockResults: ReadonlyArray<UpdateResponse>): UploadingElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[ElementWithFingerprint], Promise<UpdateResponse>>()
      .withArgs(elementContentArg);
    mockResults.forEach((result, index) => {
      withContentStub.onCall(index).resolves(result);
    });
    const withActionCcidStub = sinon
      .stub<
        [ChangeControlValue],
        (elementContent: ElementWithFingerprint) => Promise<UpdateResponse>
      >()
      .withArgs(actionCcidArg)
      .returns(withContentStub);
    const withElementStub = sinon
      .stub<
        [ElementMapPath],
        (
          actionCcid: ChangeControlValue
        ) => (elementContent: ElementWithFingerprint) => Promise<UpdateResponse>
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
        ) => (elementContent: ElementWithFingerprint) => Promise<UpdateResponse>
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
    (
      service: Service
    ) => (element: ElementMapPath) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<
    [Service],
    (element: ElementMapPath) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<[ElementMapPath], Promise<ElementContent | Error>>
];

export const mockRetrieveElementWithoutSignout =
  (serviceArg: Service, elementArg: ElementMapPath) =>
  (mockResult: ElementContent | Error): RetrieveElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[element: ElementMapPath], Promise<ElementContent | Error>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<
        [Service],
        (element: ElementMapPath) => Promise<ElementContent | Error>
      >()
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
      element: ElementMapPath
    ) => (
      signoutChangeControlValue?: ActionChangeControlValue,
      overrideSignOut?: boolean
    ) => Promise<ElementWithFingerprint | SignoutError | Error>
  >,
  sinon.SinonStub<
    [service: Service],
    (
      element: ElementMapPath
    ) => (
      signoutChangeControlValue?: ActionChangeControlValue,
      overrideSignOut?: boolean
    ) => Promise<ElementWithFingerprint | SignoutError | Error>
  >,
  sinon.SinonStub<
    [element: ElementMapPath],
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
  (serviceArg: Service, elementArg: ElementMapPath) =>
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
        [element: ElementMapPath],
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
          element: ElementMapPath
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
      element: ElementMapPath
    ) => (signOutParams: SignOutParams) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<
    [Service],
    (
      element: ElementMapPath
    ) => (signOutParams: SignOutParams) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (signOutParams: SignOutParams) => Promise<ElementContent | Error>
  >,
  sinon.SinonStub<[SignOutParams], Promise<ElementContent | Error>>
];

export const mockRetrieveElementWithSignout =
  (serviceArg: Service, elementArg: ElementMapPath) =>
  (
    signOutParamsArg: SignOutParams,
    signOutMockResult: ElementContent | Error
  ) =>
  (
    overrideSignOutParamsArg?: SignOutParams,
    overrideSignOutMockResult?: ElementContent | Error
  ): RetrieveElementWithSignoutStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon.stub<
      [signOutParams: SignOutParams],
      Promise<ElementContent | Error>
    >();
    // stub withArgs for signout
    withContentStub
      .withArgs(signOutParamsArg)
      .returns(Promise.resolve(signOutMockResult));
    // stub withArgs for override signout if selected
    if (overrideSignOutParamsArg) {
      withContentStub
        .withArgs(overrideSignOutParamsArg)
        .returns(
          Promise.resolve(
            overrideSignOutMockResult
              ? overrideSignOutMockResult
              : new Error('the result is not specified')
          )
        );
    }
    const withSignoutParamsStub = sinon
      .stub<
        [element: ElementMapPath],
        (signOutParams: SignOutParams) => Promise<ElementContent | Error>
      >()
      .withArgs(elementArg)
      .returns(withContentStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          element: ElementMapPath
        ) => (signOutParams: SignOutParams) => Promise<ElementContent | Error>
      >()
      .withArgs(serviceArg)
      .returns(withSignoutParamsStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'retrieveElementWithSignout')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withSignoutParamsStub,
      withContentStub,
    ];
  };

type SignOutElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      element: ElementMapPath
    ) => (signOutParams: SignOutParams) => Promise<void | Error | SignoutError>
  >,
  sinon.SinonStub<
    [Service],
    (
      element: ElementMapPath
    ) => (signOutParams: SignOutParams) => Promise<void | Error | SignoutError>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (signOutParams: SignOutParams) => Promise<void | Error | SignoutError>
  >,
  sinon.SinonStub<[SignOutParams], Promise<void | Error | SignoutError>>
];

export const mockSignOutElement =
  (serviceArg: Service, elementArg: ElementMapPath) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: SignOutParams;
      result: void | SignoutError | Error;
    }>
  ): SignOutElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon.stub<
      [signOutParams: SignOutParams],
      Promise<void | Error>
    >();
    mockResults.forEach((mockResult) => {
      if (mockResult.signoutArg) {
        withContentStub
          .withArgs(mockResult.signoutArg)
          .returns(Promise.resolve(mockResult.result));
      } else {
        withContentStub.returns(Promise.resolve(mockResult.result));
      }
    });
    const withSignoutParamsStub = sinon
      .stub<
        [element: ElementMapPath],
        (signOutParams: SignOutParams) => Promise<void | Error>
      >()
      .withArgs(elementArg)
      .returns(withContentStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          element: ElementMapPath
        ) => (signOutParams: SignOutParams) => Promise<void | Error>
      >()
      .withArgs(serviceArg)
      .returns(withSignoutParamsStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'signOutElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withSignoutParamsStub,
      withContentStub,
    ];
  };

type SignInElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (service: Service) => (element: ElementMapPath) => Promise<void | Error>
  >,
  sinon.SinonStub<
    [Service],
    (element: ElementMapPath) => Promise<void | Error>
  >,
  sinon.SinonStub<[ElementMapPath], Promise<void | Error>>
];

export const mockSignInElement =
  (serviceArg: Service, elementArg: ElementMapPath) =>
  (mockResult: void | Error): SignInElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[element: ElementMapPath], Promise<void | Error>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<[Service], (element: ElementMapPath) => Promise<void | Error>>()
      .withArgs(serviceArg)
      .returns(withContentStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'signInElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [generalFunctionStub, withServiceStub, withContentStub];
  };

type GenerateElementInPlaceStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      element: ElementMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<void | Error>
  >,
  sinon.SinonStub<
    [Service],
    (
      element: ElementMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<void | Error>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<void | Error>
  >,
  sinon.SinonStub<
    [ActionChangeControlValue],
    (generateSignOutParams?: GenerateSignOutParams) => Promise<void | Error>
  >,
  sinon.SinonStub<
    [generateSignOutParams?: GenerateSignOutParams],
    Promise<void | Error>
  >
];

export const mockGenerateElementInPlace =
  (
    serviceArg: Service,
    elementArg: Element,
    changeControlValueArg: ActionChangeControlValue
  ) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: GenerateSignOutParams;
      mockResult: void | Error | ProcessorStepMaxRcExceededError | SignoutError;
    }>
  ): GenerateElementInPlaceStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon.stub<
      [generateSignOutParams?: GenerateSignOutParams],
      Promise<void | Error>
    >();
    mockResults.forEach(({ signoutArg, mockResult }) => {
      if (signoutArg) {
        withContentStub
          .withArgs(signoutArg)
          .returns(Promise.resolve(mockResult));
      } else {
        withContentStub.returns(Promise.resolve(mockResult));
      }
    });
    const withSignOutParamsStub = sinon
      .stub<
        [generateChangeControlValue: ActionChangeControlValue],
        (generateSignOutParams?: GenerateSignOutParams) => Promise<void | Error>
      >()
      .withArgs(changeControlValueArg)
      .returns(withContentStub);
    const withChangeControlValueStub = sinon
      .stub<
        [element: ElementMapPath],
        (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<void | Error>
      >()
      .withArgs(elementArg)
      .returns(withSignOutParamsStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          element: ElementMapPath
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<void | Error>
      >()
      .withArgs(serviceArg)
      .returns(withChangeControlValueStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'generateElementInPlace')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withChangeControlValueStub,
      withSignOutParamsStub,
      withContentStub,
    ];
  };

type GenerateElementWithCopyBackStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      element: ElementMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<void | Error | ProcessorStepMaxRcExceededError | SignoutError>
  >,
  sinon.SinonStub<
    [Service],
    (
      element: ElementMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<void | Error | ProcessorStepMaxRcExceededError | SignoutError>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<void | Error | ProcessorStepMaxRcExceededError | SignoutError>
  >,
  sinon.SinonStub<
    [ChangeControlValue],
    (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<void | Error | ProcessorStepMaxRcExceededError | SignoutError>
  >,
  sinon.SinonStub<
    [generateCopyBackParams?: GenerateWithCopyBackParams],
    (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<void | Error | ProcessorStepMaxRcExceededError | SignoutError>
  >,
  sinon.SinonStub<
    [generateSignOutParams?: GenerateSignOutParams],
    Promise<void | Error | ProcessorStepMaxRcExceededError | SignoutError>
  >
];

export const mockGenerateElementWithCopyBack =
  (
    serviceArg: Service,
    elementArg: Element,
    changeControlValueArg: ActionChangeControlValue,
    copyBackParamsArg: GenerateWithCopyBackParams
  ) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: GenerateSignOutParams;
      mockResult: void | Error | ProcessorStepMaxRcExceededError | SignoutError;
    }>
  ): GenerateElementWithCopyBackStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon.stub<
      [generateSignOutParams?: GenerateSignOutParams],
      Promise<void | Error | ProcessorStepMaxRcExceededError | SignoutError>
    >();
    mockResults.forEach(({ signoutArg, mockResult }) => {
      if (signoutArg) {
        withContentStub
          .withArgs(signoutArg)
          .returns(Promise.resolve(mockResult));
      } else {
        withContentStub.returns(Promise.resolve(mockResult));
      }
    });
    const withSignOutParamsStub = sinon
      .stub<
        [generateCopyBackParams?: GenerateWithCopyBackParams],
        (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<
          void | Error | ProcessorStepMaxRcExceededError | SignoutError
        >
      >()
      .withArgs(copyBackParamsArg)
      .returns(withContentStub);
    const withCopyBackParamsStub = sinon
      .stub<
        [generateChangeControlValue: ActionChangeControlValue],
        (
          copyBackParams?: GenerateWithCopyBackParams
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<
          void | Error | ProcessorStepMaxRcExceededError | SignoutError
        >
      >()
      .withArgs(changeControlValueArg)
      .returns(withSignOutParamsStub);
    const withChangeControlValueStub = sinon
      .stub<
        [element: ElementMapPath],
        (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          copyBackParams?: GenerateWithCopyBackParams
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<
          void | Error | ProcessorStepMaxRcExceededError | SignoutError
        >
      >()
      .withArgs(elementArg)
      .returns(withCopyBackParamsStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          element: ElementMapPath
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          copyBackParams?: GenerateWithCopyBackParams
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<
          void | Error | ProcessorStepMaxRcExceededError | SignoutError
        >
      >()
      .withArgs(serviceArg)
      .returns(withChangeControlValueStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'generateElementWithCopyBack')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withChangeControlValueStub,
      withCopyBackParamsStub,
      withSignOutParamsStub,
      withContentStub,
    ];
  };
