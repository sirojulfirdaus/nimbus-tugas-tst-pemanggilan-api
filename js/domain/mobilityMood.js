import {
  categorizeRain,
  categorizeVisibility,
  categorizeWind,
  createReason,
  getConfidenceMetadata,
  getRainReasonCode,
  getVisibilityReasonCode,
  getWindReasonCode,
  isGusty,
  isThunderstorm
} from "./weatherClassification.js";

function buildMobilityReasons(weather, context, level) {
  const reasons = [];
  const rainReasonCode = getRainReasonCode(
    context.rainBand,
    context.hasThunderstorm
  );
  const visibilityReasonCode = getVisibilityReasonCode(context.visibilityBand);
  const windReasonCode = getWindReasonCode(context.windBand);

  if (rainReasonCode && context.rainBand !== "none") {
    reasons.push(createReason(rainReasonCode, weather?.rain1hMm));
  }

  if (visibilityReasonCode) {
    reasons.push(createReason(visibilityReasonCode, weather?.visibilityM));
  }

  if (windReasonCode) {
    reasons.push(createReason(windReasonCode, weather?.windSpeedMps));
  }

  if (context.hasSignificantGust) {
    reasons.push(createReason("WIND_GUSTY", weather?.windGustMps));
  }

  if (
    reasons.length === 0 ||
    (level === "FAIR" && context.confidence === "low")
  ) {
    reasons.push(createReason("DATA_INCOMPLETE"));
  }

  return reasons.slice(0, 3);
}

/**
 * Calculates the semantic mobility status for current normalized weather.
 *
 * @param {object} weather
 * @returns {{ level: "GOOD" | "FAIR" | "CAUTION" | "POOR", reasons: object[], confidence: string, missingSignals: string[] }}
 */
export function calculateMobilityMood(weather) {
  const confidenceMetadata = getConfidenceMetadata(weather);
  const context = {
    rainBand: categorizeRain(weather),
    visibilityBand: categorizeVisibility(weather),
    windBand: categorizeWind(weather),
    hasSignificantGust: isGusty(weather),
    hasThunderstorm: isThunderstorm(weather),
    ...confidenceMetadata
  };

  let level;

  if (
    context.hasThunderstorm ||
    context.rainBand === "heavy" ||
    context.visibilityBand === "very_poor" ||
    context.windBand === "very_strong"
  ) {
    level = "POOR";
  } else {
    const moderateIssueCount = [
      context.rainBand === "light",
      context.windBand === "moderate"
    ].filter(Boolean).length;

    if (
      context.rainBand === "moderate" ||
      context.visibilityBand === "reduced" ||
      context.visibilityBand === "poor" ||
      context.windBand === "strong" ||
      context.hasSignificantGust ||
      moderateIssueCount >= 2
    ) {
      level = "CAUTION";
    } else if (
      (context.rainBand === "none" || context.rainBand === "trace") &&
      (context.visibilityBand === "excellent" || context.visibilityBand === "good") &&
      (context.windBand === "calm" || context.windBand === "light")
    ) {
      level = "GOOD";
    } else {
      level = "FAIR";
    }
  }

  return {
    level,
    reasons: buildMobilityReasons(weather, context, level),
    ...confidenceMetadata
  };
}
