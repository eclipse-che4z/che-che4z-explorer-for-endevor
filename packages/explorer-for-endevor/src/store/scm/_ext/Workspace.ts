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

import { toEndevorStageNumber } from '@local/endevor/utils';
import { StageNumber } from '@local/endevor/_doc/Endevor';
import * as t from 'io-ts';

// "What makes io-ts uniquely valuable is that it simultaneously defines a runtime validator and a static type."
// https://www.olioapps.com/blog/checking-types-real-world-typescript/

export type WorkspaceElement = t.TypeOf<typeof WorkspaceElement>;

export type WorkspaceFileVersion = t.TypeOf<typeof WorkspaceFileVersion>;

export type WorkspaceSubsystem = t.TypeOf<typeof WorkspaceSubsystem>;

export type WorkspaceSystem = t.TypeOf<typeof WorkspaceSystem>;

export type WorkspaceEnvironmentStage = t.TypeOf<
  typeof WorkspaceEnvironmentStage
>;

export type WorkspaceState = t.TypeOf<typeof WorkspaceState>;

export type WorkspaceActionResult = t.TypeOf<typeof WorkspaceActionResult>;
export type WorkspaceActionResults = t.TypeOf<typeof WorkspaceActionResults>;

export type WorkspaceResponse = t.TypeOf<typeof WorkspaceResponse>;

export type ElementStatus = 'N' | 'I' | 'C' | 'M' | 'CR';

export type ElementAction =
  | 'INT'
  | 'RET'
  | 'ADD'
  | 'UPD'
  | 'UPDSYN'
  | 'CON'
  | 'VALSYN'
  | 'MERGE'
  | 'LOCDEL'
  | 'REMDEL';

export type ElementActionStatus = 'NORUN' | 'OK' | 'WARN' | 'FAIL';
export type ElementActionDetailedStatusNotRun =
  | 'NORUN'
  | 'NORUN_CCID'
  | 'NORUN_COMM'
  | 'NORUN_CCID_COMM'
  | 'NORUN_MERGE';
export type ElementActionDetailedStatusSuccess =
  | 'OK'
  | 'OK_NOCHANGE'
  | 'OK_MANUAL_MERGE'
  | 'OK_AUTOMERGE'
  | 'OK_IN_SYNC'
  | 'OK_OUT_OF_SYNC'
  | 'OK_SYNC_DISABLED';
export type ElementActionDetailedStatusWarning = 'WARN';
export type ElementActionDetailedStatusFailure =
  | 'FAIL'
  | 'FAIL_MAX_RC'
  | 'FAIL_STC_SHORT'
  | 'FAIL_NOT_FOUND'
  | 'FAIL_FP_CHECK'
  | 'FAIL_SIGNOUT'
  | 'FAIL_MERGE_LOC';
export type ElementActionDetailedStatus =
  | ElementActionDetailedStatusNotRun
  | ElementActionDetailedStatusSuccess
  | ElementActionDetailedStatusWarning
  | ElementActionDetailedStatusFailure;

class StageNumberType extends t.Type<StageNumber> {
  constructor() {
    super(
      'StageNumber',
      (value): value is StageNumber => value === '1' || value === '2',
      (value, context) => {
        if (this.is(value)) return t.success(value);
        if (value === 1 || value === 2) {
          const stageNumber = toEndevorStageNumber(value);
          if (stageNumber) return t.success(stageNumber);
        }
        return t.failure(value, context);
      },
      (value) => value
    );
  }
}

class ElementStatusType extends t.Type<ElementStatus> {
  constructor() {
    super(
      'ElementStatus',
      (value): value is ElementStatus =>
        value === 'N' ||
        value === 'I' ||
        value === 'C' ||
        value === 'M' ||
        value === 'CR',
      (value, context) =>
        this.is(value) ? t.success(value) : t.failure(value, context),
      (value) => value
    );
  }
}

