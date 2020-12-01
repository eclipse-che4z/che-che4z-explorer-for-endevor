/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {
  ListElement,
  ListEnvironment,
  ListInstance,
  ListStage,
  ListSubsystem,
  ListSystem,
  ListType,
  PrintElementComponents,
  QueryACMComponents,
  RetrieveElement,
} from '@broadcom/endevor-for-zowe-cli';
import { IEndevorQualifier } from '../interface/IEndevorQualifier';
import { buildSession, endevorQualifierToElement, toArray } from '../utils';
import { logger } from '../globals';
import { IRepository } from '../interface/entities';

export async function proxyBrowseElement(
  repository: IRepository,
  IEndevorQualifier: IEndevorQualifier
): Promise<string | undefined> {
  const session = await buildSession(repository);

  const dataSource = repository.getDatasource();
  const instance = dataSource ? dataSource : '';
  const element = endevorQualifierToElement(IEndevorQualifier, instance);
  const requestBody = PrintElementComponents.setupPrintRequest({});
  const printResult = await PrintElementComponents.printElementComponents(
    session,
    element,
    requestBody
  );
  return printResult.data ? printResult.data.toString() : undefined;
}

export async function proxyGetDsNamesFromInstance(
  repository: IRepository
): Promise<string[]> {
  const session = await buildSession(repository);
  const dataSources = await ListInstance.listInstance(session);
  return dataSources.map((ds) => ds.name as string).sort();
}

export async function proxyRetrieveElement(
  repository: IRepository,
  IEndevorQualifier: IEndevorQualifier
): Promise<string | undefined> {
  const session = await buildSession(repository);
  const dataSource = repository.getDatasource();
  const instance = dataSource ? dataSource : '';
  const element = endevorQualifierToElement(IEndevorQualifier, instance);
  const requestArgs = {
    nosignout: 'yes',
  };
  const requestBody = RetrieveElement.setupRetrieveRequest(requestArgs);
  const retrieveResult = await RetrieveElement.retrieveElement(
    session,
    element,
    requestBody
  );
  return retrieveResult.data ? retrieveResult.data.toString() : undefined;
}

export async function proxyRetrieveAcmComponents(
  repository: IRepository,
  endevorQualifier: IEndevorQualifier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const session = await buildSession(repository);
  const dataSource = repository.getDatasource();
  const instance = dataSource ? dataSource : '';
  const endevorElement = endevorQualifierToElement(endevorQualifier, instance);
  const requestArguments = {
    excCirculars: 'yes',
    excIndirect: 'no',
    excRelated: 'no',
  };
  const requestBody = QueryACMComponents.setupAcmComponentsRequest(
    requestArguments
  );
  const queryacmCompResponse = await QueryACMComponents.queryACMComponents(
    session,
    instance,
    endevorElement,
    requestBody
  );
  return toArray(queryacmCompResponse.data);
}

export async function proxyListType(
  repository: IRepository,
  endevorQualifier: IEndevorQualifier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const session = await buildSession(repository);
  const dataSource = repository.getDatasource();
  const instance = dataSource ? dataSource : '';
  const typeInput = endevorQualifierToElement(endevorQualifier, instance);
  const requestBody = ListType.setupListTypeRequest({});
  const listResponse = await ListType.listType(
    session,
    instance,
    typeInput,
    requestBody
  );
  if (listResponse.returnCode > 0) {
    logger.error(
      listResponse.messages
        ? listResponse.messages[1] ?? listResponse.messages[0]
        : 'Error retrieving element type',
      listResponse.messages?.toString()
    );
  }
  return toArray(listResponse.data);
}

export async function proxyListElement(
  repository: IRepository,
  endevorQualifier: IEndevorQualifier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const session = await buildSession(repository);
  const dataSource = repository.getDatasource();
  const instance = dataSource ? dataSource : '';
  const endevorElement = endevorQualifierToElement(endevorQualifier, instance);
  const requestBody = ListElement.setupListElementRequest({});
  const listResponse = await ListElement.listElement(
    session,
    instance,
    endevorElement,
    requestBody
  );
  if (listResponse.returnCode > 0) {
    logger.error(
      listResponse.messages
        ? listResponse.messages[1] ?? listResponse.messages[0]
        : 'Error retrieving element',
      listResponse.messages?.toString()
    );
  }
  return toArray(listResponse.data);
}

export async function proxyListEnvironment(
  repository: IRepository
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const session = await buildSession(repository);
  const dataSource = repository.getDatasource();
  const instance = dataSource ? dataSource : '';
  const environment = endevorQualifierToElement(
    {
      env: '',
      stage: '',
      system: '',
      subsystem: '',
      type: '',
      element: '',
    },
    instance
  );
  const requestBody = ListEnvironment.setupListEnvironmentRequest({});
  const envResponse = await ListEnvironment.listEnvironment(
    session,
    instance,
    environment,
    requestBody
  );
  if (envResponse.returnCode > 0) {
    logger.error(
      envResponse.messages
        ? envResponse.messages[1] ?? envResponse.messages[0]
        : 'Error retrieving environment',
      envResponse.messages?.toString()
    );
  }
  return toArray(envResponse.data);
}

export async function proxyListStage(
  repository: IRepository,
  endevorQualifier: IEndevorQualifier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const session = await buildSession(repository);
  const dataSource = repository.getDatasource();
  const instance = dataSource ? dataSource : '';
  const stageNumber = endevorQualifierToElement(endevorQualifier, instance);
  const requestBody = ListStage.setupListStageRequest({});
  const listResponse = await ListStage.listStage(
    session,
    instance,
    stageNumber,
    requestBody
  );
  if (listResponse.returnCode > 0) {
    logger.error(
      listResponse.messages
        ? listResponse.messages[1] ?? listResponse.messages[0]
        : 'Error retrieving stage',
      listResponse.messages?.toString()
    );
  }
  return toArray(listResponse.data);
}

export async function proxyListSubsystem(
  repository: IRepository,
  IEndevorQualifier: IEndevorQualifier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const session = await buildSession(repository);
  const dataSource = repository.getDatasource();
  const instance = dataSource ? dataSource : '';
  const endevorSubsystem = endevorQualifierToElement(
    IEndevorQualifier,
    instance
  );
  const requestBody = ListSubsystem.setupListSubsystemRequest({});
  const listSubsystemResponse = await ListSubsystem.listSubsystem(
    session,
    instance,
    endevorSubsystem,
    requestBody
  );
  if (listSubsystemResponse.returnCode > 0) {
    logger.error(
      listSubsystemResponse.messages
        ? listSubsystemResponse.messages[1] ?? listSubsystemResponse.messages[0]
        : 'Error retrieving subsystem',
      listSubsystemResponse.messages?.toString()
    );
  }
  return toArray(listSubsystemResponse.data);
}

export async function proxyListSystem(
  repository: IRepository,
  endevorQualifier: IEndevorQualifier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const session = await buildSession(repository);
  const dataSource = repository.getDatasource();
  const instance = dataSource ? dataSource : '';
  const endevorSystem = endevorQualifierToElement(endevorQualifier, instance);
  const requestBody = ListSystem.setupListSystemRequest({});
  const listSystemResponse = await ListSystem.listSystem(
    session,
    instance,
    endevorSystem,
    requestBody
  );
  if (listSystemResponse.returnCode > 0) {
    logger.error(
      listSystemResponse.messages
        ? listSystemResponse.messages[1] ?? listSystemResponse.messages[0]
        : 'Error retrieving subsystem',
      listSystemResponse.messages?.toString()
    );
  }
  return toArray(listSystemResponse.data);
}
