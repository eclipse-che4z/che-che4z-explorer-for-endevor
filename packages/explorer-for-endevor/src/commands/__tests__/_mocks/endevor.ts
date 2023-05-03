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

import * as sinon from 'sinon';
import * as endevor from '../../../endevor';
import {
  ChangeControlValue,
  Element,
  ElementData,
  ElementDataWithFingerprint,
  ElementMapPath,
  Service,
  SignOutParams,
  GenerateWithCopyBackParams,
  GenerateSignOutParams,
  SubSystemMapPath,
  Value,
  GenerateResponse,
  SignInElementResponse,
  RetrieveElementWithoutSignoutResponse,
  RetrieveElementWithSignoutResponse,
  SignoutElementResponse,
  ActionChangeControlValue,
  AddResponse,
  UpdateResponse,
  PrintResponse,
  ElementsResponse,
  EnvironmentStageMapPath,
} from '@local/endevor/_doc/Endevor';
import { ProgressReporter } from '@local/endevor/_doc/Progress';

export type PrintingElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      configuration: Value
    ) => (element: ElementMapPath) => Promise<PrintResponse | Error>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (element: ElementMapPath) => Promise<PrintResponse | Error>
  >,
  sinon.SinonStub<
    [Value],
    (element: ElementMapPath) => Promise<PrintResponse | Error>
  >,
  sinon.SinonStub<[ElementMapPath], Promise<PrintResponse | Error>>
];

export const mockPrintingElementWith =
  (serviceArg: Service, configurationArg: Value, elementArg: ElementMapPath) =>
  (mockResult: PrintResponse): PrintingElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[element: ElementMapPath], Promise<PrintResponse>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withConfigurationStub = sinon
      .stub<[Value], (element: ElementMapPath) => Promise<PrintResponse>>()
      .withArgs(configurationArg)
      .returns(withContentStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          configuration: Value
        ) => (element: ElementMapPath) => Promise<PrintResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'printElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
      withContentStub,
    ];
  };

export type UploadingElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementDataWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementContent: ElementDataWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [Value],
    (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementContent: ElementDataWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      actionCcid: ChangeControlValue
    ) => (elementContent: ElementDataWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [ChangeControlValue],
    (elementContent: ElementDataWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<[ElementDataWithFingerprint], Promise<UpdateResponse>>
];

export const mockUploadingElementWith =
  (
    serviceArg: Service,
    configurationArg: Value,
    elementArg: ElementMapPath,
    actionCcidArg: ChangeControlValue,
    elementContentArg: ElementDataWithFingerprint
  ) =>
  (mockResults: ReadonlyArray<UpdateResponse>): UploadingElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[ElementDataWithFingerprint], Promise<UpdateResponse>>()
      .withArgs(elementContentArg);
    mockResults.forEach((result, index) => {
      withContentStub.onCall(index).resolves(result);
    });
    const withActionCcidStub = sinon
      .stub<
        [ChangeControlValue],
        (elementContent: ElementDataWithFingerprint) => Promise<UpdateResponse>
      >()
      .withArgs(actionCcidArg)
      .returns(withContentStub);
    const withElementStub = sinon
      .stub<
        [ElementMapPath],
        (
          actionCcid: ChangeControlValue
        ) => (
          elementContent: ElementDataWithFingerprint
        ) => Promise<UpdateResponse>
      >()
      .withArgs(elementArg)
      .returns(withActionCcidStub);
    const withConfigurationStub = sinon
      .stub<
        [Value],
        (
          element: ElementMapPath
        ) => (
          actionCcid: ChangeControlValue
        ) => (
          elementContent: ElementDataWithFingerprint
        ) => Promise<UpdateResponse>
      >()
      .withArgs(configurationArg)
      .returns(withElementStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          configuration: Value
        ) => (
          element: ElementMapPath
        ) => (
          actionCcid: ChangeControlValue
        ) => (
          elementContent: ElementDataWithFingerprint
        ) => Promise<UpdateResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'updateElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
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
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementData) => Promise<AddResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementData) => Promise<AddResponse>
  >,
  sinon.SinonStub<
    [Value],
    (
      element: ElementMapPath
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementData) => Promise<AddResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementData) => Promise<AddResponse>
  >,
  sinon.SinonStub<
    [ChangeControlValue],
    (elementData: ElementData) => Promise<AddResponse>
  >,
  sinon.SinonStub<[elementData: ElementData], Promise<AddResponse>>
];

