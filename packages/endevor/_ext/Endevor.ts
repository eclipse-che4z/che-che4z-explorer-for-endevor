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

import * as t from 'io-ts';
import { toEndevorReportId, toEndevorStageNumber } from '../utils';
import { StageNumber } from '../_doc/Endevor';

// "What makes io-ts uniquely valuable is that it simultaneously defines a runtime validator and a static type."
// https://www.olioapps.com/blog/checking-types-real-world-typescript/

export type Configuration = t.TypeOf<typeof Configuration>;

export type EnvironmentStage = t.TypeOf<typeof EnvironmentStage>;

export type System = t.TypeOf<typeof System>;

export type SubSystem = t.TypeOf<typeof SubSystem>;

export type ElementType = t.TypeOf<typeof ElementType>;

export type Element = t.TypeOf<typeof Element>;

export type Component = t.TypeOf<typeof Component>;
export type Components = t.TypeOf<typeof Components>;

export type Content = t.TypeOf<typeof Content>;

export type V1ApiVersionResponse = t.TypeOf<typeof V1ApiVersionResponse>;
export type V2ApiVersionResponse = t.TypeOf<typeof V2ApiVersionResponse>;

export type PrintResponse = t.TypeOf<typeof PrintResponse>;
export type RetrieveResponse = t.TypeOf<typeof RetrieveResponse>;

export type ConfigurationsResponse = t.TypeOf<typeof ConfigurationsResponse>;
export type EnvironmentStagesResponse = t.TypeOf<
  typeof EnvironmentStagesResponse
>;
export type SystemsResponse = t.TypeOf<typeof SystemsResponse>;
export type SubSystemsResponse = t.TypeOf<typeof SubSystemsResponse>;
export type ElementTypesResponse = t.TypeOf<typeof ElementTypesResponse>;
export type ElementsResponse = t.TypeOf<typeof ElementsResponse>;

export type ComponentsResponse = t.TypeOf<typeof ComponentsResponse>;
export type UpdateResponse = t.TypeOf<typeof UpdateResponse>;

export type AddResponse = t.TypeOf<typeof AddResponse>;

export type GenerateResponse = t.TypeOf<typeof GenerateResponse>;

export type SignInElementResponse = t.TypeOf<typeof SignInElementResponse>;

export type AuthenticationTokenResponse = t.TypeOf<
  typeof AuthenticationTokenResponse
>;

export const Configuration = t.type({
  name: t.string,
  description: t.string,
});

class StageNumberType extends t.Type<StageNumber> {
  constructor() {
    super(
      'StageNumber',
      (value): value is StageNumber => `${value}` === '1' || `${value}` === '2',
      (value, context) =>
        this.is(value)
          ? t.success(this.encode(value))
          : t.failure(value, context),
      // it will be already checked within type guard
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (value) => toEndevorStageNumber(value)!
    );
  }
}

class ReturnCodeType extends t.Type<number> {
  constructor() {
    super(
      'ReturnCode',
      (value): value is number =>
        value != null && typeof value !== 'string' && !isNaN(Number(value)),
      (value, context) =>
        this.is(value)
          ? t.success(this.encode(value))
          : t.failure(value, context),
      // it will be already checked within type guard
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (value) => value
    );
  }
}

class ReportIdType extends t.Type<string> {
  constructor(reportName: string) {
    super(
      reportName,
      (value): value is string => value != null && typeof value !== 'number',
      (value, context) =>
        this.is(value)
          ? t.success(this.encode(value))
          : t.failure(value, context),
      // it will be already checked within type guard
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (value) => toEndevorReportId(value)
    );
  }
}

export const EnvironmentStage = t.type({
  envName: t.string,
  stgNum: new StageNumberType(),
  stgId: t.string,
  nextEnv: t.union([t.string, t.null]),
  nextStgNum: t.union([new StageNumberType(), t.null]),
});

export const System = t.type({
  envName: t.string,
  stgId: t.string,
  sysName: t.string,
  nextSys: t.string,
});

export const SubSystem = t.type({
  envName: t.string,
  stgId: t.string,
  sysName: t.string,
  sbsName: t.string,
  nextSbs: t.string,
});

export const ElementType = t.type({
  envName: t.string,
  stgId: t.string,
  sysName: t.string,
  typeName: t.string,
  nextType: t.string,
});

