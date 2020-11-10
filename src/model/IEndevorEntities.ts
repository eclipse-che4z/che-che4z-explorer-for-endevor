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

export interface IEnvironment {
    envName: string;
}

export interface IStage {
    envName: string;
    stgName: string;
    stgId: string;
    stgNum: string;
}

export interface ISystem {
    envName: string;
    sysName: string;
}
export interface ISubsystem {
    envName: string;
    sysName: string;
    sbsName: string;
}

export interface IType {
    envName: string;
    sysName: string;
    stgNum: string;
    typeName: string;
    fileExt: string;
}

export interface IElement {
    elmName: string;
    fullElmName: string;
    elmVVLL: string;
    envName: string;
    sysName: string;
    sbsName: string;
    stgNum: string;
    typeName: string;
}

export interface Filter {
    uri: string;
}

export interface IElementDependencies {
    elmName: string;
    envName: string;
    sysName: string;
    sbsName: string;
    stgNumber: string;
    typeName: string;
    components: IElement[];
}
