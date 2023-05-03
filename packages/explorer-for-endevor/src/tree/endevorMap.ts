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

import { EndevorMap } from '../_doc/Endevor';
import {
  EnvironmentStage,
  System,
  SubSystem,
  StageNumber,
  LastEnvironmentStage,
  IntermediateEnvironmentStage,
  SystemMapPath,
  SubSystemMapPath,
  EnvironmentStageMapPath,
} from '@local/endevor/_doc/Endevor';
import { isDefined, isNotLastEnvStage } from '../utils';
import { toSubsystemMapPathId } from '../store/utils';

export const toEndevorMapWithWildcards =
  (environmentStages: ReadonlyArray<EnvironmentStage>) =>
  (systems: ReadonlyArray<System>) =>
  (subSystems: ReadonlyArray<SubSystem>) =>
  ({ environment, stageNumber }: EnvironmentStageMapPath): EndevorMap => {
    const matchingSubSystems = subSystems.filter((subSys) => {
      return (
        subSys.environment === environment && subSys.stageNumber === stageNumber
      );
    });
    const accumulator: EndevorMap = {};
    return matchingSubSystems.reduce((accum, subSystem) => {
      const subsystemMap =
        toEndevorMap(environmentStages)(systems)(subSystems)(subSystem);
      return {
        ...accum,
        ...subsystemMap,
      };
    }, accumulator);
  };

export const toEndevorMap =
  (environmentStages: ReadonlyArray<EnvironmentStage>) =>
  (systems: ReadonlyArray<System>) =>
  (subSystems: ReadonlyArray<SubSystem>) =>
  ({
    environment,
    stageNumber,
    system,
    subSystem,
  }: SubSystemMapPath): EndevorMap => {
    const environmentStagesSequence: Array<EnvironmentStage> = [];
    const initialIndex = 0;
    const addEnvironmentStage = (
      environment: string,
      stageNumber: StageNumber
    ): void => {
      const matchingEnv = environmentStages.find(
        (env) =>
          env.environment === environment && env.stageNumber === stageNumber
      );
      if (!isDefined(matchingEnv)) {
        // wrong search environment provided
        return;
      }
      if (!isNotLastEnvStage(matchingEnv)) {
        // this is the last environment in the sequence
        const lastEnvStage: LastEnvironmentStage = matchingEnv;
        environmentStagesSequence.push(lastEnvStage);
        return;
      }
      const envStage: IntermediateEnvironmentStage = matchingEnv;
      // this is intermediate environment in the sequence
      environmentStagesSequence.push(matchingEnv);
      addEnvironmentStage(envStage.nextEnvironment, envStage.nextStageNumber);
    };
    addEnvironmentStage(environment, stageNumber);

    const systemsSequence: Array<System> = [];
    const addSystem =
      ({ environment, stageNumber, system }: SystemMapPath) =>
      (environmentStageSequenceIndex: number): void => {
        const matchingEnv =
          environmentStagesSequence[environmentStageSequenceIndex];
        if (!matchingEnv) {
          // wrong environment stage passed
          return;
        }
        const matchingSystem = systems.find(
          (sys) =>
            sys.environment === environment &&
            sys.stageNumber === stageNumber &&
            sys.system === system
        );
        if (!isDefined(matchingSystem)) {
          // wrong system passed
          return;
        }
        if (!isNotLastEnvStage(matchingEnv)) {
          // this is the last environment stage
          systemsSequence.push(matchingSystem);
          return;
        }
        // this is not the last environment stage
        systemsSequence.push(matchingSystem);
        const systemWithinEnv = matchingSystem.system;
        const systemFromNextEnv = matchingSystem.nextSystem;
        addSystem({
          environment: matchingEnv.nextEnvironment,
          stageNumber: matchingEnv.nextStageNumber,
          system:
            matchingEnv.stageNumber === '1'
              ? systemWithinEnv
              : systemFromNextEnv,
        })(environmentStageSequenceIndex + 1);
      };
    addSystem({
      environment,
      stageNumber,
      system,
    })(initialIndex);

    const subsystemsSequence: Array<SubSystem> = [];
    const addSubsystem =
      ({ environment, stageNumber, system, subSystem }: SubSystemMapPath) =>
      (systemsSequenceIndex: number): void => {
        const matchingEnv = environmentStagesSequence[systemsSequenceIndex];
        if (!matchingEnv) {
          // wrong environment stage passed
          return;
        }
        const matchingSystem = systemsSequence[systemsSequenceIndex];
        if (!isDefined(matchingSystem)) {
          // wrong system passed
          return;
        }
        const matchingSubSystem = subSystems.find(
          (subSys) =>
            subSys.environment === environment &&
            subSys.stageNumber === stageNumber &&
            subSys.system === system &&
            subSys.subSystem === subSystem
        );
        if (!isDefined(matchingSubSystem)) {
          // wrong subsystem passed
          return;
        }
        if (!isNotLastEnvStage(matchingEnv)) {
          // this is the last environment stage
          subsystemsSequence.push(matchingSubSystem);
          return;
        }
        // this is not the last environment stage
        subsystemsSequence.push(matchingSubSystem);
        const systemWithinEnv = matchingSystem.system;
        const systemFromNextEnv = matchingSystem.nextSystem;
        const subsysWithinEnv = matchingSubSystem.subSystem;
        const subsysFromNextEnv = matchingSubSystem.nextSubSystem;
        addSubsystem({
          environment: matchingEnv.nextEnvironment,
          stageNumber: matchingEnv.nextStageNumber,
          system:
            matchingEnv.stageNumber === '1'
              ? systemWithinEnv
              : systemFromNextEnv,
          subSystem:
            matchingEnv.stageNumber === '1'
              ? subsysWithinEnv
              : subsysFromNextEnv,
        })(systemsSequenceIndex + 1);
      };
    addSubsystem({ environment, stageNumber, system, subSystem })(initialIndex);

    const searchSubSystemId = toSubsystemMapPathId({
      environment,
      stageNumber,
      system,
      subSystem,
    });
    const [, ...subsystemRoute] = subsystemsSequence.map((subSystemMapPath) =>
      toSubsystemMapPathId(subSystemMapPath)
    );
    return {
      [searchSubSystemId]: subsystemRoute,
    };
  };
