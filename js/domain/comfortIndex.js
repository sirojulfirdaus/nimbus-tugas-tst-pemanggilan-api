import {
  categorizeHumidity,
  categorizeRain,
  categorizeWind,
  clampScore,
  createReason,
  getConfidenceMetadata,
  getFeelsLikeTemperature,
  getHumidityReasonCode,
  getRainReasonCode,
  getTemperatureReasonCode,
  getWindReasonCode,
  categorizeTemperature,
  isThunderstorm
} from "./weatherClassification.js";

const HUMIDITY_PENALTIES = Object.freeze({
  dry: 8,
  comfortable: 0,
  humid: 8,
  very_humid: 16,
  extremely_humid: 25
});

const RAIN_PENALTIES = Object.freeze({
  none: 0,
  trace: 3,
  light: 7,
  moderate: 15,
  heavy: 25
});

const WIND_ADJUSTMENTS = Object.freeze({
  calm: 0,
  light: 2,
  moderate: 0,
  strong: -8,
  very_strong: -20
});

function getTemperaturePenalty(temperature) {
  if (temperature === null) return 0;
  if (temperature < 12) return 25;
  if (temperature < 15) return 15;
  if (temperature < 18) return 7;
  if (temperature < 29) return 0;
  if (temperature < 32) return 8;
  if (temperature < 35) return 18;
  return 30;
}

function getComfortLevel(score) {
  if (score >= 80) return "comfortable";
  if (score >= 65) return "pleasant";
  if (score >= 50) return "fair";
  if (score >= 35) return "uncomfortable";
  return "poor";
}

/**
 * Calculates perceived everyday comfort from normalized current weather.
 *
 * @param {object} weather
 * @returns {{ score: number, level: string, reasons: object[], confidence: string, missingSignals: string[] }}
 */
export function calculateComfortIndex(weather) {
  const humidityBand = categorizeHumidity(weather);
  const rainBand = categorizeRain(weather);
  const windBand = categorizeWind(weather);
  const temperatureBand = categorizeTemperature(weather);
  const temperature = getFeelsLikeTemperature(weather);

  const humidityPenalty = HUMIDITY_PENALTIES[humidityBand] ?? 0;
  const temperaturePenalty = getTemperaturePenalty(temperature);
  const rainPenalty = RAIN_PENALTIES[rainBand] ?? 0;
  const windAdjustment = WIND_ADJUSTMENTS[windBand] ?? 0;
  const score = clampScore(
    100 - humidityPenalty - temperaturePenalty - rainPenalty + windAdjustment
  );
  const reasons = [];

  const rainReasonCode = getRainReasonCode(rainBand, isThunderstorm(weather));
  if (rainReasonCode && rainPenalty > 0) {
    reasons.push(createReason(rainReasonCode, weather?.rain1hMm, -rainPenalty));
  }

  const windReasonCode = getWindReasonCode(windBand);
  if (windReasonCode && windAdjustment !== 0) {
    reasons.push(
      createReason(windReasonCode, weather?.windSpeedMps, windAdjustment)
    );
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
      createReason(temperatureReasonCode, temperature, -temperaturePenalty)
    );
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
    level: getComfortLevel(score),
    reasons,
    ...confidenceMetadata
  };
}
