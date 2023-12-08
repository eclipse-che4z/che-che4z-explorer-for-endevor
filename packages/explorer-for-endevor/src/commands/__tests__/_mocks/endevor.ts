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
import * as endevor from '../../../api/endevor';
import {
  ChangeControlValue,
  Element,
  ElementData,
  ElementDataWithFingerprint,
  ElementMapPath,
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
  ErrorResponseType,
  EndevorResponse,
  ElementTypeMapPath,
  ProcessorGroupsResponse,
  ElementTypesResponse,
  MoveParams,
  MoveResponse,
  CreatePackageParams,
  PackageCreateResponse,
  PackageInformation,
  PackageSclContent,
  ProcessorGroupValue,
  UpdateParams,
} from '@local/endevor/_doc/Endevor';
import { ProgressReporter } from '@local/endevor/_doc/Progress';
import { EndevorAuthorizedService } from '../../../api/_doc/Endevor';

export type PrintingElementStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (element: ElementMapPath) => Promise<PrintResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (element: ElementMapPath) => Promise<PrintResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (element: ElementMapPath) => Promise<PrintResponse>
  >,
  sinon.SinonStub<[ElementMapPath], Promise<PrintResponse>>
];

export const mockPrintingElementWith =
  (serviceArg: EndevorAuthorizedService, elementArg: ElementMapPath) =>
  (mockResult: PrintResponse): PrintingElementStub => {
    const anyLogActivity = sinon.match.any;
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[ElementMapPath], Promise<PrintResponse>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (element: ElementMapPath) => Promise<PrintResponse>
      >()
      .withArgs(serviceArg)
      .returns(withContentStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (element: ElementMapPath) => Promise<PrintResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'printElementAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withContentStub,
    ];
  };

export type UploadingElementStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      updateParams: UpdateParams
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementDataWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      updateParams: UpdateParams
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementDataWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (
      element: ElementMapPath
    ) => (
      updateParams: UpdateParams
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementContent: ElementDataWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      updateParams: UpdateParams
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementContent: ElementDataWithFingerprint) => Promise<UpdateResponse>
  >,
  sinon.SinonStub<
    [UpdateParams],
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
    serviceArg: EndevorAuthorizedService,
    elementArg: ElementMapPath,
    actionCcidArg: ChangeControlValue,
    updateParamsArg: UpdateParams,
    elementContentArg: ElementDataWithFingerprint
  ) =>
  (mockResults: ReadonlyArray<UpdateResponse>): UploadingElementStub => {
    const anyLogActivity = sinon.match.any;
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
    const withProcessorGroupStub = sinon
      .stub<
        [UpdateParams],
        (
          actionCcid: ChangeControlValue
        ) => (
          elementContent: ElementDataWithFingerprint
        ) => Promise<UpdateResponse>
      >()
      .withArgs(updateParamsArg)
      .returns(withActionCcidStub);
    const withElementStub = sinon
      .stub<
        [ElementMapPath],
        (
          updateParams: UpdateParams
        ) => (
          actionCcid: ChangeControlValue
        ) => (
          elementContent: ElementDataWithFingerprint
        ) => Promise<UpdateResponse>
      >()
      .withArgs(elementArg)
      .returns(withProcessorGroupStub);
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          element: ElementMapPath
        ) => (
          updateParams: UpdateParams
        ) => (
          actionCcid: ChangeControlValue
        ) => (
          elementContent: ElementDataWithFingerprint
        ) => Promise<UpdateResponse>
      >()
      .withArgs(serviceArg)
      .returns(withElementStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          element: ElementMapPath
        ) => (
          updateParams: UpdateParams
        ) => (
          actionCcid: ChangeControlValue
        ) => (
          elementContent: ElementDataWithFingerprint
        ) => Promise<UpdateResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'updateElementAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withElementStub,
      withProcessorGroupStub,
      withActionCcidStub,
      withContentStub,
    ];
  };

