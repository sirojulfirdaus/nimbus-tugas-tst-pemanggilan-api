const REASON_MESSAGES = Object.freeze({
  THUNDERSTORM: "A thunderstorm is present.",
  RAIN_TRACE: "Trace rainfall is present.",
  RAIN_LIGHT: "Light rain is present.",
  RAIN_MODERATE: "Moderate rain is present.",
  RAIN_HEAVY: "Heavy rain is present.",
  HUMIDITY_DRY: "The air is dry.",
  HUMIDITY_HIGH: "The air is humid.",
  HUMIDITY_VERY_HIGH: "The air is very humid.",
  VISIBILITY_EXCELLENT: "Visibility is excellent.",
  VISIBILITY_GOOD: "Visibility remains good.",
  VISIBILITY_REDUCED: "Visibility is reduced.",
  VISIBILITY_POOR: "Visibility is poor.",
  VISIBILITY_VERY_POOR: "Visibility is very poor.",
  WIND_CALM: "Winds are calm.",
  WIND_LIGHT: "Winds are light.",
  WIND_MODERATE: "Winds are moderate.",
  WIND_STRONG: "Winds are strong.",
  WIND_VERY_STRONG: "Winds are very strong.",
  WIND_GUSTY: "Wind gusts are notably stronger than sustained wind.",
  TEMP_COOL: "The air feels cool.",
  TEMP_MILD: "The temperature feels mild.",
  TEMP_COMFORTABLE: "The temperature is comfortable.",
  TEMP_WARM: "The air feels warm.",
  TEMP_HOT: "The air feels hot.",
  CLOUD_CLEAR: "The sky is clear.",
  CLOUD_PARTLY_CLOUDY: "The sky is partly cloudy.",
  CLOUD_MOSTLY_CLOUDY: "The sky is mostly cloudy.",
  CLOUD_OVERCAST: "The sky is overcast.",
  DAYLIGHT_SUPPORTIVE: "Dry daylight conditions support this activity.",
  DATA_INCOMPLETE: "Some important weather signals are unavailable.",
  CURRENT_CONDITIONS: "Available current conditions support this result."
});

function isFiniteInRange(value, minimum, maximum = Infinity) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

/**
 * Creates a reusable explainability reason.
 *
 * @param {string} code
 * @param {unknown} [value]
 * @param {number} [scoreImpact]
 * @returns {{ code: string, message: string, value?: unknown, scoreImpact?: number }}
 */
export function createReason(code, value, scoreImpact) {
  const reason = {
    code,
    message: REASON_MESSAGES[code] ?? code
  };

  if (value !== undefined) {
    reason.value = value;
  }

  if (scoreImpact !== undefined) {
    reason.scoreImpact = scoreImpact;
  }

  return reason;
}

/**
 * @param {object} weather
 * @returns {boolean}
 */
export function isThunderstorm(weather) {
  const condition = typeof weather?.condition === "string"
    ? weather.condition.toLowerCase()
    : "";
  const description = typeof weather?.description === "string"
    ? weather.description.toLowerCase()
    : "";

  return condition === "thunderstorm" || description.includes("thunderstorm");
}

/**
 * @param {object} weather
 * @returns {"none" | "trace" | "light" | "moderate" | "heavy" | null}
 */
export function categorizeRain(weather) {
  const rainfall = weather?.rain1hMm;

  if (isFiniteInRange(rainfall, 0)) {
    if (rainfall === 0) return "none";
    if (rainfall < 0.5) return "trace";
    if (rainfall < 2.5) return "light";
    if (rainfall < 7.5) return "moderate";
    return "heavy";
  }

  const condition = typeof weather?.condition === "string"
    ? weather.condition.toLowerCase()
    : "";
  const description = typeof weather?.description === "string"
    ? weather.description.toLowerCase()
    : "";

  if (isThunderstorm(weather)) return "heavy";
  if (condition === "drizzle" || description.includes("drizzle")) return "light";

  if (condition === "rain" || description.includes("rain")) {
    if (
      description.includes("heavy") ||
      description.includes("extreme") ||
      description.includes("very heavy")
    ) {
      return "heavy";
    }

    if (description.includes("light")) return "light";
    return "moderate";
  }

  return condition === "" ? null : "none";
}

/**
 * @param {object} weather
 * @returns {"dry" | "comfortable" | "humid" | "very_humid" | "extremely_humid" | null}
 */
export function categorizeHumidity(weather) {
  const humidity = weather?.humidityPct;
  if (!isFiniteInRange(humidity, 0, 100)) return null;
  if (humidity < 40) return "dry";
  if (humidity <= 70) return "comfortable";
  if (humidity <= 80) return "humid";
  if (humidity <= 90) return "very_humid";
  return "extremely_humid";
}

/**
 * @param {object} weather
 * @returns {"excellent" | "good" | "reduced" | "poor" | "very_poor" | null}
 */
export function categorizeVisibility(weather) {
  const visibility = weather?.visibilityM;
  if (!isFiniteInRange(visibility, 0)) return null;
  if (visibility >= 10000) return "excellent";
  if (visibility >= 5000) return "good";
  if (visibility >= 2000) return "reduced";
  if (visibility >= 1000) return "poor";
  return "very_poor";
}

/**
 * @param {object} weather
 * @returns {"calm" | "light" | "moderate" | "strong" | "very_strong" | null}
 */
export function categorizeWind(weather) {
  const windSpeed = weather?.windSpeedMps;
  if (!isFiniteInRange(windSpeed, 0)) return null;
  if (windSpeed < 1) return "calm";
  if (windSpeed < 4) return "light";
  if (windSpeed < 8) return "moderate";
  if (windSpeed < 13) return "strong";
  return "very_strong";
}

