import {
  fetchBandungWeather,
  fetchWeatherByCoordinates,
  WeatherApiError
} from "../api/weatherApi.js";
import { MAX_CONCURRENT_REQUESTS } from "../config/constants.js";
import { DISTRICTS } from "../config/districts.js";
import {
  getCachedWeather,
  isCacheFresh,
  setCachedWeather
} from "./cacheService.js";

const BANDUNG_CACHE_ID = "bandung";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumberOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function toStringOrNull(value) {
  return typeof value === "string" ? value : null;
}

function isUsableWeatherEntry(weatherEntry) {
  return (
    isObject(weatherEntry) &&
    (Number.isFinite(weatherEntry.id) ||
      (typeof weatherEntry.main === "string" && weatherEntry.main.trim() !== ""))
  );
}

function createInvalidResponseError(message) {
  return new WeatherApiError(message, { type: "INVALID_RESPONSE" });
}

function validateRawWeatherResponse(rawWeather) {
  if (!isObject(rawWeather)) {
    throw createInvalidResponseError(
      "OpenWeather response must be a JSON object."
    );
  }

  if (
    !isObject(rawWeather.coord) ||
    !Number.isFinite(rawWeather.coord.lat) ||
    !Number.isFinite(rawWeather.coord.lon)
  ) {
    throw createInvalidResponseError(
      "OpenWeather response is missing valid coordinates."
    );
  }

  if (!isObject(rawWeather.main)) {
    throw createInvalidResponseError(
      "OpenWeather response is missing the main weather measurements."
    );
  }

  const weatherEntry = Array.isArray(rawWeather.weather)
    ? rawWeather.weather.find(isUsableWeatherEntry)
    : null;

  if (!weatherEntry) {
    throw createInvalidResponseError(
      "OpenWeather response is missing a usable weather condition."
    );
  }

  return weatherEntry;
}

/**
 * Converts raw OpenWeather JSON into the stable NIMBUS weather model.
 * Optional or invalid provider fields become null rather than fabricated zeroes.
 *
 * @param {Record<string, unknown>} rawWeather
 * @returns {{
 *   locationName: string | null,
 *   latitude: number,
 *   longitude: number,
 *   observedAt: number | null,
 *   timezoneOffsetSec: number | null,
 *   conditionCode: number | null,
 *   condition: string | null,
 *   description: string | null,
 *   iconCode: string | null,
 *   temperatureC: number | null,
 *   feelsLikeC: number | null,
 *   tempMinC: number | null,
 *   tempMaxC: number | null,
 *   pressureHpa: number | null,
 *   humidityPct: number | null,
 *   seaLevelHpa: number | null,
 *   groundLevelHpa: number | null,
 *   visibilityM: number | null,
 *   cloudCoverPct: number | null,
 *   windSpeedMps: number | null,
 *   windDirectionDeg: number | null,
 *   windGustMps: number | null,
 *   rain1hMm: number | null,
 *   sunriseUnix: number | null,
 *   sunsetUnix: number | null
 * }}
 * @throws {WeatherApiError} When required provider fields are unusable.
 */
export function normalizeWeatherResponse(rawWeather) {
  const weatherEntry = validateRawWeatherResponse(rawWeather);

  return {
    locationName: toStringOrNull(rawWeather.name),
    latitude: rawWeather.coord.lat,
    longitude: rawWeather.coord.lon,

    observedAt: toFiniteNumberOrNull(rawWeather.dt),
    timezoneOffsetSec: toFiniteNumberOrNull(rawWeather.timezone),

    conditionCode: toFiniteNumberOrNull(weatherEntry.id),
    condition: toStringOrNull(weatherEntry.main),
    description: toStringOrNull(weatherEntry.description),
    iconCode: toStringOrNull(weatherEntry.icon),

    temperatureC: toFiniteNumberOrNull(rawWeather.main.temp),
    feelsLikeC: toFiniteNumberOrNull(rawWeather.main.feels_like),
    tempMinC: toFiniteNumberOrNull(rawWeather.main.temp_min),
    tempMaxC: toFiniteNumberOrNull(rawWeather.main.temp_max),

    pressureHpa: toFiniteNumberOrNull(rawWeather.main.pressure),
    humidityPct: toFiniteNumberOrNull(rawWeather.main.humidity),
    seaLevelHpa: toFiniteNumberOrNull(rawWeather.main.sea_level),
    groundLevelHpa: toFiniteNumberOrNull(rawWeather.main.grnd_level),

    visibilityM: toFiniteNumberOrNull(rawWeather.visibility),
    cloudCoverPct: toFiniteNumberOrNull(rawWeather.clouds?.all),

    windSpeedMps: toFiniteNumberOrNull(rawWeather.wind?.speed),
    windDirectionDeg: toFiniteNumberOrNull(rawWeather.wind?.deg),
    windGustMps: toFiniteNumberOrNull(rawWeather.wind?.gust),

    rain1hMm: toFiniteNumberOrNull(rawWeather.rain?.["1h"]),

    sunriseUnix: toFiniteNumberOrNull(rawWeather.sys?.sunrise),
    sunsetUnix: toFiniteNumberOrNull(rawWeather.sys?.sunset)
  };
}

