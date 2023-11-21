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

type Preprocessor = {
  name: string;
  options?: {
    [key: string]: string;
  };
};

type Library =
  | {
      dataset: string;
      optional?: boolean;
      profile?: string;
    }
  | {
      environment: string;
      stage: string;
      system: string;
      subsystem: string;
      type: string;
      use_map?: boolean;
      optional?: boolean;
      profile?: string;
    };

/**
 * Derived from schema/processor_entry.schema.json
 */
type ProcGrpsSchemaJson = {
  name: string;
  libs: Library[];
  options?: {
    [key: string]: string;
  };
  preprocessor?: Preprocessor | Preprocessor[];
};

/**
 * Derived from schema/pgm_conf.schema.json
 */
type ProgramsSchemaJson = {
  program: string;
  pgroup: string;
  options?: {
    [key: string]: string;
  };
};

export type ExternalConfigurationResponse = {
  pgms: ReadonlyArray<ProgramsSchemaJson>;
  pgroups: ReadonlyArray<ProcGrpsSchemaJson>;
};

export type ExternalConfigurationProviderHandler = (
  uri: string
) =>
  | PromiseLike<ExternalConfigurationResponse | null>
  | ExternalConfigurationResponse
  | null;
