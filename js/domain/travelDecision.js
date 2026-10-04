import {
  categorizeRain,
  categorizeVisibility,
  categorizeWind,
  createReason,
  getRainReasonCode,
  getVisibilityReasonCode,
  getWindReasonCode,
  isThunderstorm
} from "./weatherClassification.js";

const DECISIONS = Object.freeze({
  GOOD_TO_GO: {
    title: "Good to go",
    advice: "Current conditions are generally supportive, but remain aware of local weather."
  },
  GO_BUT_PREPARE: {
    title: "Go, but prepare",
    advice: "Prepare for the current conditions and allow extra care while travelling."
  },
  NOT_IDEAL: {
    title: "Not ideal",
    advice: "Consider a more sheltered plan under the current conditions."
  },
  BETTER_INDOORS: {
    title: "Better indoors",
    advice: "Prefer indoor plans under the current conditions."
  }
});

function getScore(outdoorReadiness) {
  if (Number.isFinite(outdoorReadiness)) return outdoorReadiness;
  if (Number.isFinite(outdoorReadiness?.score)) return outdoorReadiness.score;
  return null;
}

function getMobilityLevel(mobilityMood) {
  if (typeof mobilityMood === "string") return mobilityMood;
  return mobilityMood?.level ?? null;
}

function collectReasons(weather, outdoorReadiness, mobilityMood) {
  const rainBand = categorizeRain(weather);
  const visibilityBand = categorizeVisibility(weather);
  const windBand = categorizeWind(weather);
  const reasons = [];
  const rainCode = getRainReasonCode(rainBand, isThunderstorm(weather));
  const visibilityCode = getVisibilityReasonCode(visibilityBand);
  const windCode = getWindReasonCode(windBand);

  if (rainCode && rainBand !== "none") {
    reasons.push(createReason(rainCode, weather?.rain1hMm));
  }
  if (visibilityCode) {
    reasons.push(createReason(visibilityCode, weather?.visibilityM));
  }
  if (windCode) {
    reasons.push(createReason(windCode, weather?.windSpeedMps));
  }

  const inheritedReasons = [
    ...(Array.isArray(outdoorReadiness?.reasons)
      ? outdoorReadiness.reasons
      : []),
    ...(Array.isArray(mobilityMood?.reasons) ? mobilityMood.reasons : [])
  ];

  for (const reason of inheritedReasons) {
    if (
      reason &&
      typeof reason.code === "string" &&
      !reasons.some(existingReason => existingReason.code === reason.code)
    ) {
      reasons.push(reason);
    }
  }

  return reasons.slice(0, 3);
}

/**
 * Produces the current travel decision from approved readiness and mobility
 * results, with severe weather taking precedence.
 *
 * @param {object} weather
 * @param {number | { score: number, confidence?: string, reasons?: object[] }} outdoorReadiness
 * @param {string | { level: string, confidence?: string, reasons?: object[] }} mobilityMood
 * @returns {{ code: string, title: string, reasons: object[], advice: string }}
 */
export function evaluateTravelDecision(
  weather,
  outdoorReadiness,
  mobilityMood
) {
  const score = getScore(outdoorReadiness);
  const mobilityLevel = getMobilityLevel(mobilityMood);
  const rainBand = categorizeRain(weather);
  const visibilityBand = categorizeVisibility(weather);
  const windBand = categorizeWind(weather);
  const severeCondition =
    isThunderstorm(weather) ||
    rainBand === "heavy" ||
    visibilityBand === "very_poor" ||
    windBand === "very_strong";
  let code;

  if (severeCondition || (score !== null && score < 25)) {
    code = "BETTER_INDOORS";
  } else if (
    (score !== null && score >= 25 && score <= 44) ||
    rainBand === "moderate" ||
    visibilityBand === "poor"
  ) {
    code = "NOT_IDEAL";
  } else if (
    (score !== null && score >= 45 && score <= 69) ||
    rainBand === "light" ||
    mobilityLevel === "CAUTION"
  ) {
    code = "GO_BUT_PREPARE";
  } else if (
    score !== null &&
    score >= 70 &&
    (mobilityLevel === "GOOD" || mobilityLevel === "FAIR")
  ) {
    code = "GOOD_TO_GO";
  } else {
    code = "GO_BUT_PREPARE";
  }

  const hasLowConfidence =
    outdoorReadiness?.confidence === "low" || mobilityMood?.confidence === "low";

  const reasons = collectReasons(weather, outdoorReadiness, mobilityMood);
  if (
    hasLowConfidence &&
    !reasons.some(reason => reason.code === "DATA_INCOMPLETE")
  ) {
    const incompleteReason = createReason("DATA_INCOMPLETE");
    if (reasons.length >= 3) reasons[2] = incompleteReason;
    else reasons.push(incompleteReason);
  }

  if (reasons.length === 0) reasons.push(createReason("CURRENT_CONDITIONS"));

  const decision = DECISIONS[code];
  const rainPresent = rainBand !== null && rainBand !== "none";

  return {
    code,
    title: decision.title,
    reasons: reasons.slice(0, 3),
    advice: code === "GO_BUT_PREPARE" && rainPresent
      ? "Bring rain protection and stay mindful of wet surfaces."
      : decision.advice
  };
}
