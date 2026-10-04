import { DISTRICTS } from "../config/districts.js";

function createDistrictState(district) {
  return {
    district,
    weather: null,
    insight: null,
    status: "idle",
    error: null,
    stale: false,
    source: null
  };
}

function createInitialState() {
  return {
    city: {
      weather: null,
      insight: null,
      status: "idle",
      error: null,
      stale: false,
      source: null
    },
    districts: Object.fromEntries(
      DISTRICTS.map(district => [district.id, createDistrictState(district)])
    ),
    selectedDistrictId: null,
    comparison: {
      selectedIds: []
    },
    refresh: {
      status: "idle",
      lastSuccessfulAt: null
    }
  };
}

function freezeStateContainers(nextState) {
  const city = Object.isFrozen(nextState.city)
    ? nextState.city
    : Object.freeze({ ...nextState.city });
  const districts = Object.isFrozen(nextState.districts)
    ? nextState.districts
    : Object.freeze(Object.fromEntries(
      Object.entries(nextState.districts).map(([districtId, districtState]) => [
        districtId,
        Object.isFrozen(districtState)
          ? districtState
          : Object.freeze({ ...districtState })
      ])
    ));
  const comparison = Object.isFrozen(nextState.comparison)
    ? nextState.comparison
    : Object.freeze({
      ...nextState.comparison,
      selectedIds: Object.freeze([...nextState.comparison.selectedIds])
    });
  const refresh = Object.isFrozen(nextState.refresh)
    ? nextState.refresh
    : Object.freeze({ ...nextState.refresh });

  return Object.freeze({
    ...nextState,
    city,
    districts,
    comparison,
    refresh
  });
}

function hasMeaningfulChange(currentState, partialState) {
  return Object.entries(partialState).some(
    ([key, value]) => !Object.is(currentState[key], value)
  );
}

let state = freezeStateContainers(createInitialState());
const listeners = new Set();

/**
 * Returns the current read-only application-state snapshot.
 * State container objects are frozen and replaced through setState().
 *
 * @returns {object}
 */
export function getState() {
  return state;
}

/**
 * Applies a controlled shallow state update and notifies subscribers.
 * Updaters must return a top-level partial state object.
 *
 * @param {object | ((currentState: object) => object | null)} updaterOrPartial
 * @returns {object} The resulting state snapshot.
 */
export function setState(updaterOrPartial) {
  const partialState = typeof updaterOrPartial === "function"
    ? updaterOrPartial(state)
    : updaterOrPartial;

  if (partialState == null) return state;

  if (typeof partialState !== "object" || Array.isArray(partialState)) {
    throw new TypeError("State updates must be a partial state object.");
  }

  if (!hasMeaningfulChange(state, partialState)) return state;

  state = freezeStateContainers({ ...state, ...partialState });

  for (const listener of [...listeners]) {
    listener(state);
  }

  return state;
}

/**
 * Subscribes to controlled state changes.
 *
 * @param {(state: object) => void} listener
 * @returns {() => void} Unsubscribe function.
 */
export function subscribe(listener) {
  if (typeof listener !== "function") {
    throw new TypeError("Store subscriber must be a function.");
  }

  listeners.add(listener);
  return () => listeners.delete(listener);
}
