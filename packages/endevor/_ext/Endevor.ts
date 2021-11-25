/*
 * © 2021 Broadcom Inc and/or its subsidiaries; All rights reserved
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
import { StageNumber } from '../_doc/Endevor';

// "What makes io-ts uniquely valuable is that it simultaneously defines a runtime validator and a static type."
// https://www.olioapps.com/blog/checking-types-real-world-typescript/

export type Repository = t.TypeOf<typeof Repository>;
export type Repositories = t.TypeOf<typeof Repositories>;

export type Element = t.TypeOf<typeof Element>;
export type Elements = t.TypeOf<typeof Elements>;

export type DependentElement = t.TypeOf<typeof DependentElement>;
export type DependentElements = t.TypeOf<typeof DependentElements>;

export type ElementDependency = t.TypeOf<typeof ElementDependency>;
export type ElementDependencies = t.TypeOf<typeof ElementDependencies>;

export type Content = t.TypeOf<typeof Content>;

export type SuccessPrintResponse = t.TypeOf<typeof SuccessPrintResponse>;
export type SuccessRetrieveResponse = t.TypeOf<typeof SuccessRetrieveResponse>;
export type SuccessListElementsResponse = t.TypeOf<
  typeof SuccessListElementsResponse
>;
export type SuccessListRepositoriesResponse = t.TypeOf<
  typeof SuccessListRepositoriesResponse
>;
export type SuccessListDependenciesResponse = t.TypeOf<
  typeof SuccessListDependenciesResponse
>;
export type UpdateResponse = t.TypeOf<typeof UpdateResponse>;
export type GenerateResponse = t.TypeOf<typeof GenerateResponse>;

export type SignInResponse = t.TypeOf<typeof SignInResponse>;

export type AddResponse = t.TypeOf<typeof AddResponse>;

export type ErrorResponse = t.TypeOf<typeof ErrorResponse>;

export const Repository = t.type({
  name: t.string,
});
export const Repositories = t.array(Repository);

class StageNumberType extends t.Type<StageNumber> {
  constructor() {
    super(
      'StageNumber',
      (value): value is StageNumber => value === '1' || value === '2',
      (value, context) =>
        this.is(value) ? t.success(value) : t.failure(value, context),
      (value) => value
    );
  }
}

const Path = t.type({
  envName: t.string,
  stgNum: new StageNumberType(),
  sysName: t.string,
  sbsName: t.string,
  typeName: t.string,
  elmName: t.string,
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

export const SuccessPrintResponse = t.type({
  body: t.type({
    returnCode: t.number,
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
    returnCode: t.number,
    data: t.array(new RetrieveContentType()),
  }),
  headers: t.type({
    fingerprint: t.string,
  }),
});

export const SuccessListRepositoriesResponse = t.type({
  body: t.type({
    returnCode: t.number,
    data: t.array(t.unknown),
  }),
});

export const SuccessListElementsResponse = t.type({
  body: t.type({
    returnCode: t.number,
    data: t.array(t.unknown),
  }),
});

export const SuccessListDependenciesResponse = t.type({
  body: t.type({
    returnCode: t.number,
    data: t.array(
      t.type({
        components: t.union([t.array(t.unknown), t.undefined]),
      })
    ),
  }),
});

export const UpdateResponse = t.type({
  body: t.type({
    returnCode: t.number,
    messages: t.array(t.string),
  }),
});
export const GenerateResponse = UpdateResponse;

export const ErrorResponse = t.type({
  body: t.type({
    returnCode: t.number,
    messages: t.array(t.string),
  }),
});

export const SignInResponse = t.type({
  body: t.type({
    returnCode: t.number,
    messages: t.array(t.string),
  }),
});

export const AddResponse = t.type({
  body: t.type({
    returnCode: t.number,
    messages: t.array(t.string),
  }),
});