/**
 * @param {object} weather
 * @returns {boolean}
 */
export function isGusty(weather) {
  return (
    isFiniteInRange(weather?.windSpeedMps, 0) &&
    isFiniteInRange(weather?.windGustMps, 0) &&
    weather.windGustMps >= weather.windSpeedMps + 4
  );
}

/**
 * @param {object} weather
 * @returns {"clear" | "partly_cloudy" | "mostly_cloudy" | "overcast" | null}
 */
export function categorizeCloudCover(weather) {
  const cloudCover = weather?.cloudCoverPct;
  if (!isFiniteInRange(cloudCover, 0, 100)) return null;
  if (cloudCover <= 20) return "clear";
  if (cloudCover <= 50) return "partly_cloudy";
  if (cloudCover <= 80) return "mostly_cloudy";
  return "overcast";
}

/**
 * @param {object} weather
 * @returns {number | null}
 */
export function getFeelsLikeTemperature(weather) {
  if (Number.isFinite(weather?.feelsLikeC)) return weather.feelsLikeC;
  if (Number.isFinite(weather?.temperatureC)) return weather.temperatureC;
  return null;
}

/**
 * @param {object} weather
 * @returns {"cool" | "mild" | "comfortable" | "warm" | "hot" | null}
 */
export function categorizeTemperature(weather) {
  const temperature = getFeelsLikeTemperature(weather);
  if (temperature === null) return null;
  if (temperature < 18) return "cool";
  if (temperature < 24) return "mild";
  if (temperature < 29) return "comfortable";
  if (temperature <= 32) return "warm";
  return "hot";
}

/**
 * Uses provider timestamps first and the provider icon suffix only as fallback.
 *
 * @param {object} weather
 * @returns {boolean | null}
 */
export function isDaytime(weather) {
  if (
    Number.isFinite(weather?.sunriseUnix) &&
    Number.isFinite(weather?.sunsetUnix) &&
    Number.isFinite(weather?.observedAt)
  ) {
    return (
      weather.sunriseUnix <= weather.observedAt &&
      weather.observedAt < weather.sunsetUnix
    );
  }

  if (typeof weather?.iconCode === "string") {
    if (weather.iconCode.endsWith("d")) return true;
    if (weather.iconCode.endsWith("n")) return false;
  }

  return null;
}

/**
 * @param {object} weather
 * @returns {{ confidence: "high" | "partial" | "low", missingSignals: string[] }}
 */
export function getConfidenceMetadata(weather) {
  const signalAvailability = {
    rain: categorizeRain(weather) !== null,
    humidity: categorizeHumidity(weather) !== null,
    visibility: categorizeVisibility(weather) !== null,
    wind: categorizeWind(weather) !== null,
    temperature: categorizeTemperature(weather) !== null
  };
  const missingSignals = Object.entries(signalAvailability)
    .filter(([, isAvailable]) => !isAvailable)
    .map(([signal]) => signal);
  const availableCount = Object.keys(signalAvailability).length - missingSignals.length;

  return {
    confidence: availableCount === 5
      ? "high"
      : availableCount >= 2
        ? "partial"
        : "low",
    missingSignals
  };
}

/**
 * @param {number} score
 * @returns {number}
 */
export function clampScore(score) {
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * @param {number} score
 * @returns {"Excellent" | "Good" | "Fair" | "Caution" | "Poor"}
 */
export function getActivityLevel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 35) return "Caution";
  return "Poor";
}

export function getRainReasonCode(rainBand, thunderstorm = false) {
  if (thunderstorm) return "THUNDERSTORM";

  return {
    trace: "RAIN_TRACE",
    light: "RAIN_LIGHT",
    moderate: "RAIN_MODERATE",
    heavy: "RAIN_HEAVY"
  }[rainBand] ?? null;
}

export function getHumidityReasonCode(humidityBand) {
  return {
    dry: "HUMIDITY_DRY",
    humid: "HUMIDITY_HIGH",
    very_humid: "HUMIDITY_VERY_HIGH",
    extremely_humid: "HUMIDITY_VERY_HIGH"
  }[humidityBand] ?? null;
}

export function getVisibilityReasonCode(visibilityBand) {
  return {
    excellent: "VISIBILITY_EXCELLENT",
    good: "VISIBILITY_GOOD",
    reduced: "VISIBILITY_REDUCED",
    poor: "VISIBILITY_POOR",
    very_poor: "VISIBILITY_VERY_POOR"
  }[visibilityBand] ?? null;
}

export function getWindReasonCode(windBand) {
  return {
    calm: "WIND_CALM",
    light: "WIND_LIGHT",
    moderate: "WIND_MODERATE",
    strong: "WIND_STRONG",
    very_strong: "WIND_VERY_STRONG"
  }[windBand] ?? null;
}

export function getTemperatureReasonCode(temperatureBand) {
  return {
    cool: "TEMP_COOL",
    mild: "TEMP_MILD",
    comfortable: "TEMP_COMFORTABLE",
    warm: "TEMP_WARM",
    hot: "TEMP_HOT"
  }[temperatureBand] ?? null;
}

export function getCloudReasonCode(cloudBand) {
  return {
    clear: "CLOUD_CLEAR",
    partly_cloudy: "CLOUD_PARTLY_CLOUDY",
    mostly_cloudy: "CLOUD_MOSTLY_CLOUDY",
    overcast: "CLOUD_OVERCAST"
  }[cloudBand] ?? null;
}
