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

import { parseToType } from '@local/type-parser/parser';
import {
  ComponentsResponse,
  PrintResponse,
  RetrieveResponse,
  UpdateResponse,
  V1ApiVersionResponse,
  V2ApiVersionResponse,
  ConfigurationsResponse,
  EnvironmentStagesResponse,
  SystemsResponse,
  SubSystemsResponse,
  ElementTypesResponse,
  ElementsResponse,
} from '../_ext/Endevor';

describe('Endevor responses type parsing', () => {
  const statusCode = 200;
  const returnCode = 8;
  const messages = ['message 1', 'message 2'];

  describe('Endevor v1 api response type parsing', () => {
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

  describe('Endevor v2 api response type parsing', () => {
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
    const anyData = [
      {
        some_name: 'blah',
      },
      {
        some_different_name: 'blah',
      },
      {
        name: 'real_name',
        description: 'real description',
      },
    ];

    it('should parse a response with any data', () => {
      // arrange
      const response = {
        body: {
          statusCode,
          returnCode,
          data: anyData,
          messages,
        },
      };
      // act
      const parsedResponse = parseToType(ConfigurationsResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });

    // TODO disabled for compatibility with v1 api
    it.skip('should throw an error for a response without data', () => {
      // arrange
      const response = {
        body: {
          statusCode,
          returnCode,
          data: null,
          messages,
        },
      };
      // act && assert
      expect(() =>
        parseToType(ConfigurationsResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });

    it('should throw an error for a response without or incorrect status code', () => {
      // arrange
      const noStatusCodeResponse = {
        body: {
          returnCode,
          data: anyData,
          messages,
        },
      };
      const incorrectStatusCodeResponse = {
        body: {
          statusCode: statusCode.toString(),
          returnCode,
          data: anyData,
          messages,
        },
      };
      // act && assert
      expect(() =>
        parseToType(ConfigurationsResponse, noStatusCodeResponse)
      ).toThrowErrorMatchingSnapshot();
      expect(() =>
        parseToType(ConfigurationsResponse, incorrectStatusCodeResponse)
      ).toThrowErrorMatchingSnapshot();
    });

    it('should throw an error for a response without or incorrect return code', () => {
      // arrange
      const noReturnCodeResponse = {
        body: {
          statusCode,
          data: anyData,
          messages,
        },
      };
      const incorrectReturnCodeResponse = {
        body: {
          statusCode,
          returnCode: returnCode.toString(),
          data: anyData,
          messages,
        },
      };
      // act && assert
      expect(() =>
        parseToType(ConfigurationsResponse, noReturnCodeResponse)
      ).toThrowErrorMatchingSnapshot();
      expect(() =>
        parseToType(ConfigurationsResponse, incorrectReturnCodeResponse)
      ).toThrowErrorMatchingSnapshot();
    });

    it('should throw an error for a response without or incorrect messages', () => {
      // arrange
      const noMessagesResponse = {
        body: {
          statusCode,
          returnCode,
          data: anyData,
        },
      };
      const incorrectMessagesResponse = {
        body: {
          statusCode,
          returnCode,
          data: anyData,
          messages: [1234, { invalid: 'invalid' }],
        },
      };
      // act && assert
      expect(() =>
        parseToType(ConfigurationsResponse, noMessagesResponse)
      ).toThrowErrorMatchingSnapshot();
      expect(() =>
        parseToType(ConfigurationsResponse, incorrectMessagesResponse)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('Endevor environment stages response type parsing', () => {
    const anyData = [
      {
        whaaat: 'whaaaat???',
      },
      {
        whatttttt: 'whattttt??',
      },
      {
        envName: 'test',
        stgNum: 1,
        stgId: 'D',
        nextEnv: 'next-test',
        nextStgNum: 2,
      },
    ];

    it('should parse a response with any data', () => {
      // arrange
      const response = {
        body: {
          statusCode,
          returnCode,
          data: anyData,
          messages,
        },
      };
      // act && assert
      expect(
        parseToType(EnvironmentStagesResponse, response)
      ).toMatchSnapshot();
    });

    // TODO disabled for compatibility with v1 api
    it.skip('should throw an error for a response without data', () => {
      // arrange
      const errorResponse = {
        body: {
          statusCode,
          returnCode,
          data: null,
          messages,
        },
      };
      // act && assert
      expect(() =>
        parseToType(EnvironmentStagesResponse, errorResponse)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('Endevor systems response type parsing', () => {
    const anyData = [
      {
        whaaat: 'whaaaat???',
      },
      {
        whatttttt: 'whattttt??',
      },
      {
        envName: 'test',
        stgId: 'D',
        sysName: 'test-sys',
        nextSys: 'next-sys',
      },
    ];

    it('should parse a response with any data', () => {
      // arrange
      const response = {
        body: {
          statusCode,
          returnCode,
          data: anyData,
          messages,
        },
      };
      // // act && assert
      expect(parseToType(SystemsResponse, response)).toMatchSnapshot();
    });

    // TODO disabled for compatibility with v1 api
    it.skip('should throw an error for a response without data', () => {
      // arrange
      const errorResponse = {
        body: {
          statusCode,
          returnCode,
          data: null,
          messages,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SystemsResponse, errorResponse)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('Endevor subsystems response type parsing', () => {
    const anyData = [
      {
        whaaat: 'whaaaat???',
      },
      {
        whatttttt: 'whattttt??',
      },
      {
        envName: 'test',
        stgId: 'D',
        sysName: 'test-sys',
        sbsName: 'test-subsys',
        nextSbs: 'next-subsys',
      },
    ];

    it('should parse a response with any data', () => {
      // arrange
      const response = {
        body: {
          statusCode,
          returnCode,
          data: anyData,
          messages,
        },
      };
      // act && assert
      expect(parseToType(SubSystemsResponse, response)).toMatchSnapshot();
    });

    // TODO disabled for compatibility with v1 api
    it.skip('should throw an error for a response without data', () => {
      // arrange
      const errorResponse = {
        body: {
          statusCode,
          returnCode,
          data: null,
          messages,
        },
      };
      // act && assert
      expect(() =>
        parseToType(SubSystemsResponse, errorResponse)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('Endevor element types response type parsing', () => {
    const anyData = [
      {
        whaaat: 'whaaaat???',
      },
      {
        whatttttt: 'whattttt??',
      },
      {
        envName: 'test',
        stgId: 'D',
        sysName: 'test-sys',
        typeName: 'test-type',
        nextType: 'next-type',
      },
    ];
    it('should parse a response with any data', () => {
      // arrange
      const response = {
        body: {
          statusCode,
          returnCode,
          data: anyData,
          messages,
        },
      };
      // act && assert
      expect(parseToType(ElementTypesResponse, response)).toMatchSnapshot();
    });

    // TODO disabled for compatibility with v1 api
    it.skip('should throw an error for a response without data', () => {
      // arrange
      const errorResponse = {
        body: {
          statusCode,
          returnCode,
          data: null,
          messages,
        },
      };
      // act && assert
      expect(() =>
        parseToType(ElementTypesResponse, errorResponse)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('Endevor elements response type parsing', () => {
    const anyData = [
      {
        whaaat: 'whaaaat???',
      },
      {
        whatttttt: 'whattttt??',
      },
      {
        envName: 'test',
        stgNum: 1,
        sysName: 'test-sys',
        sbsName: 'test-subsys',
        typeName: 'test-type',
        elmName: 'test-elm',
        fullElmName: 'test-full-name',
        nosource: 'N',
      },
    ];

    it('should parse a response with any data', () => {
      // arrange
      const response = {
        body: {
          statusCode,
          returnCode,
          data: anyData,
          messages,
        },
      };
      // act && assert
      expect(parseToType(ElementsResponse, response)).toMatchSnapshot();
    });

    // TODO disabled for compatibility with v1 api
    it.skip('should throw an error for a response without data', () => {
      // arrange
      const response = {
        body: {
          statusCode,
          returnCode,
          data: null,
          messages,
        },
      };
      // act && assert
      expect(() =>
        parseToType(ElementsResponse, response)
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
          messages: [],
        },
      };
      // act
      const parsedResponse = parseToType(PrintResponse, response);
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
        parseToType(PrintResponse, response)
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
        parseToType(PrintResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe('Endevor retrieve element response type parsing', () => {
    it('should parse a proper response', () => {
      // arrange
      const returnCode = 0;
      const elementContent = 'very important content';
      const fingerprint = 'fingerprint';
      const messages = ['Relax, everything will be fine!'];
      const response = {
        body: {
          returnCode,
          messages,
          statusCode: 200,
          data: [Buffer.from(elementContent)],
        },
        headers: {
          fingerprint,
        },
      };
      // act
      const parsedResponse = parseToType(RetrieveResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });

    it('should parse a proper response without fingerprint', () => {
      // arrange
      const returnCode = 0;
      const elementContent = 'very important content';
      const messages = ['Relax, everything will be fine!'];
      const response = {
        body: {
          returnCode,
          statusCode: 400,
          messages,
          data: [Buffer.from(elementContent)],
        },
        headers: {},
      };
      // act
      const parsedResponse = parseToType(RetrieveResponse, response);
      // assert
      expect(parsedResponse).toMatchSnapshot();
    });

    it('should throw an error for a response without data', () => {
      // arrange
      const returnCode = 0;
      const fingerprint = 'fingerprint';
      const messages = ['Relax, everything will be fine!'];
      const response = {
        body: {
          returnCode,
          messages,
          statusCode: 400,
        },
        headers: {
          fingerprint,
        },
      };
      // act && assert
      expect(() =>
        parseToType(RetrieveResponse, response)
      ).toThrowErrorMatchingSnapshot();
    });

    it('should throw an error for a response with incorrect data', () => {
      // arrange
      const returnCode = 0;
      const fingerprint = 'fingerprint';
      const messages = ['Relax, everything will be fine!'];
      const elementContent = {
        firstParagraph: 'blah',
        secondParagraph: 'blahblah',
      };
      const response = {
        body: {
          returnCode,
          statusCode: 200,
          messages,
          data: [elementContent],
        },
        headers: {
          fingerprint,
        },
      };
      // act && assert
      expect(() =>
        parseToType(RetrieveResponse, response)
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
      const messages = ['Relax, everything will be fine!'];
      const response = {
        body: {
          returnCode,
          statusCode: 200,
          messages,
          data: [
            {
              components: anyData,
            },
          ],
        },
      };
      // act
      const parsedResponse = parseToType(ComponentsResponse, response);
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
        parseToType(ComponentsResponse, response)
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
});
