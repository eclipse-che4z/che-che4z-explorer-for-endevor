/* eslint-disable @typescript-eslint/consistent-type-assertions */
/*
 * Copyright (c) 2020 Broadcom.
 * The term "Broadcom" refers to Broadcom Inc. and/or its subsidiaries.
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

import * as vscode from 'vscode';
import { createEmptyNode, createPathNodes } from '../../FilterUtils';
import {
  proxyListElement,
  proxyListEnvironment,
  proxyListStage,
  proxyListSubsystem,
  proxyListSystem,
  proxyListType,
} from '../../service/EndevorCliProxy';
import { Session } from '@zowe/imperative';
import { logger } from '../../globals';
import { IEndevorElementNode } from '../../interface/IEndevorElementNode';
import { IEndevorEntity } from '../../interface/IEndevorEntity';
import { IRepository } from '../../interface/IRepository';
import { Repository } from '../../model/Repository';
import { EndevorFilter } from '../../model/EndevorFilter';
import { Environment } from '../../model/Environment';
import { Stage } from '../../model/Stage';
import { System } from '../../model/System';
import { Type } from '../../model/Type';
import { Connection } from '../../model/Connection';
import { Subsystem } from '../../model/SubSystem';
import { IEndevorQualifier } from '../../interface/IEndevorQualifier';
import { IEnvironment } from '../../interface/IEnvironment';
import { IStage } from '../../interface/IStage';
import { ISubsystem } from '../../interface/ISubsystem';
import { IType } from '../../interface/IType';
import { ISystem } from '../../interface/ISystem';
import { Element } from '../../model/Element';
import { IConnection } from '../../interface/IConnection';
import { IFilter } from '../../interface/IFilter';
import { IElement } from '../../interface/IElement';
import { IEndevorFilter } from '../../interface/IEndevorFilter';

export class EndevorNode extends vscode.TreeItem {
  private entity?: IEndevorEntity;
  private _children: EndevorNode[];
  private _needReload: boolean;

  constructor(entity?: IEndevorEntity) {
    const entityName = entity ? entity.getName() : 'unknown';
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    super(entityName!, vscode.TreeItemCollapsibleState.Collapsed);
    this._needReload = true;
    this.description = '';
    this._children = [];
    if (entity instanceof Element) {
      this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
    if (entity) {
      this.entity = entity;
      this.tooltip = entity.getDescription()
        ? entity.getDescription()
        : entity.getName();
    }
  }

  public hasChildren(): boolean {
    return this._children.length > 0;
  }

  public get children(): EndevorNode[] {
    return this._children;
  }
  public set children(value: EndevorNode[]) {
    this._children = value;
  }

  public get needReload(): boolean {
    return this._needReload;
  }

  public set needReload(value: boolean) {
    this._needReload = value;
  }

  public getEntity() {
    return this.entity;
  }
  public setEntity(value: IEndevorEntity) {
    this.entity = value;
  }

  public getRepository(): IRepository | undefined {
    if (this.entity) {
      return this.entity.getRepository();
    }
  }

  get contextValue(): string {
    if (!this.entity) {
      return '';
    }
    if (this.entity instanceof Repository) {
      return 'repository';
    }
    if (this.entity instanceof EndevorFilter) {
      return 'filter';
    }
    if (this.entity instanceof Environment) {
      return 'environment';
    }
    if (this.entity instanceof Stage) {
      return 'stage';
    }
    if (this.entity instanceof System) {
      return 'system';
    }
    if (this.entity instanceof Subsystem) {
      return 'subsystem';
    }
    if (this.entity instanceof Type) {
      return 'type';
    }
    if (this.entity instanceof Connection) {
      return 'connection';
    }
    return 'element';
  }

  public updateNeedReload(parNeedReload: boolean) {
    this._needReload = parNeedReload;
    this._children.forEach((child) => {
      child.updateNeedReload(parNeedReload);
    });
  }

  public updateInfo() {
    this.tooltip = this.entity ? this.entity.getDescription() : '';
    this.label = this.entity ? this.entity.getName() : '';
  }
}

export class EndevorBrowsingNode extends EndevorNode {
  private repository?: IRepository;

  constructor(name: string, repo: IRepository | undefined) {
    super();
    this.label = name;
    this.repository = repo;
  }

  get contextValue(): string {
    if (this.isFiltersNode()) {
      return 'filters';
    }
    if (this.isMapNode()) {
      return 'map';
    }
    return super.contextValue;
  }

  public isMapNode(): boolean {
    return this.label === 'Map';
  }

  public isFiltersNode(): boolean {
    return this.label === 'Filters';
  }

  public findFilterNode(
    filter: IEndevorFilter | string
  ): EndevorNode | undefined {
    if (this.isMapNode()) {
      return undefined;
    }
    let uri: IFilter | string = '';
    if (typeof filter !== 'string') {
      uri = filter.getUri();
    } else {
      uri = filter;
    }

    return this.children.find(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (child) => (child.getEntity() as EndevorFilter).getUri() === uri
    );
  }

  public getRepository(): IRepository | undefined {
    return this.repository;
  }

  public async lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: IRepository | undefined = this.getRepository();
    if (!repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    this.needReload = false;
    if (this.contextValue === 'filters') {
      return new Promise((resolve) => {
        const resultNodes: EndevorNode[] = [];
        if (repo.filters) {
          repo.filters.forEach((filter) => {
            resultNodes.push(new FilterNode(filter));
          });
        }
        this.children = resultNodes;
        resolve(resultNodes);
      });
    }
    try {
      const resultNodes: EndevorQualifiedNode[] = [];
      const resultEntities: IEnvironment[] = [];
      const envs = await proxyListEnvironment(repo);
      envs.forEach((env) => {
        const envEntity: IEnvironment = new Environment(repo, env);
        resultEntities.push(envEntity);
        resultNodes.push(new EnvironmentNode(envEntity, { env: env.envName }));
      });
      repo.loadEnvironments(resultEntities, true);
      this.children = resultNodes;
      return resultNodes;
    } catch (error) {
      if (!error.cancelled) {
        logger.error('Error creating the root tree.', error.error);
      }
      return [];
    }
  }
}

export class EndevorFilterPathNode extends EndevorNode {
  private elements: Element[];
  private repository?: IRepository;
  constructor(
    name: string,
    repo: IRepository | undefined,
    elements: Element[]
  ) {
    super();
    this.elements = elements;
    this.label = name;
    this.repository = repo;
  }

  public lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: IRepository | undefined = this.getRepository();
    if (!repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    const resultNodes: EndevorNode[] = [];
    this.getElements().forEach((element) => {
      const qualifier: IEndevorQualifier = {
        env: element.envName,
        stage: element.stgNum,
        system: element.sysName,
        subsystem: element.sbsName,
        type: element.typeName,
        element: element.fullElmName,
      };
      resultNodes.push(new EndevorQualifiedNode(element, qualifier));
    });
    this.children = resultNodes;
    this.needReload = false;
    return Promise.resolve(resultNodes);
  }

  public getElements(): IElement[] {
    return this.elements;
  }

  public getRepository(): IRepository | undefined {
    return this.repository;
  }

  get contextValue(): string {
    return 'filterPathNode';
  }
}

export class EmptyNode extends EndevorNode {
  private repository?: IRepository;
  private message: string;
  constructor(name: string, repo: IRepository | undefined, message: string) {
    super();
    this.label = name;
    this.repository = repo;
    this.message = message;
    this.tooltip = this.getMessage();
  }

  public getMessage(): string {
    return this.message;
  }

  public getRepository(): IRepository | undefined {
    return this.repository;
  }

  get contextValue(): string {
    return 'emptyNode';
  }
}

export class FilterNode extends EndevorNode {
  public async lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: IRepository | undefined = this.getRepository();
    const filterEntity:
      | EndevorFilter
      | undefined = this.getEntity() as EndevorFilter;
    const qualifier:
      | IEndevorQualifier
      | undefined = filterEntity.getQualifier();
    if (!filterEntity || !qualifier || !repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    this.needReload = false;

    try {
      const elements = await proxyListElement(repo, qualifier);
      const resultEntities: Element[] = [];
      let resultNodes: EndevorNode[] = [];
      for (const element of elements) {
        const eleEntity: Element = new Element(repo, element);
        resultEntities.push(eleEntity);
        resultNodes.push(
          new EndevorElementNode(eleEntity, eleEntity.getQualifier())
        );
      }
      filterEntity.loadElements(resultEntities, false);
      const pathNodes = createPathNodes(resultEntities, repo);
      if (pathNodes.length > 1) {
        resultNodes = pathNodes;
      }
      if (resultNodes.length === 0) {
        resultNodes = [
          createEmptyNode(repo, '<Empty>', 'This filter is empty'),
        ];
      }
      this.children = resultNodes;
      return resultNodes;
    } catch (error) {
      if (!error.cancelled) {
        logger.error('Error listing filters.', error.error);
      }
      const resultNodes = [
        createEmptyNode(repo, '<Invalid Path>', error.error),
      ];
      this.children = resultNodes;
      return resultNodes;
    }
  }
}

export class EndevorQualifiedNode extends EndevorNode {
  private qualifier?: IEndevorQualifier;

  constructor(entity: IEndevorEntity, qualifier: IEndevorQualifier) {
    super(entity);
    this.qualifier = qualifier;
  }

  public getQualifier(): IEndevorQualifier | undefined {
    return this.qualifier;
  }
}

export class EndevorElementNode
  extends EndevorNode
  implements IEndevorElementNode {
  qualifier: IEndevorQualifier;

  constructor(entity: IEndevorEntity, qualifier: IEndevorQualifier) {
    super(entity);
    this.qualifier = qualifier;
  }

  public getQualifier(): IEndevorQualifier {
    return this.qualifier;
  }
}

export class EnvironmentNode extends EndevorQualifiedNode {
  public async lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: IRepository | undefined = this.getRepository();
    const envEntity:
      | IEnvironment
      | undefined = this.getEntity() as IEnvironment;
    const nodeQualEnv: IEndevorQualifier | undefined = this.getQualifier();
    if (!envEntity || !nodeQualEnv || !repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    this.needReload = false;
    try {
      const stages = await proxyListStage(repo, nodeQualEnv);
      const resultEntities: Stage[] = [];
      const resultNodes: EndevorQualifiedNode[] = [];
      stages.forEach((stage) => {
        const stageEntity = new Stage(repo, stage);
        resultEntities.push(stageEntity);
        resultNodes.push(
          new StageNode(stageEntity, {
            ...nodeQualEnv,
            stage: stage.stgNum,
          })
        );
      });
      envEntity.loadStages(resultEntities);
      this.children = resultNodes;
      return resultNodes;
    } catch (error) {
      if (!error.cancelled) {
        logger.error('Error listing environments.', error.error);
      }
      return [];
    }
  }
}

export class StageNode extends EndevorQualifiedNode {
  public async lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: IRepository | undefined = this.getRepository();
    const stageEntity: IStage | undefined = this.getEntity() as Stage;
    const nodeQualStage: IEndevorQualifier | undefined = this.getQualifier();
    if (!stageEntity || !nodeQualStage || !repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    this.needReload = false;
    try {
      const resultEntities: System[] = [];
      const resultNodes: EndevorQualifiedNode[] = [];
      const systems = await proxyListSystem(repo, nodeQualStage);
      systems.forEach((system) => {
        const systemEntity: System = new System(repo, system);
        resultEntities.push(systemEntity);
        resultNodes.push(
          new SystemNode(systemEntity, {
            ...nodeQualStage,
            system: system.sysName,
          })
        );
      });
      const env: IEnvironment | undefined = repo.findEnvironment(
        stageEntity.envName
      );
      if (env) {
        env.loadSystems(resultEntities, true);
      }
      this.children = resultNodes;
      return resultNodes;
    } catch (error) {
      if (!error.cancelled) {
        logger.error('Error listing stages.', error.error);
      }
      return [];
    }
  }
}

export class SystemNode extends EndevorQualifiedNode {
  public async lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: IRepository | undefined = this.getRepository();
    const systemEntity: System | undefined = this.getEntity() as System;
    const nodeQualSystem: IEndevorQualifier | undefined = this.getQualifier();
    if (!systemEntity || !nodeQualSystem || !repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    this.needReload = false;
    try {
      const resultEntities: ISubsystem[] = [];
      const resultNodes: EndevorQualifiedNode[] = [];
      const subsystems = await proxyListSubsystem(repo, nodeQualSystem);
      subsystems.forEach((subsystem) => {
        const subsysEntity: ISubsystem = new Subsystem(repo, subsystem);
        resultEntities.push(subsysEntity);
        resultNodes.push(
          new SubsystemNode(subsysEntity, {
            ...nodeQualSystem,
            subsystem: subsystem.sbsName,
          })
        );
      });
      systemEntity.loadSubSystems(resultEntities, true);
      this.children = resultNodes;
      return resultNodes;
    } catch (error) {
      if (!error.cancelled) {
        logger.error('Error listing systems.', error.error);
      }
      return [];
    }
  }
}

export class SubsystemNode extends EndevorQualifiedNode {
  public async lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: IRepository | undefined = this.getRepository();
    const subsysEntity: ISubsystem | undefined = this.getEntity() as ISubsystem;
    const nodeQualSubsys: IEndevorQualifier | undefined = this.getQualifier();
    if (!subsysEntity || !nodeQualSubsys || !repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    this.needReload = false;
    try {
      const resultEntities: IType[] = [];
      const resultNodes: EndevorQualifiedNode[] = [];
      const types = await proxyListType(repo, nodeQualSubsys);
      types.forEach((type) => {
        const typeEntity: Type = new Type(repo, type);
        resultEntities.push(typeEntity);
        resultNodes.push(
          new TypeNode(typeEntity, {
            ...nodeQualSubsys,
            type: type.typeName,
          })
        );
      });
      const system: ISystem | undefined = repo.findSystem(
        subsysEntity.envName,
        subsysEntity.sysName
      );
      if (system) {
        system.loadTypes(resultEntities, true);
      }
      this.children = resultNodes;
      return resultNodes;
    } catch (error) {
      if (!error.cancelled) {
        logger.error('Error listing subsystems.', error.error);
      }
      return [];
    }
  }
}

export class TypeNode extends EndevorQualifiedNode {
  public async lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: IRepository | undefined = this.getRepository();
    const nodeQualType: IEndevorQualifier | undefined = this.getQualifier();
    if (!nodeQualType || !repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    this.needReload = false;
    try {
      const resultNodes: EndevorNode[] = [];
      const elements = await proxyListElement(repo, nodeQualType);
      elements.forEach((element) => {
        const eleEntity: Element = new Element(repo, element);
        resultNodes.push(
          new EndevorElementNode(eleEntity, {
            ...nodeQualType,
            element: element.fullElmName,
          })
        );
      });
      if (resultNodes.length === 0) {
        resultNodes.push(
          createEmptyNode(repo, '<Empty>', 'This Type is empty')
        );
      }
      this.children = resultNodes;
      return resultNodes;
    } catch (error) {
      if (!error.cancelled) {
        logger.error('Error listing types.', error.error);
      }
      return [];
    }
  }
}

export class ConnectionNode extends EndevorNode {
  private _session: Session | undefined = undefined;
  private _connection: IConnection | undefined = undefined;
  private _connectionName: string | undefined = undefined;

  constructor(session?: Session, label?: string, connection?: IConnection) {
    super();
    if (session) {
      this._session = session;
    }
    if (label) {
      this._connectionName = label;
    }
    if (connection) {
      this._connection = connection;
    }
  }

  public getProfileName(): string | undefined {
    return this._connectionName;
  }

  public getConnection(): IConnection | undefined {
    return this._connection;
  }
  public getSession(): Session | undefined {
    return this._session;
  }

  get contextValue() {
    return 'connection';
  }
}
export class NewConnectionButton extends EndevorNode {
  constructor() {
    super();
    this.command = {
      command: 'endevorexplorer.newConnection',
      title: 'Add a New Profile',
    };
    // TODO remove if Theis fix naming (theia/packages/plugin-ext/src/main/browser/view/tree-views-main.tsx)
    // handleTreeEvents expect node.command.id with command id, but vscode - node.command.command
    // issue: https://github.com/theia-ide/theia/issues/5744
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.command.id = 'endevorexplorer.newConnection';

    this.label = 'Add a New Profile';
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
  }
  get contextValue() {
    return 'connectionButton';
  }
}
export class NewRepositoryNode extends EndevorNode {
  constructor() {
    super();
    this.command = {
      command: 'endevorexplorer.newHost',
      title: 'Create New Host',
    };
    // TODO remove if Theis fix naming (theia/packages/plugin-ext/src/main/browser/view/tree-views-main.tsx)
    // handleTreeEvents expect node.command.id with command id, but vscode - node.command.command
    // issue: https://github.com/theia-ide/theia/issues/5744
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.command.id = 'endevorexplorer.newHost';

    this.label = 'Add a New Configuration';
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
  }
  get contextValue() {
    return 'newrepository';
  }
}
