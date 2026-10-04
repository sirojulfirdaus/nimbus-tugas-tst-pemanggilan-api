import {
  categorizeCloudCover,
  categorizeHumidity,
  categorizeRain,
  categorizeTemperature,
  categorizeVisibility,
  categorizeWind,
  clampScore,
  createReason,
  getActivityLevel,
  getCloudReasonCode,
  getConfidenceMetadata,
  getFeelsLikeTemperature,
  getHumidityReasonCode,
  getRainReasonCode,
  getTemperatureReasonCode,
  getVisibilityReasonCode,
  getWindReasonCode,
  isDaytime,
  isThunderstorm
} from "./weatherClassification.js";

const THUNDER_CAPPED_ACTIVITIES = new Set([
  "running",
  "riding",
  "outdoor-hangout",
  "picnic"
]);

const WIND_CAPPED_ACTIVITIES = new Set([
  "running",
  "walking",
  "riding",
  "outdoor-hangout",
  "picnic"
]);

function createActivityContext(weather) {
  return {
    rainBand: categorizeRain(weather),
    humidityBand: categorizeHumidity(weather),
    visibilityBand: categorizeVisibility(weather),
    windBand: categorizeWind(weather),
    cloudBand: categorizeCloudCover(weather),
    temperatureBand: categorizeTemperature(weather),
    temperature: getFeelsLikeTemperature(weather),
    daytime: isDaytime(weather),
    hasThunderstorm: isThunderstorm(weather),
    ...getConfidenceMetadata(weather)
  };
}

function addRainReason(reasons, weather, context, scoreImpact) {
  const code = getRainReasonCode(context.rainBand, context.hasThunderstorm);
  if (code && context.rainBand !== "none") {
    reasons.push(createReason(code, weather?.rain1hMm, scoreImpact));
  }
}

function addVisibilityReason(reasons, weather, context, scoreImpact) {
  const code = getVisibilityReasonCode(context.visibilityBand);
  if (code && scoreImpact !== 0) {
    reasons.push(createReason(code, weather?.visibilityM, scoreImpact));
  }
}

function addWindReason(reasons, weather, context, scoreImpact) {
  const code = getWindReasonCode(context.windBand);
  if (code && scoreImpact !== 0) {
    reasons.push(createReason(code, weather?.windSpeedMps, scoreImpact));
  }
}

function addHumidityReason(reasons, weather, context, scoreImpact) {
  const code = getHumidityReasonCode(context.humidityBand);
  if (code && scoreImpact !== 0) {
    reasons.push(createReason(code, weather?.humidityPct, scoreImpact));
  }
}

function addTemperatureReason(reasons, weather, code, scoreImpact) {
  if (code && scoreImpact !== 0) {
    reasons.push(createReason(code, getFeelsLikeTemperature(weather), scoreImpact));
  }
}

function addCloudReason(reasons, weather, context, scoreImpact) {
  const code = getCloudReasonCode(context.cloudBand);
  if (code && scoreImpact !== 0) {
    reasons.push(createReason(code, weather?.cloudCoverPct, scoreImpact));
  }
}

function addOutdoorSupportReasons(reasons, weather, context) {
  if (reasons.length >= 3) return;

  if (context.visibilityBand === "excellent" || context.visibilityBand === "good") {
    reasons.push(
      createReason(
        getVisibilityReasonCode(context.visibilityBand),
        weather?.visibilityM,
        0
      )
    );
  }

  if (
    reasons.length < 3 &&
    (context.windBand === "calm" || context.windBand === "light")
  ) {
    reasons.push(
      createReason(getWindReasonCode(context.windBand), weather?.windSpeedMps, 0)
    );
  }

  if (
    reasons.length < 3 &&
    (context.temperatureBand === "mild" ||
      context.temperatureBand === "comfortable")
  ) {
    reasons.push(
      createReason(
        getTemperatureReasonCode(context.temperatureBand),
        context.temperature,
        0
      )
    );
  }
}

function finalizeActivity(id, rawScore, reasons, context) {
  let cappedScore = rawScore;

  if (context.hasThunderstorm && THUNDER_CAPPED_ACTIVITIES.has(id)) {
    cappedScore = Math.min(cappedScore, 34);
  }

  if (context.windBand === "very_strong" && WIND_CAPPED_ACTIVITIES.has(id)) {
    cappedScore = Math.min(cappedScore, 49);
  }

  if (id === "riding" && context.visibilityBand === "very_poor") {
    cappedScore = Math.min(cappedScore, 34);
  }

  const score = clampScore(cappedScore);
  const primaryReasons = reasons.slice(0, 3);

  if (primaryReasons.length === 0) {
    primaryReasons.push(
      createReason(context.confidence === "low" ? "DATA_INCOMPLETE" : "CURRENT_CONDITIONS")
    );
  }

  return {
    id,
    score,
    level: getActivityLevel(score),
    reasons: primaryReasons,
    confidence: context.confidence,
    missingSignals: context.missingSignals
  };
}

