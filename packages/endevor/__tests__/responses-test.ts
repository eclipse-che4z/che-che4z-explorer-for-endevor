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

import { parseToType } from '@local/type-parser/parser';
import {
  ErrorResponse,
  SuccessListDependenciesResponse,
  SuccessListElementsResponse,
  SuccessListConfigurationsResponse,
  SuccessPrintResponse,
  SuccessRetrieveResponse,
  UpdateResponse,
  BaseResponse,
  SuccessListEnvironmentStagesResponse,
  SuccessListSystemsResponse,
  SuccessListSubSystemsResponse,
  V1ApiVersionResponse,
  V2ApiVersionResponse,
} from '../_ext/Endevor';

describe('Endevor responses type parsing', () => {
  describe('Endevor API v1 response type parsing', () => {
    it('should parse a response with version header', () => {
      // arrange
      const response = {
        headers: {
          'api-version': '1.1',
        },
      };
      // act
      const parsedResponse = parseToType(V1ApiVersionResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without version header', () => {
      // arrange
      const response = {
        headers: {},
      };
      // act && assert
      expect(() =>
        parseToType(V1ApiVersionResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect version header', () => {
      // arrange
      const response = {
        headers: {
          'api-version': 1.1,
        },
      };
      // act && assert
      expect(() =>
        parseToType(V1ApiVersionResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor API v2 response type parsing', () => {
    it('should parse a response with version header', () => {
      // arrange
      const response = {
        headers: {
          version: '2.5',
        },
      };
      // act
      const parsedResponse = parseToType(V2ApiVersionResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without version header', () => {
      // arrange
      const response = {
        headers: {},
      };
      // act && assert
      expect(() =>
        parseToType(V2ApiVersionResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect version header', () => {
      // arrange
      const response = {
        headers: {
          version: 2.5,
        },
      };
      // act && assert
      expect(() =>
        parseToType(V2ApiVersionResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor configurations response type parsing', () => {
    it('should parse a response with any data and correct return code', () => {
      // arrange
      const anyData = [
        {
          some_name: 'blah',
        },
        {
          some_different_name: 'blah',
        },
        {
          name: 'real_name',
        },
      ];
      const returnCode = 8;
      const response = {
        body: {
          returnCode,
          data: anyData,
        },
      };
      // act
      const parsedResponse = parseToType(
        SuccessListConfigurationsResponse,
        response
      );
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without return code', () => {
      // arrange
      const anyData = [
        {
          some_name: 'blah',
        },
        {
          some_different_name: 'blah',
        },
      ];
      const response = {
        body: {
          data: anyData,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessListConfigurationsResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect return code', () => {
      // arrange
      const anyData = [
        {
          some_name: 'blah',
        },
        {
          some_different_name: 'blah',
        },
      ];
      const response = {
        body: {
          returnCode: '8',
          data: anyData,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessListConfigurationsResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with only return code', () => {
      // arrange
      const response = {
        body: {
          returnCode: 8,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessListConfigurationsResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor base response type parsing', () => {
    it('should parse a response with correct return code', () => {
      // arrange
      const response = {
        body: {
          returnCode: 42,
          statusCode: 200,
        },
      };
      // act
      const parsedResponse = parseToType(BaseResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response with incorrect return code', () => {
      // arrange
      const response = {
        body: {
          statusCode: 200,
          returnCode: '8',
        },
      };
      // act && assert
      expect(() =>
        parseToType(BaseResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with nullable status code', () => {
      // arrange
      const response = {
        body: {
          statusCode: null,
          returnCode: 8,
        },
      };
      // act && assert
      expect(() =>
        parseToType(BaseResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with nullable return code', () => {
      // arrange
      const response = {
        body: {
          statusCode: 200,
          returnCode: null,
        },
      };
      // act && assert
      expect(() =>
        parseToType(BaseResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response without return code', () => {
      // arrange
      const response = {
        body: {
          statusCode: 200,
        },
      };
      // act && assert
      expect(() =>
        parseToType(BaseResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response without status code', () => {
      // arrange
      const response = {
        body: {
          returnCode: 8,
        },
      };
      // act && assert
      expect(() =>
        parseToType(BaseResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor systems response type parsing', () => {
    it('should parse a response with any systems', () => {
      // arrange
      const anyData = [
        {
          whaaat: 'whaaaat???',
        },
        {
          whatttttt: 'whattttt??',
        },
        {
          envName: 'test',
          sysName: 'test-sys',
          stgSeqNum: 1,
        },
      ];
      const successResponse = {
        body: {
          data: anyData,
          statusCode: 200,
        },
      };
      // act
      const parsedResponse = parseToType(
        SuccessListSystemsResponse,
        successResponse
      );
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without systems', () => {
      // arrange
      const errorResponse = {
        body: {
          returnCode: 8,
          statusCode: 400,
          data: null,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessListSystemsResponse, errorResponse)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor subsystems response type parsing', () => {
    it('should parse a response with any subsystems', () => {
      // arrange
      const anyData = [
        {
          whaaat: 'whaaaat???',
        },
        {
          whatttttt: 'whattttt??',
        },
        {
          envName: 'test',
          sysName: 'test-sys',
          sbsName: 'test-subsys',
          stgSeqNum: 1,
        },
      ];
      const successResponse = {
        body: {
          statusCode: 200,
          data: anyData,
        },
      };
      // act
      const parsedResponse = parseToType(
        SuccessListSubSystemsResponse,
        successResponse
      );
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without subsystems', () => {
      // arrange
      const errorResponse = {
        body: {
          returnCode: 8,
          statusCode: 400,
          data: null,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessListSubSystemsResponse, errorResponse)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor elements response type parsing', () => {
    it('should parse a response with any elements', () => {
      // arrange
      const anyData = [
        {
          whaaat: 'whaaaat???',
        },
        {
          whatttttt: 'whattttt??',
        },
      ];
      const response = {
        body: {
          data: anyData,
          statusCode: 200,
        },
      };
      // act
      const parsedResponse = parseToType(SuccessListElementsResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without data', () => {
      // arrange
      const response = {
        body: {
          returnCode: 8,
          statusCode: 400,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessListElementsResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor print element and listing response type parsing', () => {
    it('should parse a proper response', () => {
      // arrange
      const returnCode = 0;
      const elementContent = 'very important content';
      const response = {
        body: {
          returnCode,
          statusCode: 200,
          data: [elementContent],
        },
      };
      // act
      const parsedResponse = parseToType(SuccessPrintResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without data', () => {
      // arrange
      const returnCode = 0;
      const response = {
        body: {
          returnCode,
          statusCode: 400,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessPrintResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect data', () => {
      // arrange
      const returnCode = 0;
      const elementContent = {
        firstParagraph: 'blah',
        secondParagraph: 'blahblah',
      };
      const response = {
        body: {
          returnCode,
          statusCode: 200,
          data: [elementContent],
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessPrintResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor retrieve element response type parsing', () => {
    it('should parse a proper response', () => {
      // arrange
      const returnCode = 0;
      const elementContent = 'very important content';
      const fingerprint = 'fingerprint';
      const response = {
        body: {
          returnCode,
          statusCode: 200,
          data: [Buffer.from(elementContent)],
        },
        headers: {
          fingerprint,
        },
      };
      // act
      const parsedResponse = parseToType(SuccessRetrieveResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without data', () => {
      // arrange
      const returnCode = 0;
      const fingerprint = 'fingerprint';
      const response = {
        body: {
          returnCode,
          statusCode: 400,
        },
        headers: {
          fingerprint,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessRetrieveResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response without fingerprint', () => {
      // arrange
      const returnCode = 0;
      const elementContent = 'very important content';
      const response = {
        body: {
          returnCode,
          statusCode: 400,
          data: [Buffer.from(elementContent)],
        },
        headers: {},
      };
      // act && assert
      expect(() =>
        parseToType(SuccessRetrieveResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect data', () => {
      // arrange
      const returnCode = 0;
      const fingerprint = 'fingerprint';
      const elementContent = {
        firstParagraph: 'blah',
        secondParagraph: 'blahblah',
      };
      const response = {
        body: {
          returnCode,
          statusCode: 200,
          data: [elementContent],
        },
        headers: {
          fingerprint,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessRetrieveResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor element dependencies response type parsing', () => {
    it('should parse a response with any dependencies', () => {
      // arrange
      const anyData = [
        undefined,
        {
          is_it_dependency: 'noooooo',
        },
      ];
      const returnCode = 0;
      const response = {
        body: {
          returnCode,
          statusCode: 200,
          data: [
            {
              components: anyData,
            },
          ],
        },
      };
      // act
      const parsedResponse = parseToType(
        SuccessListDependenciesResponse,
        response
      );
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without data', () => {
      // arrange
      const returnCode = 8;
      const response = {
        body: {
          returnCode,
          statusCode: 400,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessListDependenciesResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor update and generate response type parsing', () => {
    it('should parse a proper response', () => {
      // arrange
      const returnCode = 0;
      const messages = ['Relax, everything will be fine!'];
      const response = {
        body: {
          returnCode,
          messages,
          statusCode: 200,
        },
      };
      // act
      const parsedResponse = parseToType(UpdateResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without return code', () => {
      // arrange
      const messages = ['Relax, everything will be fine!'];
      const response = {
        body: {
          messages,
          statusCode: 400,
        },
      };
      // act && assert
      expect(() =>
        parseToType(UpdateResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect return code', () => {
      // arrange
      const returnCode = '8';
      const messages = ['Relax, everything will be fine!'];
      const response = {
        body: {
          returnCode,
          messages,
          statusCode: 200,
        },
      };
      // act && assert
      expect(() =>
        parseToType(UpdateResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response without status code', () => {
      // arrange
      const returnCode = 8;
      const messages = ['Relax, everything will be fine!'];
      const response = {
        body: {
          returnCode,
          messages,
        },
      };
      // act && assert
      expect(() =>
        parseToType(UpdateResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect status code', () => {
      // arrange
      const returnCode = 8;
      const messages = ['Relax, everything will be fine!'];
      const response = {
        body: {
          returnCode,
          messages,
          statusCode: '400',
        },
      };
      // act && assert
      expect(() =>
        parseToType(UpdateResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response without messages', () => {
      // arrange
      const returnCode = 0;
      const response = {
        body: {
          returnCode,
          statusCode: 400,
        },
      };
      // act && assert
      expect(() =>
        parseToType(UpdateResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect messages', () => {
      // arrange
      const returnCode = 8;
      const messages = { messageValue: 'Relax, everything will be fine!' };
      const response = {
        body: {
          returnCode,
          messages,
          statusCode: 400,
        },
      };
      // act && assert
      expect(() =>
        parseToType(UpdateResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor error response type parsing', () => {
    it('should parse a proper response', () => {
      // arrange
      const returnCode = 8;
      const messages = ['Oops, I did it again!'];
      const response = {
        body: {
          returnCode,
          messages,
          statusCode: 400,
        },
      };
      // act
      const parsedResponse = parseToType(ErrorResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without return code', () => {
      // arrange
      const messages = ['Oops, I did it again!'];
      const response = {
        body: {
          messages,
          statusCode: 400,
        },
      };
      // act && assert
      expect(() =>
        parseToType(ErrorResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect return code', () => {
      // arrange
      const messages = ['Oops, I did it again!'];
      const returnCode = '8';
      const response = {
        body: {
          messages,
          returnCode,
          statusCode: 400,
        },
      };
      // act && assert
      expect(() =>
        parseToType(ErrorResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response without messages', () => {
      // arrange
      const returnCode = 8;
      const response = {
        body: {
          returnCode,
          statusCode: 400,
        },
      };
      // act && assert
      expect(() =>
        parseToType(ErrorResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response without status code', () => {
      // arrange
      const returnCode = 8;
      const messages = ['Oops, I did it again!'];
      const response = {
        body: {
          returnCode,
          messages,
        },
      };
      // act && assert
      expect(() =>
        parseToType(ErrorResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect status code', () => {
      // arrange
      const returnCode = 8;
      const messages = ['Oops, I did it again!'];
      const response = {
        body: {
          returnCode,
          messages,
          statusCode: '400',
        },
      };
      // act && assert
      expect(() =>
        parseToType(ErrorResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
    it('should throw an error for a response with incorrect messages', () => {
      // arrange
      const messages = [
        {
          value: 'Oops, I did it again!',
        },
      ];
      const returnCode = 8;
      const response = {
        body: {
          messages,
          returnCode,
          statusCode: 400,
        },
      };
      // act && assert
      expect(() =>
        parseToType(ErrorResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });
  describe('Endevor environment stages response type parsing', () => {
    it('should parse a response with any data', () => {
      // arrange
      const anyData = [
        {
          some_name: 'blah',
        },
        {
          some_different_name: 'blah',
        },
        {
          name: 'real_name',
        },
      ];
      const response = {
        body: {
          statusCode: 200,
          data: anyData,
        },
      };
      // act
      const parsedResponse = parseToType(
        SuccessListEnvironmentStagesResponse,
        response
      );
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });
    it('should throw an error for a response without environment stages', () => {
      // arrange
      const errorResponse = {
        body: {
          statusCode: 200,
          data: null,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SuccessListEnvironmentStagesResponse, errorResponse)
      ).toThrowErrorMatchingSnapshot();
    });
  });
});