export const mockAddingElement =
  (
    serviceArg: Service,
    configurationArg: Value,
    elementArg: ElementMapPath,
    actionCcidArg: ChangeControlValue,
    elementData: ElementData
  ) =>
  (mockResults: ReadonlyArray<AddResponse>): AddingElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withElementDataStub = sinon
      .stub<[ElementData], Promise<AddResponse>>()
      .withArgs(elementData);
    mockResults.forEach((result, index) => {
      withElementDataStub.onCall(index).resolves(result);
    });
    const withActionCcidStub = sinon
      .stub<
        [ChangeControlValue],
        (elementData: ElementData) => Promise<AddResponse>
      >()
      .withArgs(actionCcidArg)
      .returns(withElementDataStub);
    const withElementStub = sinon
      .stub<
        [ElementMapPath],
        (
          actionCcid: ChangeControlValue
        ) => (elementData: ElementData) => Promise<AddResponse>
      >()
      .withArgs(elementArg)
      .returns(withActionCcidStub);
    const withConfigurationStub = sinon
      .stub<
        [Value],
        (
          element: ElementMapPath
        ) => (
          actionCcid: ChangeControlValue
        ) => (elementData: ElementData) => Promise<AddResponse>
      >()
      .withArgs(configurationArg)
      .returns(withElementStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          configuration: Value
        ) => (
          element: ElementMapPath
        ) => (
          actionCcid: ChangeControlValue
        ) => (elementData: ElementData) => Promise<AddResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'addElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
      withElementStub,
      withActionCcidStub,
      withElementDataStub,
    ];
  };

export type RetrieveElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => Promise<RetrieveElementWithoutSignoutResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => Promise<RetrieveElementWithoutSignoutResponse>
  >,
  sinon.SinonStub<
    [Value],
    (element: ElementMapPath) => Promise<RetrieveElementWithoutSignoutResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    Promise<RetrieveElementWithoutSignoutResponse>
  >
];

export const mockRetrieveElement =
  (serviceArg: Service, configurationArg: Value, elementArg: ElementMapPath) =>
  (mockResult: RetrieveElementWithoutSignoutResponse): RetrieveElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<
        [element: ElementMapPath],
        Promise<RetrieveElementWithoutSignoutResponse>
      >()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withConfigurationStub = sinon
      .stub<
        [Value],
        (
          element: ElementMapPath
        ) => Promise<RetrieveElementWithoutSignoutResponse>
      >()
      .withArgs(configurationArg)
      .returns(withContentStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          configuration: Value
        ) => (
          element: ElementMapPath
        ) => Promise<RetrieveElementWithoutSignoutResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'retrieveElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
      withContentStub,
    ];
  };

type RetrieveElementWithSignoutStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (
      signOutParams: SignOutParams
    ) => Promise<RetrieveElementWithSignoutResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (
      signOutParams: SignOutParams
    ) => Promise<RetrieveElementWithSignoutResponse>
  >,
  sinon.SinonStub<
    [Value],
    (
      element: ElementMapPath
    ) => (
      signOutParams: SignOutParams
    ) => Promise<RetrieveElementWithSignoutResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      signOutParams: SignOutParams
    ) => Promise<RetrieveElementWithSignoutResponse>
  >,
  sinon.SinonStub<[SignOutParams], Promise<RetrieveElementWithSignoutResponse>>
];