function evaluateRunning(weather) {
  const context = createActivityContext(weather);
  const rainPenalty = ({ trace: 8, light: 25, moderate: 45, heavy: 70 })[
    context.rainBand
  ] ?? 0;
  const humidityPenalty = ({
    humid: 8,
    very_humid: 15,
    extremely_humid: 25
  })[context.humidityBand] ?? 0;
  const windPenalty = ({ moderate: 5, strong: 15, very_strong: 30 })[
    context.windBand
  ] ?? 0;
  const visibilityPenalty = ({ reduced: 10, poor: 20, very_poor: 35 })[
    context.visibilityBand
  ] ?? 0;
  let temperaturePenalty = 0;
  let temperatureReasonCode = null;

  if (context.temperature !== null) {
    if (context.temperature >= 32) {
      temperaturePenalty = 20;
      temperatureReasonCode = "TEMP_HOT";
    } else if (context.temperature >= 29) {
      temperaturePenalty = 10;
      temperatureReasonCode = "TEMP_WARM";
    } else if (context.temperature < 18) {
      temperaturePenalty = 8;
      temperatureReasonCode = "TEMP_COOL";
    }
  }

  const reasons = [];
  addRainReason(reasons, weather, context, -rainPenalty);
  addVisibilityReason(reasons, weather, context, -visibilityPenalty);
  addWindReason(reasons, weather, context, -windPenalty);
  addHumidityReason(reasons, weather, context, -humidityPenalty);
  addTemperatureReason(reasons, weather, temperatureReasonCode, -temperaturePenalty);
  addOutdoorSupportReasons(reasons, weather, context);

  return finalizeActivity(
    "running",
    100 -
      rainPenalty -
      humidityPenalty -
      windPenalty -
      visibilityPenalty -
      temperaturePenalty,
    reasons,
    context
  );
}

function evaluateWalking(weather) {
  const context = createActivityContext(weather);
  const rainPenalty = ({ trace: 5, light: 15, moderate: 30, heavy: 55 })[
    context.rainBand
  ] ?? 0;
  const humidityPenalty = ({ very_humid: 8, extremely_humid: 15 })[
    context.humidityBand
  ] ?? 0;
  const visibilityPenalty = ({ reduced: 8, poor: 18, very_poor: 30 })[
    context.visibilityBand
  ] ?? 0;
  const windPenalty = ({ strong: 12, very_strong: 25 })[
    context.windBand
  ] ?? 0;
  const reasons = [];

  addRainReason(reasons, weather, context, -rainPenalty);
  addVisibilityReason(reasons, weather, context, -visibilityPenalty);
  addWindReason(reasons, weather, context, -windPenalty);
  addHumidityReason(reasons, weather, context, -humidityPenalty);
  addOutdoorSupportReasons(reasons, weather, context);

  return finalizeActivity(
    "walking",
    100 - rainPenalty - humidityPenalty - visibilityPenalty - windPenalty,
    reasons,
    context
  );
}

function evaluateRiding(weather) {
  const context = createActivityContext(weather);
  const rainPenalty = ({ trace: 10, light: 25, moderate: 45, heavy: 70 })[
    context.rainBand
  ] ?? 0;
  const visibilityPenalty = ({ good: 3, reduced: 20, poor: 40, very_poor: 65 })[
    context.visibilityBand
  ] ?? 0;
  const windPenalty = ({ moderate: 8, strong: 25, very_strong: 50 })[
    context.windBand
  ] ?? 0;
  const severePenalty = context.hasThunderstorm ? 70 : 0;
  const reasons = [];

  addRainReason(reasons, weather, context, -(rainPenalty + severePenalty));
  addVisibilityReason(reasons, weather, context, -visibilityPenalty);
  addWindReason(reasons, weather, context, -windPenalty);
  addOutdoorSupportReasons(reasons, weather, context);

  return finalizeActivity(
    "riding",
    100 - rainPenalty - visibilityPenalty - windPenalty - severePenalty,
    reasons,
    context
  );
}

function evaluateOutdoorHangout(weather) {
  const context = createActivityContext(weather);
  const rainPenalty = ({ trace: 8, light: 20, moderate: 40, heavy: 65 })[
    context.rainBand
  ] ?? 0;
  const humidityPenalty = ({ very_humid: 8, extremely_humid: 15 })[
    context.humidityBand
  ] ?? 0;
  const windPenalty = ({ strong: 10, very_strong: 25 })[
    context.windBand
  ] ?? 0;
  const reasons = [];

  addRainReason(reasons, weather, context, -rainPenalty);
  addWindReason(reasons, weather, context, -windPenalty);
  addHumidityReason(reasons, weather, context, -humidityPenalty);
  addOutdoorSupportReasons(reasons, weather, context);

  return finalizeActivity(
    "outdoor-hangout",
    100 - rainPenalty - humidityPenalty - windPenalty,
    reasons,
    context
  );
}

