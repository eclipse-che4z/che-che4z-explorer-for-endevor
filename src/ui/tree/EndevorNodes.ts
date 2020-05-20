/*
 * Copyright (c) 2019 Broadcom.
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

// tslint:disable: max-classes-per-file
import { ListElement,
         ListEnvironment,
         ListStage,
         ListSubsystem,
         ListSystem,
         ListType } from "@broadcom/endevor-for-zowe-cli";
import * as vscode from "vscode";
import { createEmptyNode, createPathNodes } from "../../FilterUtils";
import { Element } from "../../model/Element";
import { EndevorEntity } from "../../model/EndevorEntity";
import { EndevorFilter } from "../../model/EndevorFilter";
import { Environment } from "../../model/Environment";
import { IElement, IEnvironment, IStage, ISubsystem, ISystem, IType } from "../../model/IEndevorEntities";
import { EndevorQualifier } from "../../model/IEndevorQualifier";
import { Repository } from "../../model/Repository";
import { Stage } from "../../model/Stage";
import { SubSystem } from "../../model/SubSystem";
import { System } from "../../model/System";
import { Type } from "../../model/Type";
import * as utils from "../../utils";

export class EndevorNode extends vscode.TreeItem {
    private entity?: EndevorEntity;
    private _children: EndevorNode[];
    private _needReload: boolean;

    constructor(entity?: EndevorEntity) {
        super(entity ? entity.getName() : "unknown", vscode.TreeItemCollapsibleState.Collapsed);
        this._needReload = true;
        this.description = "";
        this._children = [];
        if (entity instanceof Element) {
            this.collapsibleState = vscode.TreeItemCollapsibleState.None;
        }
        if (entity) {
            this.entity = entity;
            this.tooltip = entity.getDescription() ? entity.getDescription() : entity.getName();
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
            return "";
        }
        if (this.entity instanceof Repository) {
            return "repository";
        }
        if (this.entity instanceof EndevorFilter) {
            return "filter";
        }
        if (this.entity instanceof Environment) {
            return "environment";
        }
        if (this.entity instanceof Stage) {
            return "stage";
        }
        if (this.entity instanceof System) {
            return "system";
        }
        if (this.entity instanceof SubSystem) {
            return "subsystem";
        }
        if (this.entity instanceof Type) {
            return "type";
        }
        return "element";
    }

    public updateNeedReload(parNeedReload: boolean) {
        this._needReload = parNeedReload;
        this._children.forEach(child => {
            child.updateNeedReload(parNeedReload);
        });
    }

    public updateInfo() {
        this.tooltip = this.entity ? this.entity.getDescription() : "";
        this.label = this.entity ? this.entity.getName() : "";
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
            return "filters";
        }
        if (this.isMapNode()) {
            return "map";
        }
        return super.contextValue;
    }

    public isMapNode(): boolean {
        return this.label === "Map";
    }

    public isFiltersNode(): boolean {
        return this.label === "Filters";
    }

    public findFilterNode(filter: EndevorFilter | string): EndevorNode | undefined {
        if (this.isMapNode()) {
            return undefined;
        }
        let uri: string = "";
        if (filter instanceof EndevorFilter) {
            uri = filter.getUri();
        } else {
            uri = filter;
        }

        return this.children.find(child => (child.getEntity() as EndevorFilter).getUri() === uri);
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
        if (this.contextValue === "filters") {
            return new Promise(resolve => {
                const resultNodes: EndevorNode[] = [];
                if (repo.filters) {
                    repo.filters.forEach(filter => {
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
            const session = await utils.buildSession(repo);
            const instance = repo.getDatasource();
            const environment = utils.endevorQualifierToElement({}, instance);
            const requestBody = ListEnvironment.setupListEnvironmentRequest({});
            const envResponse = await ListEnvironment.listEnvironment(session, instance, environment, requestBody);
            const envs: IEnvironment[] = utils.toArray(envResponse.data);
            envs.forEach(env => {
                const envEntity: Environment = new Environment(repo, env);
                resultEntities.push(envEntity);
                resultNodes.push(new EnvironmentNode(envEntity, { env: env.envName }));
            });
            repo.loadEnvironments(resultEntities, true);
            this.children = resultNodes;
            return resultNodes;
        } catch (error) {
            if (!error.cancelled) {
                vscode.window.showErrorMessage(error.error);
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
        this.getElements().forEach(element => {
            const qualifier: EndevorQualifier = {
                env: element.envName,
                stage: element.stgNum,
                system: element.sysName,
                // tslint:disable-next-line:object-literal-sort-keys
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
        return "filterPathNode";
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
        return "emptyNode";
    }
}

export class FilterNode extends EndevorNode {
    public async lazyLoadChildren(): Promise<EndevorNode[]> {
        const repo: Repository | undefined = this.getRepository();
        const filterEntity: EndevorFilter | undefined = this.getEntity() as EndevorFilter;
        const qualifier: EndevorQualifier | undefined = filterEntity.getQualifier();
        if (!filterEntity || !qualifier || !repo) {
            return Promise.resolve([]);
        }
        if (!this.needReload) {
            return Promise.resolve(this.children);
        }
        this.needReload = false;

        try {
            const session = await utils.buildSession(repo);
            const instance = repo.getDatasource();
            const endevorElement = utils.endevorQualifierToElement(qualifier, instance);
            const requestBody = ListElement.setupListElementRequest({});
            const listResponse = await ListElement.listElement(session, instance, endevorElement, requestBody);
            const elements: IElement[] = utils.toArray(listResponse.data);
            const resultEntities: Element[] = [];
            let resultNodes: EndevorNode[] = [];
            for (const element of elements) {
                const eleEntity: Element = new Element(repo, element);
                resultEntities.push(eleEntity);
                resultNodes.push(new EndevorElementNode(eleEntity, eleEntity.getQualifier()));
            }
            filterEntity.loadElements(resultEntities, false);
            const pathNodes = createPathNodes(resultEntities, repo);
            if (pathNodes.length > 1) {
                resultNodes = pathNodes;
            }
            if (resultNodes.length === 0) {
                resultNodes = [createEmptyNode(repo, "<Empty>", "This filter is empty")];
            }
            this.children = resultNodes;
            return resultNodes;
        } catch (error) {
            if (!error.cancelled) {
                vscode.window.showErrorMessage(error.error);
            }
            const resultNodes = [createEmptyNode(repo, "<Invalid Path>", error.error)];
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
            const session = await utils.buildSession(repo);
            const instance = repo.getDatasource();
            const stageNumber = utils.endevorQualifierToElement(nodeQualEnv, instance);
            const requestBody = ListStage.setupListStageRequest({});
            const listResponse = await ListStage.listStage(session, instance, stageNumber, requestBody);
            const stages: IStage[] = utils.toArray(listResponse.data);
            const resultEntities: Stage[] = [];
            const resultNodes: EndevorQualifiedNode[] = [];
            stages.forEach(stage => {
                const stageEntity = new Stage(repo, stage);
                resultEntities.push(stageEntity);
                resultNodes.push(new StageNode(stageEntity, { ...nodeQualEnv, stage: stage.stgNum }));
            });
            envEntity.loadStages(resultEntities);
            this.children = resultNodes;
            return resultNodes;
        } catch (error) {
            if (!error.cancelled) {
                vscode.window.showErrorMessage(error.error);
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
            const session = await utils.buildSession(repo);
            const instance = repo.getDatasource();
            const endevorSystem = utils.endevorQualifierToElement(nodeQualStage, instance);
            const requestBody = ListSystem.setupListSystemRequest({});
            const listSystemResponse = await ListSystem.listSystem(session, instance, endevorSystem, requestBody);
            const systems: ISystem[] = utils.toArray(listSystemResponse.data);
            systems.forEach(system => {
                const systemEntity: System = new System(repo, system);
                resultEntities.push(systemEntity);
                resultNodes.push(new SystemNode(systemEntity, { ...nodeQualStage, system: system.sysName }));
            });
            const env: Environment | undefined = repo.findEnvironment(stageEntity.envName);
            if (env) {
                env.loadSystems(resultEntities, true);
            }
            this.children = resultNodes;
            return resultNodes;
        } catch (error) {
            if (!error.cancelled) {
                vscode.window.showErrorMessage(error.error);
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
            const session = await utils.buildSession(repo);
            const instance = repo.getDatasource();
            const endevorSubsystem = utils.endevorQualifierToElement(nodeQualSystem, instance);
            const requestBody = ListSubsystem.setupListSubsystemRequest({});
            const listSubsystemResponse = await ListSubsystem.listSubsystem(
                session,
                instance,
                endevorSubsystem,
                requestBody);
            const subsystems: ISubsystem[] = utils.toArray(listSubsystemResponse.data);
            subsystems.forEach(subsystem => {
                const subsysEntity: SubSystem = new SubSystem(repo, subsystem);
                resultEntities.push(subsysEntity);
                resultNodes.push(new SubsystemNode(subsysEntity, { ...nodeQualSystem, subsystem: subsystem.sbsName }));
            });
            systemEntity.loadSubSystems(resultEntities, true);
            this.children = resultNodes;
            return resultNodes;
        } catch (error) {
            if (!error.cancelled) {
                vscode.window.showErrorMessage(error.error);
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
            const session = await utils.buildSession(repo);
            const instance = repo.getDatasource();
            const endevorType = utils.endevorQualifierToElement(nodeQualSubsys, instance);
            const requestBody = ListType.setupListTypeRequest({});
            const listTypeResponse = await ListType.listType(session, instance, endevorType, requestBody);
            const types: IType[] = utils.toArray(listTypeResponse.data);
            types.forEach(type => {
                const typeEntity: Type = new Type(repo, type);
                resultEntities.push(typeEntity);
                resultNodes.push(new TypeNode(typeEntity, { ...nodeQualSubsys, type: type.typeName }));
            });
            const system: System | undefined = repo.findSystem(subsysEntity.envName, subsysEntity.sysName);
            if (system) {
                system.loadTypes(resultEntities, true);
            }
            this.children = resultNodes;
            return resultNodes;
        } catch (error) {
            if (!error.cancelled) {
                vscode.window.showErrorMessage(error.error);
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
            const session = await utils.buildSession(repo);
            const instance = repo.getDatasource();
            const endevorElement = utils.endevorQualifierToElement(nodeQualType, instance);
            const requestBody = ListElement.setupListElementRequest({});
            const listElementResponse = await ListElement.listElement(session, instance, endevorElement, requestBody);
            const elements: IElement[] = utils.toArray(listElementResponse.data);
            elements.forEach(element => {
                const eleEntity: Element = new Element(repo, element);
                resultNodes.push(new EndevorElementNode(eleEntity, { ...nodeQualType, element: element.fullElmName }));
            });
            if (resultNodes.length === 0) {
                resultNodes.push(createEmptyNode(repo, "<Empty>", "This Type is empty"));
            }
            this.children = resultNodes;
            return resultNodes;
        } catch (error) {
            if (!error.cancelled) {
                vscode.window.showErrorMessage(error.error);
            }
            return [];
        }
    }
}

export class NewRepositoryNode extends EndevorNode {
    constructor() {
        super();
        this.command = {
            command: "endevorexplorer.newHost",
            title: "Create New Host",
        };
        // TODO remove if Theis fix naming (theia/packages/plugin-ext/src/main/browser/view/tree-views-main.tsx)
        // handleTreeEvents expect node.command.id with command id, but vscode - node.command.command
        // issue: https://github.com/theia-ide/theia/issues/5744
        // @ts-ignore
        this.command.id = "endevorexplorer.newHost";

        this.label = "New connection";
        this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    }
    get contextValue() {
        return "newrepository";
    }
}
