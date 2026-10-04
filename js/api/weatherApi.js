import {
  BANDUNG_QUERY,
  OPENWEATHER_API_KEY,
  OPENWEATHER_BASE_URL,
  REQUEST_TIMEOUT_MS,
  WEATHER_UNITS
} from "../config/constants.js";

/**
 * Technical error raised at the OpenWeather provider boundary.
 */
export class WeatherApiError extends Error {
  /**
   * @param {string} message
   * @param {{ type?: string, statusCode?: number, cause?: unknown }} [details]
   */
  constructor(
    message,
    { type = "UNKNOWN", statusCode, cause } = {}
  ) {
    super(message);
    this.name = "WeatherApiError";
    this.type = type;

    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }

    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

function assertValidCoordinates(latitude, longitude) {
  const isLatitudeValid =
    Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
  const isLongitudeValid =
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;

  if (!isLatitudeValid || !isLongitudeValid) {
    throw new WeatherApiError(
      "Latitude and longitude must be finite numbers within valid geographic ranges.",
      { type: "INVALID_COORDINATES" }
    );
  }
}

function createWeatherUrl(params) {
  const url = new URL(OPENWEATHER_BASE_URL);
  url.search = new URLSearchParams({
    ...params,
    units: WEATHER_UNITS,
    appid: OPENWEATHER_API_KEY
  });

  return url;
}

function createHttpError(response) {
  let type = "HTTP_ERROR";

  if (response.status === 401) {
    type = "UNAUTHORIZED";
  } else if (response.status === 429) {
    type = "RATE_LIMITED";
  }

  return new WeatherApiError(
    `OpenWeather request failed with HTTP status ${response.status}.`,
    {
      type,
      statusCode: response.status
    }
  );
}

async function requestWeather(params) {
  const url = createWeatherUrl(params);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response;

    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new WeatherApiError(
          `OpenWeather request timed out after ${REQUEST_TIMEOUT_MS} ms.`,
          { type: "TIMEOUT", cause: error }
        );
      }

      throw new WeatherApiError("OpenWeather network request failed.", {
        type: "NETWORK_ERROR",
        cause: error
      });
    }

    if (!response.ok) {
      throw createHttpError(response);
    }

    try {
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) {
        throw new WeatherApiError(
          `OpenWeather request timed out after ${REQUEST_TIMEOUT_MS} ms.`,
          { type: "TIMEOUT", cause: error }
        );
      }

      throw new WeatherApiError(
        "OpenWeather returned a response that could not be parsed as JSON.",
        { type: "INVALID_RESPONSE", cause: error }
      );
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Requests raw current-weather JSON for a representative coordinate.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<Record<string, unknown>>}
 * @throws {WeatherApiError}
 */
export async function fetchWeatherByCoordinates(latitude, longitude) {
  assertValidCoordinates(latitude, longitude);

  return requestWeather({
    lat: String(latitude),
    lon: String(longitude)
  });
}

/**
 * Requests raw current-weather JSON for the assignment-provided Bandung query.
 *
 * @returns {Promise<Record<string, unknown>>}
 * @throws {WeatherApiError}
 */
export async function fetchBandungWeather() {
  return requestWeather({ q: BANDUNG_QUERY });
}