function evaluateCafe(weather) {
  const context = createActivityContext(weather);
  const rainAdjustment = ({ light: 8, moderate: 12, heavy: 8 })[
    context.rainBand
  ] ?? 0;
  const cloudAdjustment = context.cloudBand === "overcast" ? 4 : 0;
  const humidityAdjustment =
    context.humidityBand === "very_humid" ||
    context.humidityBand === "extremely_humid"
      ? 2
      : 0;
  const severeAdjustment = context.hasThunderstorm ? -15 : 0;
  const reasons = [];

  if (context.hasThunderstorm) {
    reasons.push(createReason("THUNDERSTORM", undefined, severeAdjustment));
  }

  const rainReasonCode = getRainReasonCode(context.rainBand, false);
  if (rainReasonCode && rainAdjustment !== 0) {
    reasons.push(createReason(rainReasonCode, weather?.rain1hMm, rainAdjustment));
  }

  addHumidityReason(reasons, weather, context, humidityAdjustment);
  addCloudReason(reasons, weather, context, cloudAdjustment);

  return finalizeActivity(
    "cafe-indoor-hangout",
    80 +
      rainAdjustment +
      cloudAdjustment +
      humidityAdjustment +
      severeAdjustment,
    reasons,
    context
  );
}

function evaluatePhotography(weather) {
  const context = createActivityContext(weather);
  const cloudAdjustment = ({
    partly_cloudy: 5,
    mostly_cloudy: 8,
    overcast: 5
  })[context.cloudBand] ?? 0;
  const rainAdjustment = ({ light: -5, moderate: -20, heavy: -40 })[
    context.rainBand
  ] ?? 0;
  const visibilityAdjustment = ({ reduced: -15, poor: -30, very_poor: -30 })[
    context.visibilityBand
  ] ?? 0;
  const goldenAdjustment =
    context.daytime === true &&
    context.rainBand === "none" &&
    (context.cloudBand === "clear" || context.cloudBand === "partly_cloudy")
      ? 8
      : 0;
  const reasons = [];

  addRainReason(reasons, weather, context, rainAdjustment);
  addVisibilityReason(reasons, weather, context, visibilityAdjustment);
  if (goldenAdjustment > 0) {
    reasons.push(createReason("DAYLIGHT_SUPPORTIVE", undefined, goldenAdjustment));
  }
  addCloudReason(reasons, weather, context, cloudAdjustment);

  return finalizeActivity(
    "photography",
    75 + cloudAdjustment + rainAdjustment + visibilityAdjustment + goldenAdjustment,
    reasons,
    context
  );
}

function evaluatePicnic(weather) {
  const context = createActivityContext(weather);
  const rainPenalty = ({ trace: 15, light: 35, moderate: 60, heavy: 85 })[
    context.rainBand
  ] ?? 0;
  const windPenalty = ({ strong: 20, very_strong: 40 })[
    context.windBand
  ] ?? 0;
  const humidityPenalty = context.humidityBand === "extremely_humid" ? 10 : 0;
  const visibilityPenalty = context.visibilityBand === "very_poor" ? 20 : 0;
  const reasons = [];

  addRainReason(reasons, weather, context, -rainPenalty);
  addVisibilityReason(reasons, weather, context, -visibilityPenalty);
  addWindReason(reasons, weather, context, -windPenalty);
  addHumidityReason(reasons, weather, context, -humidityPenalty);
  addOutdoorSupportReasons(reasons, weather, context);

  return finalizeActivity(
    "picnic",
    100 - rainPenalty - windPenalty - humidityPenalty - visibilityPenalty,
    reasons,
    context
  );
}

function evaluateLaundry(weather) {
  const context = createActivityContext(weather);
  const rainPenalty = ({ trace: 20, light: 45, moderate: 70, heavy: 90 })[
    context.rainBand
  ] ?? 0;
  const humidityPenalty = ({
    humid: 10,
    very_humid: 25,
    extremely_humid: 40
  })[context.humidityBand] ?? 0;
  const cloudPenalty = context.cloudBand === "overcast" ? 10 : 0;
  const windAdjustment = ({ light: 5, moderate: 8, strong: 0, very_strong: -15 })[
    context.windBand
  ] ?? 0;
  const reasons = [];

  addRainReason(reasons, weather, context, -rainPenalty);
  addWindReason(reasons, weather, context, windAdjustment);
  addHumidityReason(reasons, weather, context, -humidityPenalty);
  addCloudReason(reasons, weather, context, -cloudPenalty);

  return finalizeActivity(
    "laundry-drying-clothes",
    100 - rainPenalty - humidityPenalty - cloudPenalty + windAdjustment,
    reasons,
    context
  );
}

/**
 * Evaluates every in-scope activity independently.
 *
 * @param {object} weather
 * @returns {Array<object>}
 */
export function evaluateActivities(weather) {
  return [
    evaluateRunning(weather),
    evaluateWalking(weather),
    evaluateRiding(weather),
    evaluateOutdoorHangout(weather),
    evaluateCafe(weather),
    evaluatePhotography(weather),
    evaluatePicnic(weather),
    evaluateLaundry(weather)
  ];
}
