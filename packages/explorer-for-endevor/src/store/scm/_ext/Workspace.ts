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

export type ElementStatus = 'N' | 'I' | 'C' | 'M' | 'CR';

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
