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

import {
  Systems,
  SystemNode,
  SubSystemNode,
  TypeNode,
  ElementNode,
} from '../_doc/ElementTree';
import {
  Element,
  ElementSearchLocation,
  Service,
} from '@local/endevor/_doc/Endevor';
import { toVirtualDocUri } from '../uri';
import { Schemas } from '../_doc/Uri';

/**
 * Converts list element result into a tree for tree view
 */
export const buildTree = (
  service: Service,
  elementsSearchLocation: ElementSearchLocation,
  elements: ReadonlyArray<Element>
): SystemNode[] => {
  const systems: Systems = new Map();

  const addSystemNode = (elm: Element): SystemNode => {
    const name = elm.system;
    const node: SystemNode = systems.get(name) ?? {
      type: 'SYS',
      name,
      children: new Map(),
    };
    systems.set(name, node);

    return node;
  };

  const addSubSystemNode = (element: Element): SubSystemNode => {
    const system = addSystemNode(element);
    const name = element.subSystem;
    const node: SubSystemNode = system.children.get(name) ?? {
      type: 'SUB',
      name,
      children: new Map(),
    };
    system.children.set(name, node);

    return node;
  };

  const addTypeNode = (element: Element): TypeNode => {
    const subsystem = addSubSystemNode(element);
    const name = element.type;
    const node: TypeNode = subsystem.children.get(name) ?? {
      type: 'TYPE',
      name,
      children: new Map(),
    };
    subsystem.children.set(name, node);

    return node;
  };

  const addElementNode = async (endevorElement: Element): Promise<void> => {
    const type = addTypeNode(endevorElement);
    const name = endevorElement.name;
    const node: ElementNode = {
      type: 'ELEMENT',
      name,
      uri: toVirtualDocUri(Schemas.TREE_ELEMENT)({
        service,
        element: endevorElement,
        endevorSearchLocation: elementsSearchLocation,
      }),
    };
    type.children.set(name, node);
  };

  elements.forEach(addElementNode);

  return Array.from(systems.values());
};
