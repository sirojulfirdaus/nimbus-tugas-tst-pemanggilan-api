import { DISTRICTS } from "./config/districts.js";
import { createNimbusInsight } from "./domain/nimbusInsight.js";
import {
  getAllDistrictWeather,
  getCityWeather
} from "./services/weatherService.js";
import { getState, setState, subscribe } from "./state/store.js";
import { initializeAppView, renderApp } from "./ui/appView.js";

const DISTRICT_IDS = new Set(DISTRICTS.map(district => district.id));

let loadGeneration = 0;

function hasUsableData(locationState) {
  return locationState?.weather != null && locationState?.insight != null;
}

function createLoadStats() {
  return {
    networkSuccesses: 0,
    usableLocations: 0,
    staleLocations: 0,
    failures: 0
  };
}

function combineLoadStats(...allStats) {
  return allStats.reduce((total, stats) => ({
    networkSuccesses: total.networkSuccesses + stats.networkSuccesses,
    usableLocations: total.usableLocations + stats.usableLocations,
    staleLocations: total.staleLocations + stats.staleLocations,
    failures: total.failures + stats.failures
  }), createLoadStats());
}

function createUsableLocationState(serviceResult) {
  const weather = serviceResult.data;

  return {
    weather,
    insight: createNimbusInsight(weather),
    status: serviceResult.stale ? "stale" : "ready",
    error: serviceResult.error ?? null,
    stale: serviceResult.stale === true,
    source: serviceResult.source ?? null
  };
}

function createFailedLocationState(currentLocationState, error, preserveData) {
  if (preserveData && hasUsableData(currentLocationState)) {
    return {
      ...currentLocationState,
      status: "stale",
      error,
      stale: true
    };
  }

  return {
    ...currentLocationState,
    weather: null,
    insight: null,
    status: "error",
    error,
    stale: false,
    source: null
  };
}

function markInitialLoadStarted() {
  setState(currentState => ({
    city: {
      ...currentState.city,
      status: "loading",
      error: null
    },
    districts: Object.fromEntries(
      Object.entries(currentState.districts).map(([districtId, districtState]) => [
        districtId,
        {
          ...districtState,
          status: "loading",
          error: null
        }
      ])
    ),
    refresh: {
      ...currentState.refresh,
      status: "loading"
    }
  }));
}

function markRefreshStarted() {
  setState(currentState => ({
    refresh: {
      ...currentState.refresh,
      status: "loading"
    }
  }));
}

async function loadCity(generation, options) {
  const stats = createLoadStats();

  try {
    const serviceResult = await getCityWeather({
      forceRefresh: options.forceRefresh
    });
    const cityState = createUsableLocationState(serviceResult);

    stats.usableLocations = 1;
    stats.staleLocations = serviceResult.stale ? 1 : 0;
    stats.networkSuccesses = serviceResult.source === "network" && !serviceResult.stale
      ? 1
      : 0;

    if (generation === loadGeneration) {
      setState({ city: cityState });
    }
  } catch (error) {
    stats.failures = 1;

    if (generation === loadGeneration) {
      setState(currentState => {
        const city = createFailedLocationState(
          currentState.city,
          error,
          options.preserveExistingData
        );

        if (hasUsableData(city)) {
          stats.usableLocations = 1;
          stats.staleLocations = 1;
        }

        return { city };
      });
    }
  }

  return stats;
}

function mapDistrictResult(result, currentDistrictState, preserveExistingData) {
  if (result?.status === "ready" || result?.status === "stale") {
    try {
      return {
        ...currentDistrictState,
        ...createUsableLocationState(result.data)
      };
    } catch (error) {
      return createFailedLocationState(
        currentDistrictState,
        error,
        preserveExistingData
      );
    }
  }

  return createFailedLocationState(
    currentDistrictState,
    result?.error ?? new Error("District weather retrieval failed."),
    preserveExistingData
  );
}

function getDistrictLoadStats(results, nextDistricts) {
  const stats = createLoadStats();

  for (const result of results) {
    const districtId = result?.district?.id;
    const districtState = districtId ? nextDistricts[districtId] : null;

    if (hasUsableData(districtState)) {
      stats.usableLocations += 1;
      if (districtState.stale) stats.staleLocations += 1;
    }

    if (result?.status === "error" || districtState?.status === "error") {
      stats.failures += 1;
    }

    if (
      result?.data?.source === "network" &&
      result?.data?.stale !== true &&
      districtState?.status === "ready"
    ) {
      stats.networkSuccesses += 1;
    }
  }

  return stats;
}

