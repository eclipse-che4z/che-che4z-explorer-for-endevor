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

import * as t from 'io-ts';
import { toEndevorStageNumber } from '../utils';
import { StageNumber } from '../_doc/Endevor';

// "What makes io-ts uniquely valuable is that it simultaneously defines a runtime validator and a static type."
// https://www.olioapps.com/blog/checking-types-real-world-typescript/

export type Configuration = t.TypeOf<typeof Configuration>;
export type Configurations = t.TypeOf<typeof Configurations>;

export type EnvironmentStage = t.TypeOf<typeof EnvironmentStage>;

export type System = t.TypeOf<typeof System>;
export type Systems = t.TypeOf<typeof Systems>;

export type SubSystem = t.TypeOf<typeof SubSystem>;
export type SubSystems = t.TypeOf<typeof SubSystems>;

export type Element = t.TypeOf<typeof Element>;
export type Elements = t.TypeOf<typeof Elements>;

export type DependentElement = t.TypeOf<typeof DependentElement>;
export type DependentElements = t.TypeOf<typeof DependentElements>;

export type ElementDependency = t.TypeOf<typeof ElementDependency>;
export type ElementDependencies = t.TypeOf<typeof ElementDependencies>;

export type Content = t.TypeOf<typeof Content>;

export type BaseResponse = t.TypeOf<typeof BaseResponse>;
export type BaseResponseWithUnknownData = t.TypeOf<
  typeof BaseResponseWithUnknownData
>;
export type BaseResponseWithMessages = t.TypeOf<
  typeof BaseResponseWithMessages
>;
export type ErrorResponse = t.TypeOf<typeof ErrorResponse>;

export type V1ApiVersionResponse = t.TypeOf<typeof V1ApiVersionResponse>;
export type V2ApiVersionResponse = t.TypeOf<typeof V2ApiVersionResponse>;

export type SuccessPrintResponse = t.TypeOf<typeof SuccessPrintResponse>;
export type SuccessRetrieveResponse = t.TypeOf<typeof SuccessRetrieveResponse>;
export type SuccessListElementsResponse = t.TypeOf<
  typeof SuccessListElementsResponse
>;
export type SuccessListConfigurationsResponse = t.TypeOf<
  typeof SuccessListConfigurationsResponse
>;
export type SuccessListEnvironmentStagesResponse = t.TypeOf<
  typeof SuccessListEnvironmentStagesResponse
>;
export type SuccessListSystemsResponse = t.TypeOf<
  typeof SuccessListSystemsResponse
>;
export type SuccessListSubSystemsResponse = t.TypeOf<
  typeof SuccessListSubSystemsResponse
>;
export type SuccessListDependenciesResponse = t.TypeOf<
  typeof SuccessListDependenciesResponse
>;
export type UpdateResponse = t.TypeOf<typeof UpdateResponse>;

export type AddResponse = t.TypeOf<typeof AddResponse>;

export const Configuration = t.type({
  name: t.string,
  description: t.string,
});
export const Configurations = t.array(Configuration);

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

export const System = t.type({
  envName: t.string,
  stgId: new StageNumberType(),
  stgSeqNum: t.number,
  sysName: t.string,
  nextSys: t.string,
});
export const Systems = t.array(System);

export const SubSystem = t.type({
  envName: t.string,
  stgId: new StageNumberType(),
  stgSeqNum: t.number,
  sysName: t.string,
  sbsName: t.string,
  nextSbs: t.string,
});
export const SubSystems = t.array(SubSystem);

const Path = t.type({
  envName: t.string,
  stgNum: new StageNumberType(),
  sysName: t.string,
  sbsName: t.string,
  typeName: t.string,
  elmName: t.string,
  fullElmName: t.string,
});

export const EnvironmentStage = t.type({
  envName: t.string,
  stgNum: new StageNumberType(),
  nextEnv: t.union([t.string, t.null]),
  nextStgNum: t.union([new StageNumberType(), t.null]),
});

export const Element = t.intersection([
  Path,
  t.partial({
    fileExt: t.union([t.string, t.null]),
  }),
]);
export const Elements = t.array(Element);

export const DependentElement = Element;
export const DependentElements = t.array(DependentElement);

export const ElementDependency = t.type({
  components: t.array(DependentElement),
});
export const ElementDependencies = t.array(ElementDependency);

export const Content = t.string;

// new type for general response parsing
export const BaseResponse = t.type({
  body: t.type({
    statusCode: t.number,
    returnCode: new ReturnCodeType(),
  }),
});

export const BaseResponseWithMessages = t.type({
  body: t.type({
    statusCode: t.number,
    returnCode: new ReturnCodeType(),
    messages: t.array(t.string),
  }),
});

export const BaseResponseWithUnknownData = t.type({
  body: t.type({
    statusCode: t.number,
    data: t.array(t.unknown),
  }),
});

export const ErrorResponse = BaseResponseWithMessages;

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

export const SuccessPrintResponse = t.type({
  body: t.type({
    statusCode: t.number,
    returnCode: new ReturnCodeType(),
    data: t.array(Content),
  }),
});
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

export const SuccessRetrieveResponse = t.type({
  body: t.type({
    statusCode: t.number,
    returnCode: new ReturnCodeType(),
    data: t.array(new RetrieveContentType()),
  }),
  headers: t.type({
    fingerprint: t.string,
  }),
});

export const SuccessListConfigurationsResponse = t.type({
  body: t.type({
    returnCode: new ReturnCodeType(),
    data: t.array(t.unknown),
  }),
});

export const SuccessListEnvironmentStagesResponse = BaseResponseWithUnknownData;
export const SuccessListSystemsResponse = BaseResponseWithUnknownData;
export const SuccessListSubSystemsResponse = BaseResponseWithUnknownData;
export const SuccessListElementsResponse = BaseResponseWithUnknownData;

export const SuccessListDependenciesResponse = t.type({
  body: t.type({
    statusCode: t.number,
    returnCode: new ReturnCodeType(),
    data: t.array(
      t.type({
        components: t.union([t.array(t.unknown), t.undefined]),
      })
    ),
  }),
});

export const UpdateResponse = BaseResponseWithMessages;
export const AddResponse = BaseResponseWithMessages;