export const mockRetrieveElementWithSignout =
  (serviceArg: Service, configurationArg: Value, elementArg: ElementMapPath) =>
  (
    mockResults: ReadonlyArray<{
      signOutParamsArg: SignOutParams;
      signOutMockResult: RetrieveElementWithSignoutResponse;
    }>
  ): RetrieveElementWithSignoutStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon.stub<
      [signOutParams: SignOutParams],
      Promise<RetrieveElementWithSignoutResponse>
    >();
    // stub withArgs for signout
    mockResults.forEach((mockResult) => {
      withContentStub
        .withArgs(mockResult.signOutParamsArg)
        .resolves(mockResult.signOutMockResult);
    });
    const withSignoutParamsStub = sinon
      .stub<
        [element: ElementMapPath],
        (
          signOutParams: SignOutParams
        ) => Promise<RetrieveElementWithSignoutResponse>
      >()
      .withArgs(elementArg)
      .returns(withContentStub);
    const withConfigurationStub = sinon
      .stub<
        [Value],
        (
          element: ElementMapPath
        ) => (
          signOutParams: SignOutParams
        ) => Promise<RetrieveElementWithSignoutResponse>
      >()
      .withArgs(configurationArg)
      .returns(withSignoutParamsStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          configuration: Value
        ) => (
          element: ElementMapPath
        ) => (
          signOutParams: SignOutParams
        ) => Promise<RetrieveElementWithSignoutResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'retrieveElementWithSignout')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
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
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
  >,
  sinon.SinonStub<
    [Value],
    (
      element: ElementMapPath
    ) => (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
  >,
  sinon.SinonStub<[SignOutParams], Promise<SignoutElementResponse>>
];

export const mockSignOutElement =
  (serviceArg: Service, configurationArg: Value, elementArg: ElementMapPath) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: SignOutParams;
      result: SignoutElementResponse;
    }>
  ): SignOutElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon.stub<
      [signOutParams: SignOutParams],
      Promise<SignoutElementResponse>
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
        (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
      >()
      .withArgs(elementArg)
      .returns(withContentStub);
    const withConfigurationStub = sinon
      .stub<
        [Value],
        (
          element: ElementMapPath
        ) => (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
      >()
      .withArgs(configurationArg)
      .returns(withSignoutParamsStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          configuration: Value
        ) => (
          element: ElementMapPath
        ) => (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'signOutElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
      withSignoutParamsStub,
      withContentStub,
    ];
  };

type SignInElementStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      configuration: Value
    ) => (element: ElementMapPath) => Promise<SignInElementResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (element: ElementMapPath) => Promise<SignInElementResponse>
  >,
  sinon.SinonStub<
    [Value],
    (element: ElementMapPath) => Promise<SignInElementResponse>
  >,
  sinon.SinonStub<[ElementMapPath], Promise<SignInElementResponse>>
];

export const mockSignInElement =
  (serviceArg: Service, configurationArg: Value, elementArg: ElementMapPath) =>
  (mockResult: SignInElementResponse): SignInElementStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[element: ElementMapPath], Promise<SignInElementResponse>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withConfigurationStub = sinon
      .stub<
        [Value],
        (element: ElementMapPath) => Promise<SignInElementResponse>
      >()
      .withArgs(configurationArg)
      .returns(withContentStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          configuration: Value
        ) => (element: ElementMapPath) => Promise<SignInElementResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'signInElement')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
      withContentStub,
    ];
  };

type GenerateElementInPlaceStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [Value],
    (
      element: ElementMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [ActionChangeControlValue],
    (generateSignOutParams?: GenerateSignOutParams) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [generateSignOutParams?: GenerateSignOutParams],
    Promise<GenerateResponse>
  >
];

