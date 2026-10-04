import { CACHE_TTL_MS } from "../config/constants.js";

const CACHE_KEY_PREFIX = "nimbus:weather";
const CACHE_VERSION = 1;

function createCacheKey(locationId) {
  if (typeof locationId !== "string" || locationId.trim() === "") {
    throw new TypeError("A non-empty location ID is required for weather cache access.");
  }

  return `${CACHE_KEY_PREFIX}:${locationId}`;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidCacheEntry(cacheEntry) {
  return (
    isObject(cacheEntry) &&
    cacheEntry.version === CACHE_VERSION &&
    Number.isFinite(cacheEntry.cachedAt) &&
    isObject(cacheEntry.data)
  );
}

/**
 * Reads a validated normalized-weather cache entry.
 * Cache access and malformed JSON failures are treated as cache misses.
 *
 * @param {string} locationId
 * @returns {{ version: number, cachedAt: number, data: object } | null}
 */
export function getCachedWeather(locationId) {
  try {
    const cachedValue = localStorage.getItem(createCacheKey(locationId));

    if (cachedValue === null) {
      return null;
    }

    const cacheEntry = JSON.parse(cachedValue);

    if (!isValidCacheEntry(cacheEntry)) {
      removeCachedWeather(locationId);
      return null;
    }

    return cacheEntry;
  } catch {
    return null;
  }
}

/**
 * Persists normalized weather without allowing storage failures to break
 * network retrieval.
 *
 * @param {string} locationId
 * @param {object} weather
 * @returns {boolean} Whether the cache write succeeded.
 */
export function setCachedWeather(locationId, weather) {
  if (!isObject(weather)) {
    return false;
  }

  const cacheEntry = {
    version: CACHE_VERSION,
    cachedAt: Date.now(),
    data: weather
  };

  try {
    localStorage.setItem(createCacheKey(locationId), JSON.stringify(cacheEntry));
    return true;
  } catch {
    return false;
  }
}

/**
 * Removes one weather cache entry.
 *
 * @param {string} locationId
 * @returns {boolean} Whether the removal operation succeeded.
 */
export function removeCachedWeather(locationId) {
  try {
    localStorage.removeItem(createCacheKey(locationId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Determines whether a cache entry is within the configured TTL.
 *
 * @param {{ cachedAt?: number } | null} cacheEntry
 * @param {number} [now]
 * @returns {boolean}
 */
export function isCacheFresh(cacheEntry, now = Date.now()) {
  if (!isValidCacheEntry(cacheEntry) || !Number.isFinite(now)) {
    return false;
  }

  const cacheAgeMs = now - cacheEntry.cachedAt;
  return cacheAgeMs >= 0 && cacheAgeMs < CACHE_TTL_MS;
}