function assertValidDistrict(district) {
  const hasValidId =
    isObject(district) &&
    typeof district.id === "string" &&
    district.id.trim() !== "";
  const hasValidCoordinates =
    hasValidId &&
    Number.isFinite(district.lat) &&
    district.lat >= -90 &&
    district.lat <= 90 &&
    Number.isFinite(district.lon) &&
    district.lon >= -180 &&
    district.lon <= 180;

  if (!hasValidId || !hasValidCoordinates) {
    throw new TypeError(
      "District metadata must include a non-empty ID and valid coordinates."
    );
  }
}

async function getWeather(locationId, fetchRawWeather, options = {}) {
  const forceRefresh = options?.forceRefresh === true;
  const cacheEntry = getCachedWeather(locationId);

  if (!forceRefresh && isCacheFresh(cacheEntry)) {
    return {
      data: cacheEntry.data,
      source: "cache",
      stale: false,
      error: null
    };
  }

  try {
    const rawWeather = await fetchRawWeather();
    const normalizedWeather = normalizeWeatherResponse(rawWeather);
    setCachedWeather(locationId, normalizedWeather);

    return {
      data: normalizedWeather,
      source: "network",
      stale: false,
      error: null
    };
  } catch (error) {
    if (cacheEntry) {
      return {
        data: cacheEntry.data,
        source: "cache",
        stale: true,
        error
      };
    }

    throw error;
  }
}

/**
 * Retrieves normalized Bandung overview weather with cache and stale fallback.
 *
 * @param {{ forceRefresh?: boolean }} [options]
 * @returns {Promise<{
 *   data: object,
 *   source: "network" | "cache",
 *   stale: boolean,
 *   error: unknown | null
 * }>}
 */
export async function getCityWeather(options = {}) {
  return getWeather(BANDUNG_CACHE_ID, fetchBandungWeather, options);
}

/**
 * Retrieves normalized weather for one configured district.
 *
 * @param {{ id: string, lat: number, lon: number }} district
 * @param {{ forceRefresh?: boolean }} [options]
 * @returns {Promise<{
 *   data: object,
 *   source: "network" | "cache",
 *   stale: boolean,
 *   error: unknown | null
 * }>}
 */
export async function getDistrictWeather(district, options = {}) {
  assertValidDistrict(district);

  return getWeather(
    district.id,
    () => fetchWeatherByCoordinates(district.lat, district.lon),
    options
  );
}

/**
 * Retrieves every configured district with limited concurrency and isolated
 * per-district failures. Results preserve the DISTRICTS configuration order.
 *
 * @param {{ forceRefresh?: boolean }} [options]
 * @returns {Promise<Array<{
 *   district: object,
 *   status: "ready" | "stale" | "error",
 *   data: object | null,
 *   error: unknown | null
 * }>>}
 */
export async function getAllDistrictWeather(options = {}) {
  const results = new Array(DISTRICTS.length);
  let nextDistrictIndex = 0;

  async function processNextDistrict() {
    while (nextDistrictIndex < DISTRICTS.length) {
      const districtIndex = nextDistrictIndex;
      nextDistrictIndex += 1;

      const district = DISTRICTS[districtIndex];

      try {
        const serviceResult = await getDistrictWeather(district, options);

        results[districtIndex] = {
          district,
          status: serviceResult.stale ? "stale" : "ready",
          data: serviceResult,
          error: serviceResult.error
        };
      } catch (error) {
        results[districtIndex] = {
          district,
          status: "error",
          data: null,
          error
        };
      }
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_REQUESTS, DISTRICTS.length);
  const workers = Array.from(
    { length: workerCount },
    () => processNextDistrict()
  );

  await Promise.all(workers);
  return results;
}