export type AddingElementStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      processorGroup: ProcessorGroupValue
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementData) => Promise<AddResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      processorGroup: ProcessorGroupValue
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementData) => Promise<AddResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (
      element: ElementMapPath
    ) => (
      processorGroup: ProcessorGroupValue
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementData) => Promise<AddResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      processorGroup: ProcessorGroupValue
    ) => (
      actionCcid: ChangeControlValue
    ) => (elementData: ElementData) => Promise<AddResponse>
  >,
  sinon.SinonStub<
    [ProcessorGroupValue],
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
    serviceArg: EndevorAuthorizedService,
    elementArg: ElementMapPath,
    procGroup: Value,
    actionCcidArg: ChangeControlValue,
    elementData: ElementData
  ) =>
  (mockResults: ReadonlyArray<AddResponse>): AddingElementStub => {
    const anyLogActivity = sinon.match.any;
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
    const withProcGroupStub = sinon
      .stub<
        [ProcessorGroupValue],
        (
          actionCcid: ChangeControlValue
        ) => (elementData: ElementData) => Promise<AddResponse>
      >()
      .withArgs(procGroup)
      .returns(withActionCcidStub);
    const withElementStub = sinon
      .stub<
        [ElementMapPath],
        (
          procGroup: ProcessorGroupValue
        ) => (
          actionCcid: ChangeControlValue
        ) => (elementData: ElementData) => Promise<AddResponse>
      >()
      .withArgs(elementArg)
      .returns(withProcGroupStub);
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          element: ElementMapPath
        ) => (
          procGroup: ProcessorGroupValue
        ) => (
          actionCcid: ChangeControlValue
        ) => (elementData: ElementData) => Promise<AddResponse>
      >()
      .withArgs(serviceArg)
      .returns(withElementStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          element: ElementMapPath
        ) => (
          procGroup: ProcessorGroupValue
        ) => (
          actionCcid: ChangeControlValue
        ) => (elementData: ElementData) => Promise<AddResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'addElementAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withElementStub,
      withProcGroupStub,
      withActionCcidStub,
      withElementDataStub,
    ];
  };

export type RetrieveElementStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => Promise<RetrieveElementWithoutSignoutResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => Promise<RetrieveElementWithoutSignoutResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (element: ElementMapPath) => Promise<RetrieveElementWithoutSignoutResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    Promise<RetrieveElementWithoutSignoutResponse>
  >
];

export const mockRetrieveElement =
  (serviceArg: EndevorAuthorizedService, elementArg: ElementMapPath) =>
  (mockResult: RetrieveElementWithoutSignoutResponse): RetrieveElementStub => {
    const anyLogActivity = sinon.match.any;
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<
        [element: ElementMapPath],
        Promise<RetrieveElementWithoutSignoutResponse>
      >()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          element: ElementMapPath
        ) => Promise<RetrieveElementWithoutSignoutResponse>
      >()
      .withArgs(serviceArg)
      .returns(withContentStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          element: ElementMapPath
        ) => Promise<RetrieveElementWithoutSignoutResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'retrieveElementAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withContentStub,
    ];
  };

type RetrieveElementWithSignoutStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      signOutParams: SignOutParams
    ) => Promise<RetrieveElementWithSignoutResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      signOutParams: SignOutParams
    ) => Promise<RetrieveElementWithSignoutResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
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
  (serviceArg: EndevorAuthorizedService, elementArg: ElementMapPath) =>
  (
    mockResults: ReadonlyArray<{
      signOutParamsArg: SignOutParams;
      signOutMockResult: RetrieveElementWithSignoutResponse;
    }>
  ): RetrieveElementWithSignoutStub => {
    const anyLogActivity = sinon.match.any;
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
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          element: ElementMapPath
        ) => (
          signOutParams: SignOutParams
        ) => Promise<RetrieveElementWithSignoutResponse>
      >()
      .withArgs(serviceArg)
      .returns(withSignoutParamsStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          element: ElementMapPath
        ) => (
          signOutParams: SignOutParams
        ) => Promise<RetrieveElementWithSignoutResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'retrieveElementWithSignoutAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withSignoutParamsStub,
      withContentStub,
    ];
  };

type SignOutElementStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
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
  (serviceArg: EndevorAuthorizedService, elementArg: ElementMapPath) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: SignOutParams;
      result: SignoutElementResponse;
    }>
  ): SignOutElementStub => {
    const anyLogActivity = sinon.match.any;
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
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          element: ElementMapPath
        ) => (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
      >()
      .withArgs(serviceArg)
      .returns(withSignoutParamsStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          element: ElementMapPath
        ) => (signOutParams: SignOutParams) => Promise<SignoutElementResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'signOutElementAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withSignoutParamsStub,
      withContentStub,
    ];
  };

type SignInElementStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (element: ElementMapPath) => Promise<SignInElementResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (element: ElementMapPath) => Promise<SignInElementResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (element: ElementMapPath) => Promise<SignInElementResponse>
  >,
  sinon.SinonStub<[ElementMapPath], Promise<SignInElementResponse>>
];

export const mockSignInElement =
  (serviceArg: EndevorAuthorizedService, elementArg: ElementMapPath) =>
  (mockResult: SignInElementResponse): SignInElementStub => {
    const anyLogActivity = sinon.match.any;
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[element: ElementMapPath], Promise<SignInElementResponse>>()
      .withArgs(elementArg)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (element: ElementMapPath) => Promise<SignInElementResponse>
      >()
      .withArgs(serviceArg)
      .returns(withContentStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (element: ElementMapPath) => Promise<SignInElementResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'signInElementAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withContentStub,
    ];
  };

type MoveElementStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      moveChangeControlValue: ActionChangeControlValue
    ) => (moveParams: MoveParams) => Promise<MoveResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      moveChangeControlValue: ActionChangeControlValue
    ) => (moveParams: MoveParams) => Promise<MoveResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (
      element: ElementMapPath
    ) => (
      moveChangeControlValue: ActionChangeControlValue
    ) => (moveParams: MoveParams) => Promise<MoveResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      moveChangeControlValue: ActionChangeControlValue
    ) => (moveParams: MoveParams) => Promise<MoveResponse>
  >,
  sinon.SinonStub<
    [ActionChangeControlValue],
    (moveParams: MoveParams) => Promise<MoveResponse>
  >,
  sinon.SinonStub<[moveParams: MoveParams], Promise<MoveResponse>>
];

export const mockMoveElement =
  (
    serviceArg: EndevorAuthorizedService,
    elementArg: Element,
    changeControlValueArg: ActionChangeControlValue,
    moveParamsArg: MoveParams
  ) =>
  (mockResult: MoveResponse): MoveElementStub => {
    const anyLogActivity = sinon.match.any;
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[moveParams: MoveParams], Promise<MoveResponse>>()
      .withArgs(moveParamsArg)
      .returns(Promise.resolve(mockResult));
    const withMoveParamsStub = sinon
      .stub<
        [moveChangeControlValue: ActionChangeControlValue],
        (moveParams: MoveParams) => Promise<MoveResponse>
      >()
      .withArgs(changeControlValueArg)
      .returns(withContentStub);
    const withChangeControlValueStub = sinon
      .stub<
        [element: ElementMapPath],
        (
          moveChangeControlValue: ActionChangeControlValue
        ) => (moveParams: MoveParams) => Promise<MoveResponse>
      >()
      .withArgs(elementArg)
      .returns(withMoveParamsStub);
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          element: ElementMapPath
        ) => (
          moveChangeControlValue: ActionChangeControlValue
        ) => (moveParams: MoveParams) => Promise<MoveResponse>
      >()
      .withArgs(serviceArg)
      .returns(withChangeControlValueStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          element: ElementMapPath
        ) => (
          moveChangeControlValue: ActionChangeControlValue
        ) => (moveParams: MoveParams) => Promise<MoveResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'moveElementAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withChangeControlValueStub,
      withMoveParamsStub,
      withContentStub,
    ];
  };

type GenerateElementInPlaceStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      processorGroup: ProcessorGroupValue
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      processorGroup: ProcessorGroupValue
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (
      element: ElementMapPath
    ) => (
      processorGroup: ProcessorGroupValue
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [ElementMapPath],
    (
      processorGroup: ProcessorGroupValue
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [ProcessorGroupValue],
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
    serviceArg: EndevorAuthorizedService,
    elementArg: Element,
    changeControlValueArg: ActionChangeControlValue,
    procGroup: Value
  ) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: GenerateSignOutParams;
      mockResult: GenerateResponse;
    }>
  ): GenerateElementInPlaceStub => {
    const anyLogActivity = sinon.match.any;
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
        [ProcessorGroupValue],
        (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(procGroup)
      .returns(withSignOutParamsStub);
    const withProcGroupStub = sinon
      .stub<
        [element: ElementMapPath],
        (
          procGroup: ProcessorGroupValue
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(elementArg)
      .returns(withChangeControlValueStub);
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          element: ElementMapPath
        ) => (
          procGroup: ProcessorGroupValue
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(serviceArg)
      .returns(withProcGroupStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          element: ElementMapPath
        ) => (
          procGroup: ProcessorGroupValue
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'generateElementInPlaceAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withProcGroupStub,
      withChangeControlValueStub,
      withSignOutParamsStub,
      withContentStub,
    ];
  };

type GenerateElementWithCopyBackStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      processorGroup: ProcessorGroupValue
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      element: ElementMapPath
    ) => (
      processorGroup: ProcessorGroupValue
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (
      element: ElementMapPath
    ) => (
      processorGroup: ProcessorGroupValue
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
      processorGroup: ProcessorGroupValue
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateCopyBackParams?: GenerateWithCopyBackParams
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [ProcessorGroupValue],
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
    serviceArg: EndevorAuthorizedService,
    elementArg: Element,
    changeControlValueArg: ActionChangeControlValue,
    copyBackParamsArg: GenerateWithCopyBackParams,
    procGroup: Value
  ) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: GenerateSignOutParams;
      mockResult: GenerateResponse;
    }>
  ): GenerateElementWithCopyBackStub => {
    const anyLogActivity = sinon.match.any;
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
    const withProcGroupStub = sinon
      .stub<
        [ProcessorGroupValue],
        (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          copyBackParams?: GenerateWithCopyBackParams
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(procGroup)
      .returns(withCopyBackParamsStub);
    const withChangeControlValueStub = sinon
      .stub<
        [element: ElementMapPath],
        (
          procGroup: ProcessorGroupValue
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          copyBackParams?: GenerateWithCopyBackParams
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(elementArg)
      .returns(withProcGroupStub);

    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          element: ElementMapPath
        ) => (
          procGroup: ProcessorGroupValue
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          copyBackParams?: GenerateWithCopyBackParams
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(serviceArg)
      .returns(withChangeControlValueStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          element: ElementMapPath
        ) => (
          procGroup: ProcessorGroupValue
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          copyBackParams?: GenerateWithCopyBackParams
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'generateElementWithCopyBackAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withChangeControlValueStub,
      withProcGroupStub,
      withCopyBackParamsStub,
      withSignOutParamsStub,
      withContentStub,
    ];
  };

type GenerateSubsystemElementsInPlaceStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      subSystemMapPath: SubSystemMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      subSystemMapPath: SubSystemMapPath
    ) => (
      generateChangeControlValue: ActionChangeControlValue
    ) => (
      generateSignOutParams?: GenerateSignOutParams
    ) => Promise<GenerateResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
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
    serviceArg: EndevorAuthorizedService,
    subSystemArg: SubSystemMapPath,
    changeControlValueArg: ActionChangeControlValue
  ) =>
  (
    mockResults: ReadonlyArray<{
      signoutArg?: GenerateSignOutParams;
      mockResult: GenerateResponse;
    }>
  ): GenerateSubsystemElementsInPlaceStub => {
    const anyLogActivity = sinon.match.any;
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
        [ActionChangeControlValue],
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
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          subSystemMapPath: SubSystemMapPath
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(serviceArg)
      .returns(withChangeControlValueStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          subSystemMapPath: SubSystemMapPath
        ) => (
          generateChangeControlValue: ActionChangeControlValue
        ) => (
          generateSignOutParams?: GenerateSignOutParams
        ) => Promise<GenerateResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'generateSubsystemElementsInPlaceAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withChangeControlValueStub,
      withSignOutParamsStub,
      withContentStub,
    ];
  };

