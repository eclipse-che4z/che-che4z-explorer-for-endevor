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

import { Credential } from '@local/endevor/_doc/Credential';
import { Action, Actions } from '../_doc/Actions';
import { ElementTree, SystemNode } from '../_doc/ElementTree';
import {
  ElementLocationName,
  EndevorServiceName,
  LocationConfig,
} from '../_doc/settings';
import { State } from '../_doc/Store';
import { EndevorAuth } from '../_doc/Credential';

export const make = (
  initialState: State,
  refreshTree: (state: State) => void
) => {
  let state = initialState;
  const dispatch = (action: Action): void => {
    /*
     * This is the only mutation, and it only mutates a local variable called "state".
     * In particular there is no mutation of any data structure, the only thing that
     * ever changes is the contents of the variable.
     * In clojure such variable is referred to as an "atom".
     */
    state = {
      credentials: credentialReducer(state.credentials, action),
      locations: locationsReducer(state.locations, action),
      elementTrees: elementTreesReducer(state.elementTrees, action),
    };
    switch (action.type) {
      case Actions.REFRESH:
      case Actions.LOCATION_CONFIG_CHANGED:
        refreshTree(state);
    }
  };
  return dispatch;
};

/*
 *  reducers
 */
export const locationsReducer = (
  locations: ReadonlyArray<LocationConfig>,
  action: Action
) => {
  switch (action.type) {
    case Actions.REFRESH:
    case Actions.LOCATION_CONFIG_CHANGED:
      return action.payload;
    default:
      return locations;
  }
};
export const elementTreesReducer = (
  elementTrees: ElementTree[],
  action: Action
): ElementTree[] => {
  switch (action.type) {
    case Actions.LOCATION_CONFIG_CHANGED:
      // remove cached element tres without service/location
      // e.g. after removal of service or location from the tree
      return elementTrees.filter((tree) =>
        action.payload.some(
          (service) =>
            service.service === tree.serviceName &&
            service.elementLocations.some(
              (location) => location === tree.locationName
            )
        )
      );
    case Actions.REFRESH:
      return [];
    case Actions.ELEMENT_TREE_ADDED:
      return [
        ...elementTrees.filter(
          (tree) =>
            tree.serviceName != action.tree.serviceName ||
            tree.locationName != action.tree.locationName
        ),
        action.tree,
      ];
    default:
      return elementTrees;
  }
};
export const credentialReducer = (
  credentials: EndevorAuth,
  action: Action
): EndevorAuth => {
  if (action.type == Actions.ENDEVOR_CREDENTIAL_ADDED) {
    const { credential, serviceName } = action;
    return { [serviceName]: credential };
  }
  if (action.type == Actions.DUMMY_NOOP) {
    return credentials;
  }
  return credentials;
};

/*
 *  selectors
 */
export const getCredential = (
  state: State,
  serviceName: string
): Credential | undefined => {
  return state.credentials[serviceName];
};
export const getSystems = (
  state: State,
  serviceName: EndevorServiceName,
  locationName: ElementLocationName
): SystemNode[] | undefined => {
  return state.elementTrees.find(
    (tree) =>
      tree.serviceName === serviceName && tree.locationName === locationName
  )?.systems;
};
export const getLocations = (state: State) => state.locations;