class ElementActionType extends t.Type<ElementAction> {
  constructor() {
    super(
      'ElementAction',
      (value): value is ElementAction =>
        value === 'INT' ||
        value === 'RET' ||
        value === 'ADD' ||
        value === 'UPD' ||
        value === 'UPDSYN' ||
        value === 'CON' ||
        value === 'VALSYN' ||
        value === 'MERGE' ||
        value === 'LOCDEL' ||
        value === 'REMDEL',
      (value, context) =>
        this.is(value) ? t.success(value) : t.failure(value, context),
      (value) => value
    );
  }
}
class ElementActionStatusType extends t.Type<ElementActionStatus> {
  constructor() {
    super(
      'ElementActionStatus',
      (value): value is ElementActionStatus =>
        value === 'NORUN' ||
        value === 'OK' ||
        value === 'WARN' ||
        value === 'FAIL',
      (value, context) =>
        this.is(value) ? t.success(value) : t.failure(value, context),
      (value) => value
    );
  }
}

class ElementActionDetailedStatusType extends t.Type<ElementActionDetailedStatus> {
  constructor() {
    super(
      'ElementActionDetailedStatus',
      (value): value is ElementActionDetailedStatus =>
        value === 'NORUN' ||
        value === 'NORUN_CCID' ||
        value === 'NORUN_COMM' ||
        value === 'NORUN_CCID_COMM' ||
        value === 'NORUN_MERGE' ||
        value === 'OK' ||
        value === 'OK_NOCHANGE' ||
        value === 'OK_MANUAL_MERGE' ||
        value === 'OK_AUTOMERGE' ||
        value === 'OK_IN_SYNC' ||
        value === 'OK_OUT_OF_SYNC' ||
        value === 'OK_SYNC_DISABLED' ||
        value === 'WARN' ||
        value === 'FAIL' ||
        value === 'FAIL_MAX_RC' ||
        value === 'FAIL_STC_SHORT' ||
        value === 'FAIL_NOT_FOUND' ||
        value === 'FAIL_FP_CHECK' ||
        value === 'FAIL_SIGNOUT' ||
        value === 'FAIL_MERGE_LOC',
      (value, context) =>
        this.is(value) ? t.success(value) : t.failure(value, context),
      (value) => value
    );
  }
}

export const WorkspaceFileVersion = t.type({
  sha1: t.string,
  sha1File: t.string,
});

const WorkspaceElementSignificantPart = t.type({
  type: t.string,
  fullName: t.string,
  localFile: t.string,
  localStatus: new ElementStatusType(),
  localFileVersion: WorkspaceFileVersion,
});

export const WorkspaceElement = t.intersection([
  WorkspaceElementSignificantPart,
  t.UnknownRecord,
]);

export const WorkspaceSubsystem = t.type({
  name: t.string,
  elements: t.UnknownRecord, // check element type separately
});

const WorkspaceSystemSignificantPart = t.type({
  name: t.string,
  subsystems: t.record(t.string, WorkspaceSubsystem),
});

export const WorkspaceSystem = t.intersection([
  WorkspaceSystemSignificantPart,
  t.UnknownRecord,
]);

const WorkspaceEnvironmentStageSignificantPart = t.type({
  envName: t.string,
  stageNumber: new StageNumberType(),
  systems: t.record(t.string, WorkspaceSystem),
});

export const WorkspaceEnvironmentStage = t.intersection([
  WorkspaceEnvironmentStageSignificantPart,
  t.UnknownRecord,
]);

const WorkspaceStateSignificantPart = t.type({
  environments: t.record(t.string, WorkspaceEnvironmentStage),
});

export const WorkspaceState = t.intersection([
  WorkspaceStateSignificantPart,
  t.UnknownRecord,
]);

const WorkspaceActionResultSignificantPart = t.type({
  action: new ElementActionType(),
  environment: t.string,
  stageNumber: new StageNumberType(),
  system: t.string,
  subsystem: t.string,
  type: t.string,
  fullElementName: t.string,
  localFile: t.string,
  status: new ElementActionStatusType(),
  statusDetailed: new ElementActionDetailedStatusType(),
  errorMessages: t.array(t.string),
});

export const WorkspaceActionResult = t.intersection([
  WorkspaceActionResultSignificantPart,
  t.UnknownRecord,
]);
export const WorkspaceActionResults = t.array(WorkspaceActionResult);

const WorkspaceResponseSignificantPart = t.type({
  actions: WorkspaceActionResults,
  messages: t.array(t.string),
  inSync: t.boolean,
  unresolvedMergeConflicts: t.boolean,
  signoutOverrideNeeded: t.boolean,
});

export const WorkspaceResponse = t.intersection([
  WorkspaceResponseSignificantPart,
  t.UnknownRecord,
]);