export type DownloadingReportStub = [
  sinon.SinonStub<
    [ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (reportId: Value) => Promise<Value | void>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (reportId: Value) => Promise<Value | void>
  >,
  sinon.SinonStub<[Value], Promise<Value | void>>
];

export const mockDownloadReportById =
  (serviceArg: EndevorAuthorizedService, reportId: Value) =>
  (mockResult: Value | void): DownloadingReportStub => {
    const anyProgressReporter = sinon.match.any;
    const withReportIdStub = sinon
      .stub<[Value], Promise<Value | void>>()
      .withArgs(reportId)
      .returns(Promise.resolve(mockResult));
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (reportId: Value) => Promise<Value | void>
      >()
      .withArgs(serviceArg)
      .returns(withReportIdStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'downloadReportById')
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    return [generalFunctionStub, withServiceStub, withReportIdStub];
  };

export type SearchForElementsStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
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
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
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
    [EndevorAuthorizedService],
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
    serviceArg: EndevorAuthorizedService,
    environmentStageMapPathArg: EnvironmentStageMapPath,
    systemArg?: Value,
    subsystemArg?: Value,
    typeArg?: Value,
    elementArg?: Value
  ) =>
  (mockResult: ElementsResponse): SearchForElementsStub => {
    const anyLogActivity = sinon.match.any;
    const anyProgressReporter = sinon.match.any;
    const withPartialMapStub = sinon
      .stub<
        [system?: Value, subsystem?: Value, type?: Value, element?: Value],
        Promise<ElementsResponse>
      >()
      .withArgs(systemArg, subsystemArg, typeArg, elementArg)
      .returns(Promise.resolve(mockResult));
    const withEnvironmentStageMapPathStub = sinon
      .stub<
        [EnvironmentStageMapPath],
        (
          system?: Value,
          subsystem?: Value,
          type?: Value,
          element?: Value
        ) => Promise<ElementsResponse>
      >()
      .withArgs(environmentStageMapPathArg)
      .returns(withPartialMapStub);
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          environmentStageMapPath: EnvironmentStageMapPath
        ) => (
          system?: Value,
          subsystem?: Value,
          type?: Value,
          element?: Value
        ) => Promise<ElementsResponse>
      >()
      .withArgs(serviceArg)
      .returns(withEnvironmentStageMapPathStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          environmentStageMapPath: EnvironmentStageMapPath
        ) => (
          system?: Value,
          subsystem?: Value,
          type?: Value,
          element?: Value
        ) => Promise<ElementsResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'searchForElementsInPlaceAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withEnvironmentStageMapPathStub,
      withPartialMapStub,
    ];
  };

type GetProcessorGroupsByTypeStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      service: EndevorAuthorizedService
    ) => (
      progress: ProgressReporter
    ) => (
      typeMapPath: Partial<ElementTypeMapPath>
    ) => (procGroup?: string) => Promise<ProcessorGroupsResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (
      progress: ProgressReporter
    ) => (
      typeMapPath: Partial<ElementTypeMapPath>
    ) => (procGroup?: string) => Promise<ProcessorGroupsResponse>
  >,
  sinon.SinonStub<
    [ProgressReporter],
    (
      typeMapPath: Partial<ElementTypeMapPath>
    ) => (procGroup?: string) => Promise<ProcessorGroupsResponse>
  >,
  sinon.SinonStub<
    [typeMapPath: Partial<ElementTypeMapPath>],
    (procGroup?: string) => Promise<ProcessorGroupsResponse>
  >,
  sinon.SinonStub<
    [procGroup?: ProcessorGroupValue],
    Promise<ProcessorGroupsResponse>
  >
];