export const mockGenerateElementInPlace =
  (
    serviceArg: Service,
    configurationArg: Value,
    elementArg: Element,
    changeControlValueArg: ActionChangeControlValue
  ) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: GenerateSignOutParams;
      mockResult: GenerateResponse;
    }>
  ): GenerateElementInPlaceStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon.stub<
      [generateSignOutParams?: GenerateSignOutParams],
      Promise<GenerateResponse>
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
        (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
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
        ) => Promise<GenerateResponse>
      >()
      .withArgs(elementArg)
      .returns(withSignOutParamsStub);
    const withConfigurationStub = sinon
      .stub<
        [Value],
        (
          element: ElementMapPath
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(configurationArg)
      .returns(withChangeControlValueStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          configuration: Value
        ) => (
          element: ElementMapPath
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'generateElementInPlace')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
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
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (
      element: ElementMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [Value],
    (
      element: ElementMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [ChangeControlValue],
    (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [generateCopyBackParams?: GenerateWithCopyBackParams],
    (generateSignOutParams?: GenerateSignOutParams) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [generateSignOutParams?: GenerateSignOutParams],
    Promise<GenerateResponse>
  >
];

export const mockGenerateElementWithCopyBack =
  (
    serviceArg: Service,
    configurationArg: Value,
    elementArg: Element,
    changeControlValueArg: ActionChangeControlValue,
    copyBackParamsArg: GenerateWithCopyBackParams
  ) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: GenerateSignOutParams;
      mockResult: GenerateResponse;
    }>
  ): GenerateElementWithCopyBackStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon.stub<
      [generateSignOutParams?: GenerateSignOutParams],
      Promise<GenerateResponse>
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
        ) => Promise<GenerateResponse>
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
        ) => Promise<GenerateResponse>
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
        ) => Promise<GenerateResponse>
      >()
      .withArgs(elementArg)
      .returns(withCopyBackParamsStub);
    const withConfigurationStub = sinon
      .stub<
        [Value],
        (
          element: ElementMapPath
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          copyBackParams?: GenerateWithCopyBackParams
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(configurationArg)
      .returns(withChangeControlValueStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (
          configuration: Value
        ) => (
          element: ElementMapPath
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          copyBackParams?: GenerateWithCopyBackParams
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'generateElementWithCopyBack')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
      withChangeControlValueStub,
      withCopyBackParamsStub,
      withSignOutParamsStub,
      withContentStub,
    ];
  };

type GenerateSubsystemElementsInPlaceStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      configuration: Value
    ) => (
      subSystemMapPath: SubSystemMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (
      subSystemMapPath: SubSystemMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [Value],
    (
      subSystemMapPath: SubSystemMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [SubSystemMapPath],
    (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [ActionChangeControlValue],
    (generateSignOutParams?: GenerateSignOutParams) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [generateSignOutParams?: GenerateSignOutParams],
    Promise<GenerateResponse>
  >
];

export const mockGenerateSubsystemElementsInPlace =
  (
    serviceArg: Service,
    subSystemArg: SubSystemMapPath,
    configurationArg: Value,
    changeControlValueArg: ActionChangeControlValue
  ) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: GenerateSignOutParams;
      mockResult: GenerateResponse;
    }>
  ): GenerateSubsystemElementsInPlaceStub => {
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon.stub<
      [generateSignOutParams?: GenerateSignOutParams],
      Promise<GenerateResponse>
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
        (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(changeControlValueArg)
      .returns(withContentStub);
    const withChangeControlValueStub = sinon
      .stub<
        [subSystemMapPath: SubSystemMapPath],
        (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(subSystemArg)
      .returns(withSignOutParamsStub);
    const withConfigurationValueStub = sinon
      .stub<
        [configuration: Value],
        (
          subSystemMapPath: SubSystemMapPath
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(configurationArg)
      .returns(withChangeControlValueStub);
    const withServiceStub = sinon
      .stub<
        [service: Service],
        (
          configuration: Value
        ) => (
          subSystemMapPath: SubSystemMapPath
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationValueStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'generateSubsystemElementsInPlace')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationValueStub,
      withChangeControlValueStub,
      withSignOutParamsStub,
      withContentStub,
    ];
  };

export type DownloadingReportStub = [
  sinon.SinonStub<
    [ProgressReporter],
    (
      service: Service
    ) => (configuration: Value) => (reportId: Value) => Promise<Value | void>
  >,
  sinon.SinonStub<
    [Service],
    (configuration: Value) => (reportId: Value) => Promise<Value | void>
  >,
  sinon.SinonStub<[Value], (reportId: Value) => Promise<Value | void>>,
  sinon.SinonStub<[Value], Promise<Value | void>>
];

export const mockDownloadReportById =
  (serviceArg: Service, configurationArg: Value, reportId: Value) =>
  (mockResult: Value | void): DownloadingReportStub => {
    const anyProgressReporter = sinon.match.any;
    const withReportIdStub = sinon
      .stub<[Value], Promise<Value | void>>()
      .withArgs(reportId)
      .returns(Promise.resolve(mockResult));
    const withConfigurationStub = sinon
      .stub<[Value], (reportId: Value) => Promise<Value | void>>()
      .withArgs(configurationArg)
      .returns(withReportIdStub);
    const withServiceStub = sinon
      .stub<
        [Service],
        (configuration: Value) => (reportId: Value) => Promise<Value | void>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'downloadReportById')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
      withReportIdStub,
    ];
  };

export type SearchForElementsStub = [
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: Service
    ) => (
      configuration: Value
    ) => (
      environmentStageMapPath: EnvironmentStageMapPath
    ) => (
      system?: Value,
      subsystem?: Value,
      type?: Value,
      element?: Value
    ) => Promise<ElementsResponse>
  >,
  sinon.SinonStub<
    [Service],
    (
      configuration: Value
    ) => (
      environmentStageMapPath: EnvironmentStageMapPath
    ) => (
      system?: Value,
      subsystem?: Value,
      type?: Value,
      element?: Value
    ) => Promise<ElementsResponse>
  >,
  sinon.SinonStub<
    [Value],
    (
      environmentStageMapPath: EnvironmentStageMapPath
    ) => (
      system?: Value,
      subsystem?: Value,
      type?: Value,
      element?: Value
    ) => Promise<ElementsResponse>
  >,
  sinon.SinonStub<
    [EnvironmentStageMapPath],
    (
      system?: Value,
      subsystem?: Value,
      type?: Value,
      element?: Value
    ) => Promise<ElementsResponse>
  >,
  sinon.SinonStub<
    [system?: Value, subsystem?: Value, type?: Value, element?: Value],
    Promise<ElementsResponse>
  >
];

