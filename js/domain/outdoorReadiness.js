import {
  categorizeCloudCover,
  categorizeHumidity,
  categorizeRain,
  categorizeTemperature,
  categorizeVisibility,
  categorizeWind,
  clampScore,
  createReason,
  getCloudReasonCode,
  getConfidenceMetadata,
  getHumidityReasonCode,
  getRainReasonCode,
  getTemperatureReasonCode,
  getVisibilityReasonCode,
  getWindReasonCode,
  isGusty,
  isThunderstorm
} from "./weatherClassification.js";

const RAIN_PENALTIES = Object.freeze({
  none: 0,
  trace: 8,
  light: 20,
  moderate: 35,
  heavy: 55
});

const HUMIDITY_PENALTIES = Object.freeze({
  dry: 5,
  comfortable: 0,
  humid: 5,
  very_humid: 10,
  extremely_humid: 15
});

const VISIBILITY_PENALTIES = Object.freeze({
  excellent: 0,
  good: 3,
  reduced: 12,
  poor: 25,
  very_poor: 40
});

const WIND_PENALTIES = Object.freeze({
  calm: 0,
  light: 0,
  moderate: 5,
  strong: 15,
  very_strong: 30
});

const TEMPERATURE_PENALTIES = Object.freeze({
  cool: 5,
  mild: 0,
  comfortable: 0,
  warm: 5,
  hot: 12
});

const CLOUD_PENALTIES = Object.freeze({
  clear: 0,
  partly_cloudy: 0,
  mostly_cloudy: 2,
  overcast: 5
});

function getOutdoorReadinessLevel(score) {
  if (score >= 80) return "excellent";
  if (score >= 65) return "good";
  if (score >= 50) return "fair";
  if (score >= 35) return "low";
  return "poor";
}

/**
 * Calculates NIMBUS Outdoor Readiness from normalized current weather.
 *
 * @param {object} weather
 * @returns {{
 *   score: number,
 *   level: "excellent" | "good" | "fair" | "low" | "poor",
 *   reasons: object[],
 *   confidence: "high" | "partial" | "low",
 *   missingSignals: string[]
 * }}
 */
export function calculateOutdoorReadiness(weather) {
  const rainBand = categorizeRain(weather);
  const humidityBand = categorizeHumidity(weather);
  const visibilityBand = categorizeVisibility(weather);
  const windBand = categorizeWind(weather);
  const temperatureBand = categorizeTemperature(weather);
  const cloudBand = categorizeCloudCover(weather);
  const hasThunderstorm = isThunderstorm(weather);
  const hasSignificantGust = isGusty(weather);

  const rainPenalty = hasThunderstorm
    ? 65
    : (RAIN_PENALTIES[rainBand] ?? 0);
  const humidityPenalty = HUMIDITY_PENALTIES[humidityBand] ?? 0;
  const visibilityPenalty = VISIBILITY_PENALTIES[visibilityBand] ?? 0;
  const windPenalty = WIND_PENALTIES[windBand] ?? 0;
  const gustPenalty = hasSignificantGust ? 5 : 0;
  const temperaturePenalty = TEMPERATURE_PENALTIES[temperatureBand] ?? 0;
  const cloudPenalty = CLOUD_PENALTIES[cloudBand] ?? 0;

  const score = clampScore(
    100 -
      rainPenalty -
      humidityPenalty -
      visibilityPenalty -
      windPenalty -
      gustPenalty -
      temperaturePenalty -
      cloudPenalty
  );
  const reasons = [];

  const rainReasonCode = getRainReasonCode(rainBand, hasThunderstorm);
  if (rainReasonCode && rainPenalty > 0) {
    reasons.push(createReason(rainReasonCode, weather?.rain1hMm, -rainPenalty));
  }

  const visibilityReasonCode = getVisibilityReasonCode(visibilityBand);
  if (visibilityReasonCode && (visibilityPenalty > 0 || visibilityBand === "excellent")) {
    reasons.push(
      createReason(visibilityReasonCode, weather?.visibilityM, -visibilityPenalty)
    );
  }

  const windReasonCode = getWindReasonCode(windBand);
  if (windReasonCode && (windPenalty > 0 || windBand === "calm")) {
    reasons.push(createReason(windReasonCode, weather?.windSpeedMps, -windPenalty));
  }

  if (hasSignificantGust) {
    reasons.push(createReason("WIND_GUSTY", weather?.windGustMps, -gustPenalty));
  }

  const humidityReasonCode = getHumidityReasonCode(humidityBand);
  if (humidityReasonCode && humidityPenalty > 0) {
    reasons.push(
      createReason(humidityReasonCode, weather?.humidityPct, -humidityPenalty)
    );
  }

  const temperatureReasonCode = getTemperatureReasonCode(temperatureBand);
  if (temperatureReasonCode && temperaturePenalty > 0) {
    reasons.push(
      createReason(
        temperatureReasonCode,
        weather?.feelsLikeC ?? weather?.temperatureC,
        -temperaturePenalty
      )
    );
  }

  const cloudReasonCode = getCloudReasonCode(cloudBand);
  if (cloudReasonCode && cloudPenalty > 0) {
    reasons.push(createReason(cloudReasonCode, weather?.cloudCoverPct, -cloudPenalty));
  }

  const confidenceMetadata = getConfidenceMetadata(weather);
  if (reasons.length === 0) {
    reasons.push(
      createReason(
        confidenceMetadata.confidence === "low"
          ? "DATA_INCOMPLETE"
          : "CURRENT_CONDITIONS"
      )
    );
  }

  return {
    score,
    level: getOutdoorReadinessLevel(score),
    reasons,
    ...confidenceMetadata
  };
}