export const mockGetProcessorGroupsByType =
  (
    serviceArg: EndevorAuthorizedService,
    typeMapPath: Partial<ElementTypeMapPath>,
    procGroup: Value
  ) =>
  (mockResult: ProcessorGroupsResponse): GetProcessorGroupsByTypeStub => {
    const anyLogActivity = sinon.match.any;
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[procGroup?: string], Promise<ProcessorGroupsResponse>>()
      .withArgs(procGroup)
      .returns(Promise.resolve(mockResult));
    const withTypeMapStub = sinon
      .stub<
        [typeMapPath: Partial<ElementTypeMapPath>],
        (procGrpoup?: Value) => Promise<ProcessorGroupsResponse>
      >()
      .withArgs(typeMapPath)
      .returns(withContentStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          typeMapPath: Partial<ElementTypeMapPath>
        ) => (procGrpoup?: Value) => Promise<ProcessorGroupsResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withTypeMapStub);
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          process: ProgressReporter
        ) => (
          typeMapPath: Partial<ElementTypeMapPath>
        ) => (procGrpoup?: Value) => Promise<ProcessorGroupsResponse>
      >()
      .withArgs(serviceArg)
      .returns(withProgressReporterStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'getProcessorGroupsByTypeAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withServiceStub);
    return [
      generalFunctionStub,
      withServiceStub,
      withProgressReporterStub,
      withTypeMapStub,
      withContentStub,
    ];
  };

type GetTypesInPlaceStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      environmentSearchParams: Partial<EnvironmentStageMapPath>
    ) => (ypePath: Partial<ElementTypeMapPath>) => Promise<ElementTypesResponse>
  >,
  sinon.SinonStub<
    [ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      environmentSearchParams: Partial<EnvironmentStageMapPath>
    ) => (
      pypePath: Partial<ElementTypeMapPath>
    ) => Promise<ElementTypesResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (
      environmentSearchParams: Partial<EnvironmentStageMapPath>
    ) => (
      typePath: Partial<ElementTypeMapPath>
    ) => Promise<ElementTypesResponse>
  >,
  sinon.SinonStub<
    [environmentSearchParams: Partial<EnvironmentStageMapPath>],
    (typePath: Partial<ElementTypeMapPath>) => Promise<ElementTypesResponse>
  >,
  sinon.SinonStub<
    [typePath: Partial<ElementTypeMapPath>],
    Promise<ElementTypesResponse>
  >
];

export const mockGetTypesInPlace =
  (
    serviceArg: EndevorAuthorizedService,
    environmentSearchParams: Partial<EnvironmentStageMapPath>,
    typeMapPath: Partial<ElementTypeMapPath>
  ) =>
  (mockResult: ElementTypesResponse): GetTypesInPlaceStub => {
    const anyLogActivity = sinon.match.any;
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[Partial<ElementTypeMapPath>], Promise<ElementTypesResponse>>()
      .withArgs(typeMapPath)
      .returns(Promise.resolve(mockResult));
    const withEnvSearchParams = sinon
      .stub<
        [Partial<EnvironmentStageMapPath>],
        (
          typeMapPath: Partial<ElementTypeMapPath>
        ) => Promise<ElementTypesResponse>
      >()
      .withArgs(environmentSearchParams)
      .returns(withContentStub);
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          environmentSearchParams: Partial<EnvironmentStageMapPath>
        ) => (
          typeMapPath: Partial<ElementTypeMapPath>
        ) => Promise<ElementTypesResponse>
      >()
      .withArgs(serviceArg)
      .returns(withEnvSearchParams);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          environmentSearchParams: Partial<EnvironmentStageMapPath>
        ) => (
          typeMapPath: Partial<ElementTypeMapPath>
        ) => Promise<ElementTypesResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'searchForTypesInPlaceAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withEnvSearchParams,
      withContentStub,
    ];
  };