export const mockSearchForElements =
  (
    serviceArg: Service,
    configurationArg: Value,
    environmentStageMapPathArg: EnvironmentStageMapPath,
    systemArg?: Value,
    subsystemArg?: Value,
    typeArg?: Value,
    elementArg?: Value
  ) =>
  (mockResult: ElementsResponse): SearchForElementsStub => {
    const anyProgressReporter = sinon.match.any;
    const withPartialMapStub = sinon
      .stub<
        [system?: Value, subsystem?: Value, type?: Value, element?: Value],
        Promise<ElementsResponse>
      >()
      .withArgs(systemArg, subsystemArg, typeArg, elementArg)
      .returns(Promise.resolve(mockResult));
    const withenvironmentStageMapPathStub = sinon
      .stub<
        [environmentStageMapPath: EnvironmentStageMapPath],
        (
          system?: Value,
          subsystem?: Value,
          type?: Value,
          element?: Value
        ) => Promise<ElementsResponse>
      >()
      .withArgs(environmentStageMapPathArg)
      .returns(withPartialMapStub);
    const withConfigurationStub = sinon
      .stub<
        [configuration: Value],
        (
          environmentStageMapPath: EnvironmentStageMapPath
        ) => (
          system?: Value,
          subsystem?: Value,
          type?: Value,
          element?: Value
        ) => Promise<ElementsResponse>
      >()
      .withArgs(configurationArg)
      .returns(withenvironmentStageMapPathStub);
    const withServiceStub = sinon
      .stub<
        [service: Service],
        (
          configuration: Value
        ) => (
          environmentStageMapPath: EnvironmentStageMapPath
        ) => (
          system?: Value,
          subsystem?: Value,
          type?: Value,
          element?: Value
        ) => Promise<ElementsResponse>
      >()
      .withArgs(serviceArg)
      .returns(withConfigurationStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'searchForElementsInPlace')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withConfigurationStub,
      withenvironmentStageMapPathStub,
      withPartialMapStub,
    ];
  };