async function loadDistricts(generation, options) {
  try {
    const results = await getAllDistrictWeather({
      forceRefresh: options.forceRefresh
    });

    if (generation !== loadGeneration) return createLoadStats();

    let stats = createLoadStats();
    setState(currentState => {
      const nextDistricts = { ...currentState.districts };

      for (const result of results) {
        const districtId = result?.district?.id;
        if (!districtId || !nextDistricts[districtId]) continue;

        nextDistricts[districtId] = mapDistrictResult(
          result,
          nextDistricts[districtId],
          options.preserveExistingData
        );
      }

      stats = getDistrictLoadStats(results, nextDistricts);
      return { districts: nextDistricts };
    });

    return stats;
  } catch (error) {
    if (generation !== loadGeneration) return createLoadStats();

    const stats = createLoadStats();
    setState(currentState => {
      const nextDistricts = Object.fromEntries(
        Object.entries(currentState.districts).map(([districtId, districtState]) => {
          const nextDistrictState = createFailedLocationState(
            districtState,
            error,
            options.preserveExistingData
          );

          stats.failures += 1;
          if (hasUsableData(nextDistrictState)) {
            stats.usableLocations += 1;
            stats.staleLocations += 1;
          }

          return [districtId, nextDistrictState];
        })
      );

      return { districts: nextDistricts };
    });

    return stats;
  }
}

function getCompletedLoadStatus(stats, forceRefresh) {
  if (stats.networkSuccesses > 0) return "ready";
  if (stats.usableLocations === 0) return "error";
  if (forceRefresh || stats.staleLocations > 0 || stats.failures > 0) {
    return "stale";
  }
  return "ready";
}

async function runWeatherLoad({ forceRefresh, isInitialLoad }) {
  const generation = ++loadGeneration;
  const options = {
    forceRefresh,
    preserveExistingData: !isInitialLoad
  };

  if (isInitialLoad) markInitialLoadStarted();
  else markRefreshStarted();

  const [cityStats, districtStats] = await Promise.all([
    loadCity(generation, options),
    loadDistricts(generation, options)
  ]);

  if (generation !== loadGeneration) return getState();

  const stats = combineLoadStats(cityStats, districtStats);
  const refreshStatus = getCompletedLoadStatus(stats, forceRefresh);

  setState(currentState => ({
    refresh: {
      status: refreshStatus,
      lastSuccessfulAt: stats.networkSuccesses > 0
        ? Date.now()
        : currentState.refresh.lastSuccessfulAt
    }
  }));

  return getState();
}

/**
 * Loads Bandung and every configured district without relying on selection.
 * Importing this module does not start the load automatically.
 *
 * @returns {Promise<object>} Final application-state snapshot for this load.
 */
export async function initializeApp() {
  return runWeatherLoad({ forceRefresh: false, isInitialLoad: true });
}

/**
 * Forces a current-weather refresh while retaining existing usable state.
 * Older load completions are ignored through the generation token.
 *
 * @returns {Promise<object>} Final application-state snapshot for this load.
 */
export async function refreshWeather() {
  return runWeatherLoad({ forceRefresh: true, isInitialLoad: false });
}

/**
 * Selects an already-configured district without performing retrieval.
 *
 * @param {string} districtId
 * @returns {object} Selected district state.
 */
export function selectDistrict(districtId) {
  if (!DISTRICT_IDS.has(districtId)) {
    throw new RangeError(`Unknown district ID: ${String(districtId)}`);
  }

  setState({ selectedDistrictId: districtId });
  return getState().districts[districtId];
}

/**
 * Replaces comparison selection with unique configured district IDs.
 * No artificial maximum is imposed because the product documents define none.
 *
 * @param {string[]} districtIds
 * @returns {readonly string[]} Updated comparison selection.
 */
export function setComparisonDistricts(districtIds) {
  if (!Array.isArray(districtIds)) {
    throw new TypeError("Comparison district IDs must be an array.");
  }

  const selectedIds = [];
  for (const districtId of districtIds) {
    if (!DISTRICT_IDS.has(districtId)) {
      throw new RangeError(`Unknown district ID: ${String(districtId)}`);
    }
    if (!selectedIds.includes(districtId)) selectedIds.push(districtId);
  }

  const currentIds = getState().comparison.selectedIds;
  const isUnchanged = currentIds.length === selectedIds.length &&
    currentIds.every((districtId, index) => districtId === selectedIds[index]);

  if (!isUnchanged) {
    setState({ comparison: { selectedIds } });
  }

  return getState().comparison.selectedIds;
}

function bootstrapBrowserApp() {
  const initialState = getState();

  initializeAppView({
    state: initialState,
    onRefresh: refreshWeather,
    onSelectDistrict: selectDistrict
  });
  subscribe(renderApp);
  renderApp(initialState);
  void initializeApp();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapBrowserApp, {
      once: true
    });
  } else {
    bootstrapBrowserApp();
  }
}