const ElementPath = t.type({
  envName: t.string,
  stgNum: new StageNumberType(),
  sysName: t.string,
  sbsName: t.string,
  typeName: t.string,
  elmName: t.string,
});

export const Element = t.intersection([
  ElementPath,
  t.type({
    fullElmName: t.string,
    nosource: t.string,
  }),
  t.partial({
    lastActCcid: t.union([t.string, t.null]),
    fileExt: t.union([t.string, t.null]),
  }),
]);

export const Component = ElementPath;
export const Components = t.array(Component);

export const Content = t.string;

const BaseResponseValues = t.type({
  statusCode: t.number,
  returnCode: new ReturnCodeType(),
  // TODO add extra response info
  // reasonCode: new ReturnCodeType(),
  // reports: t.type({
  //  TODO add report types
  // }),
  messages: t.array(t.string),
});

const BaseResponseWithNoData = t.type({
  body: BaseResponseValues,
});

const BaseResponseWithUnknownData = t.type({
  body: t.intersection([
    BaseResponseValues,
    t.type({
      data: t.array(t.unknown),
    }),
  ]),
});

// TODO: to be compatible with some v1 api error response types, remove when unnecessary
const BaseResponseWithUnknownDataOrNull = t.type({
  body: t.intersection([
    BaseResponseValues,
    t.type({
      data: t.union([t.array(t.unknown), t.null]),
    }),
  ]),
});

const BaseResponseWithContentOrNull = t.type({
  body: t.intersection([
    BaseResponseValues,
    t.type({
      data: t.union([t.array(Content), t.null]),
    }),
  ]),
});

export const V1ApiVersionResponse = t.type({
  headers: t.type({
    'api-version': t.string,
  }),
});

export const V2ApiVersionResponse = t.type({
  headers: t.type({
    version: t.string,
  }),
});

export const ConfigurationsResponse = BaseResponseWithUnknownData;

class StringWithNumberType extends t.Type<string, number> {
  constructor() {
    super(
      'StringWithNumber',
      (value): value is string =>
        value != null && typeof value === 'string' && !isNaN(Number(value)),
      (value, context) =>
        this.is(value) ? t.success(value) : t.failure(value, context),
      (value) => parseInt(value, 10)
    );
  }
}

export const AuthenticationTokenResponse = t.type({
  headers: t.partial({
    'api-version': t.string,
    version: t.string,
  }),
  body: t.intersection([
    BaseResponseValues,
    t.type({
      data: t.array(
        t.type({
          token: t.string,
          tokenValidFor: new StringWithNumberType(),
        })
      ),
    }),
  ]),
});
// TODO: temporarily use relaxed type to be compatible with v1 api, remove when unnecessary
export const EnvironmentStagesResponse = BaseResponseWithUnknownDataOrNull;
export const SystemsResponse = BaseResponseWithUnknownDataOrNull;
export const SubSystemsResponse = BaseResponseWithUnknownDataOrNull;
export const ElementTypesResponse = BaseResponseWithUnknownDataOrNull;
export const ElementsResponse = BaseResponseWithUnknownDataOrNull;

export const PrintResponse = BaseResponseWithContentOrNull;

class RetrieveContentType extends t.Type<Buffer> {
  constructor() {
    super(
      'Buffer',
      (value): value is Buffer => Buffer.isBuffer(value),
      (value, context) =>
        this.is(value) ? t.success(value) : t.failure(value, context),
      (value) => value
    );
  }
}

export const RetrieveResponse = t.type({
  headers: t.partial({
    fingerprint: t.string,
  }),
  body: t.intersection([
    BaseResponseValues,
    t.type({
      data: t.array(new RetrieveContentType()),
    }),
  ]),
});

export const ComponentsResponse = t.type({
  body: t.intersection([
    BaseResponseValues,
    t.type({
      data: t.array(
        t.type({
          components: t.union([t.array(t.unknown), t.undefined]),
        })
      ),
    }),
  ]),
});

export const GenerateResponse = t.type({
  body: t.intersection([
    BaseResponseValues,
    t.type({
      reports: t.type({
        C1MSGS1: new ReportIdType('C1MSGS1'),
      }),
    }),
  ]),
});

export const UpdateResponse = BaseResponseWithNoData;
export const AddResponse = BaseResponseWithNoData;
export const SignInElementResponse = BaseResponseWithNoData;
