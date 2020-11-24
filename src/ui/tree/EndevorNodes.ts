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

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import * as vscode from 'vscode';
import { createEmptyNode, createPathNodes } from '../../FilterUtils';
import { Element } from '../../model/Element';
import { Connection } from '../../model/Connection';
import { EndevorEntity } from '../../model/EndevorEntity';
import { EndevorFilter } from '../../model/EndevorFilter';
import { Environment } from '../../model/Environment';
import { EndevorQualifier } from '../../model/IEndevorQualifier';
import { Repository } from '../../model/Repository';
import { Stage } from '../../model/Stage';
import { SubSystem } from '../../model/SubSystem';
import { System } from '../../model/System';
import { Type } from '../../model/Type';
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
import { Commands } from '../../commands/Common';

export class EndevorNode extends vscode.TreeItem {
  private entity?: EndevorEntity;
  private _children: EndevorNode[];
  private _needReload: boolean;

  constructor(entity?: EndevorEntity) {
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
  public setEntity(value: EndevorEntity) {
    this.entity = value;
  }

  public getRepository(): Repository | undefined {
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
    if (this.entity instanceof SubSystem) {
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
  private repository?: Repository;

  constructor(name: string, repo: Repository | undefined) {
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
    filter: EndevorFilter | string
  ): EndevorNode | undefined {
    if (this.isMapNode()) {
      return undefined;
    }
    let uri = '';
    if (filter instanceof EndevorFilter) {
      uri = filter.getUri();
    } else {
      uri = filter;
    }

    return this.children.find(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (child) => (child.getEntity() as EndevorFilter).getUri() === uri
    );
  }

  public getRepository(): Repository | undefined {
    return this.repository;
  }

  public async lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: Repository | undefined = this.getRepository();
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
      const resultEntities: Environment[] = [];
      const envs = await proxyListEnvironment(repo);
      envs.forEach((env) => {
        const envEntity: Environment = new Environment(repo, env);
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
  private repository?: Repository;
  constructor(name: string, repo: Repository | undefined, elements: Element[]) {
    super();
    this.elements = elements;
    this.label = name;
    this.repository = repo;
  }

  public lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: Repository | undefined = this.getRepository();
    if (!repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    const resultNodes: EndevorNode[] = [];
    this.getElements().forEach((element) => {
      const qualifier: EndevorQualifier = {
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

  public getElements(): Element[] {
    return this.elements;
  }

  public getRepository(): Repository | undefined {
    return this.repository;
  }

  get contextValue(): string {
    return 'filterPathNode';
  }
}

export class EmptyNode extends EndevorNode {
  private repository?: Repository;
  private message: string;
  constructor(name: string, repo: Repository | undefined, message: string) {
    super();
    this.label = name;
    this.repository = repo;
    this.message = message;
    this.tooltip = this.getMessage();
  }

  public getMessage(): string {
    return this.message;
  }

  public getRepository(): Repository | undefined {
    return this.repository;
  }

  get contextValue(): string {
    return 'emptyNode';
  }
}

export class FilterNode extends EndevorNode {
  public async lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: Repository | undefined = this.getRepository();
    const filterEntity:
      | EndevorFilter
      | undefined = this.getEntity() as EndevorFilter;
    const qualifier: EndevorQualifier | undefined = filterEntity.getQualifier();
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
  private qualifier?: EndevorQualifier;

  constructor(entity: EndevorEntity, qualifier: EndevorQualifier) {
    super(entity);
    this.qualifier = qualifier;
  }

  public getQualifier(): EndevorQualifier | undefined {
    return this.qualifier;
  }
}

export class EndevorElementNode extends EndevorNode {
  private qualifier?: EndevorQualifier;

  constructor(entity: EndevorEntity, qualifier: EndevorQualifier) {
    super(entity);
    this.qualifier = qualifier;
    this.command = {
      title: 'Browse element',
      command: Commands.BrowseElement,
      arguments: [this]
    }
  }

  public getQualifier(): EndevorQualifier | undefined {
    return this.qualifier;
  }
}

export class EnvironmentNode extends EndevorQualifiedNode {
  public async lazyLoadChildren(): Promise<EndevorNode[]> {
    const repo: Repository | undefined = this.getRepository();
    const envEntity: Environment | undefined = this.getEntity() as Environment;
    const nodeQualEnv: EndevorQualifier | undefined = this.getQualifier();
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
    const repo: Repository | undefined = this.getRepository();
    const stageEntity: Stage | undefined = this.getEntity() as Stage;
    const nodeQualStage: EndevorQualifier | undefined = this.getQualifier();
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
      const env: Environment | undefined = repo.findEnvironment(
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
    const repo: Repository | undefined = this.getRepository();
    const systemEntity: System | undefined = this.getEntity() as System;
    const nodeQualSystem: EndevorQualifier | undefined = this.getQualifier();
    if (!systemEntity || !nodeQualSystem || !repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    this.needReload = false;
    try {
      const resultEntities: SubSystem[] = [];
      const resultNodes: EndevorQualifiedNode[] = [];
      const subsystems = await proxyListSubsystem(repo, nodeQualSystem);
      subsystems.forEach((subsystem) => {
        const subsysEntity: SubSystem = new SubSystem(repo, subsystem);
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
    const repo: Repository | undefined = this.getRepository();
    const subsysEntity: SubSystem | undefined = this.getEntity() as SubSystem;
    const nodeQualSubsys: EndevorQualifier | undefined = this.getQualifier();
    if (!subsysEntity || !nodeQualSubsys || !repo) {
      return Promise.resolve([]);
    }
    if (!this.needReload) {
      return Promise.resolve(this.children);
    }
    this.needReload = false;
    try {
      const resultEntities: Type[] = [];
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
      const system: System | undefined = repo.findSystem(
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
    const repo: Repository | undefined = this.getRepository();
    const nodeQualType: EndevorQualifier | undefined = this.getQualifier();
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
  private _connection: Connection | undefined = undefined;
  private _connectionName: string | undefined = undefined;

  constructor(session?: Session, label?: string, connection?: Connection) {
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

  public getConnection(): Connection | undefined {
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