type CreatePackageStub = [
  sinon.SinonStub<
    [
      logActivity: (
        actionName: string
      ) => <E extends ErrorResponseType | undefined, R>(
        response: EndevorResponse<E, R>
      ) => void
    ],
    (
      progress: ProgressReporter
    ) => (
      service: EndevorAuthorizedService
    ) => (
      packageInfo: PackageInformation
    ) => (
      packageParams: CreatePackageParams
    ) => (sclContent: PackageSclContent) => Promise<PackageCreateResponse>
  >,
  sinon.SinonStub<
    [progress: ProgressReporter],
    (
      service: EndevorAuthorizedService
    ) => (
      packageInfo: PackageInformation
    ) => (
      packageParams: CreatePackageParams
    ) => (sclContent: PackageSclContent) => Promise<PackageCreateResponse>
  >,
  sinon.SinonStub<
    [EndevorAuthorizedService],
    (
      packageInfo: PackageInformation
    ) => (
      packageParams: CreatePackageParams
    ) => (sclContent: PackageSclContent) => Promise<PackageCreateResponse>
  >,
  sinon.SinonStub<
    [packageInfo: PackageInformation],
    (
      packageParams: CreatePackageParams
    ) => (sclContent: PackageSclContent) => Promise<PackageCreateResponse>
  >,
  sinon.SinonStub<
    [packageParams: CreatePackageParams],
    (sclContent: PackageSclContent) => Promise<PackageCreateResponse>
  >,
  sinon.SinonStub<
    [sclContent: PackageSclContent],
    Promise<PackageCreateResponse>
  >
];

export const mockCreatePackage =
  (
    serviceArg: EndevorAuthorizedService,
    packageInfoArg: PackageInformation,
    createPackageParamsArg: CreatePackageParams,
    sclContentArg: PackageSclContent
  ) =>
  (mockResult: PackageCreateResponse): CreatePackageStub => {
    const anyLogActivity = sinon.match.any;
    const anyProgressReporter = sinon.match.any;
    const withContentStub = sinon
      .stub<[sclContent: PackageSclContent], Promise<PackageCreateResponse>>()
      .withArgs(sclContentArg)
      .returns(Promise.resolve(mockResult));
    const withPackageParamsStub = sinon
      .stub<
        [packageParams: CreatePackageParams],
        (sclContent: PackageSclContent) => Promise<PackageCreateResponse>
      >()
      .withArgs(createPackageParamsArg)
      .returns(withContentStub);
    const withPackageInfoStub = sinon
      .stub<
        [packageInfo: PackageInformation],
        (
          packageParams: CreatePackageParams
        ) => (sclContent: PackageSclContent) => Promise<PackageCreateResponse>
      >()
      .withArgs(packageInfoArg)
      .returns(withPackageParamsStub);
    const withServiceStub = sinon
      .stub<
        [EndevorAuthorizedService],
        (
          packageInfo: PackageInformation
        ) => (
          packageParams: CreatePackageParams
        ) => (sclContent: PackageSclContent) => Promise<PackageCreateResponse>
      >()
      .withArgs(serviceArg)
      .returns(withPackageInfoStub);
    const withProgressReporterStub = sinon
      .stub<
        [ProgressReporter],
        (
          service: EndevorAuthorizedService
        ) => (
          packageInfo: PackageInformation
        ) => (
          packageParams: CreatePackageParams
        ) => (sclContent: PackageSclContent) => Promise<PackageCreateResponse>
      >()
      .withArgs(anyProgressReporter)
      .returns(withServiceStub);
    const generalFunctionStub = sinon
      .stub(endevor, 'createPackageAndLogActivity')
      .withArgs(anyLogActivity)
      .returns(withProgressReporterStub);
    return [
      generalFunctionStub,
      withProgressReporterStub,
      withServiceStub,
      withPackageInfoStub,
      withPackageParamsStub,
      withContentStub,
    ];
  };
