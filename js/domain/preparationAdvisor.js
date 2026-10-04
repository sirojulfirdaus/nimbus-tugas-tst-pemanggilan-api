import {
  categorizeCloudCover,
  categorizeHumidity,
  categorizeRain,
  categorizeWind,
  createReason,
  getCloudReasonCode,
  getFeelsLikeTemperature,
  getHumidityReasonCode,
  getRainReasonCode,
  getWindReasonCode,
  isDaytime,
  isThunderstorm
} from "./weatherClassification.js";

function createItem(id, label, status, reasons) {
  return {
    id,
    label,
    status,
    reasons: reasons.length > 0 ? reasons : [createReason("CURRENT_CONDITIONS")]
  };
}

/**
 * Builds deterministic preparation guidance from normalized current weather.
 *
 * @param {object} weather
 * @returns {Array<{
 *   id: string,
 *   label: string,
 *   status: "recommended" | "optional" | "probably_unnecessary",
 *   reasons: object[]
 * }>}
 */
export function buildPreparationChecklist(weather) {
  const rainBand = categorizeRain(weather);
  const windBand = categorizeWind(weather);
  const cloudBand = categorizeCloudCover(weather);
  const humidityBand = categorizeHumidity(weather);
  const temperature = getFeelsLikeTemperature(weather);
  const daytime = isDaytime(weather);
  const hasRain =
    isThunderstorm(weather) ||
    (rainBand !== null && rainBand !== "none");
  const rainReasonCode = getRainReasonCode(rainBand, isThunderstorm(weather));
  const rainReasons = rainReasonCode
    ? [createReason(rainReasonCode, weather?.rain1hMm)]
    : [];
  const items = [];

  items.push(
    createItem(
      "umbrella",
      "Umbrella",
      hasRain
        ? "recommended"
        : rainBand === "none"
          ? "probably_unnecessary"
          : "optional",
      rainReasons
    )
  );

  const needsRainJacket =
    rainBand === "moderate" ||
    rainBand === "heavy" ||
    (hasRain && ["moderate", "strong", "very_strong"].includes(windBand));
  const jacketReasons = [...rainReasons];
  if (needsRainJacket && windBand) {
    jacketReasons.push(createReason(getWindReasonCode(windBand), weather?.windSpeedMps));
  }
  items.push(
    createItem(
      "rain-jacket",
      "Rain jacket",
      needsRainJacket
        ? "recommended"
        : hasRain
          ? "optional"
          : rainBand === "none"
            ? "probably_unnecessary"
            : "optional",
      jacketReasons
    )
  );

  items.push(
    createItem(
      "bag-protection",
      "Waterproof bag protection",
      hasRain
        ? "recommended"
        : rainBand === "none"
          ? "probably_unnecessary"
          : "optional",
      rainReasons
    )
  );

  const needsLightJacket =
    temperature !== null &&
    (temperature < 22 ||
      (["moderate", "strong", "very_strong"].includes(windBand) &&
        temperature < 25));
  const lightJacketReasons = [];
  if (temperature !== null && temperature < 22) {
    lightJacketReasons.push(
      createReason("TEMP_COOL", temperature)
    );
  } else if (
    temperature !== null &&
    temperature < 25 &&
    ["moderate", "strong", "very_strong"].includes(windBand)
  ) {
    lightJacketReasons.push(createReason("TEMP_MILD", temperature));
  }
  if (["moderate", "strong", "very_strong"].includes(windBand)) {
    lightJacketReasons.push(
      createReason(getWindReasonCode(windBand), weather?.windSpeedMps)
    );
  }
  items.push(
    createItem(
      "light-jacket",
      "Light jacket",
      needsLightJacket
        ? "recommended"
        : temperature === null
          ? "optional"
          : "probably_unnecessary",
      lightJacketReasons
    )
  );

  const sunglassesRecommended =
    daytime === true &&
    rainBand === "none" &&
    Number.isFinite(weather?.cloudCoverPct) &&
    weather.cloudCoverPct <= 40;
  items.push(
    createItem(
      "sunglasses",
      "Sunglasses",
      sunglassesRecommended
        ? "recommended"
        : daytime === false || hasRain
          ? "probably_unnecessary"
          : "optional",
      cloudBand
        ? [createReason(getCloudReasonCode(cloudBand), weather?.cloudCoverPct)]
        : []
    )
  );

  const sunscreenRecommended =
    daytime === true &&
    rainBand === "none" &&
    Number.isFinite(weather?.cloudCoverPct) &&
    weather.cloudCoverPct <= 50;
  items.push(
    createItem(
      "sunscreen",
      "Sunscreen",
      sunscreenRecommended
        ? "recommended"
        : daytime === false || hasRain
          ? "probably_unnecessary"
          : "optional",
      cloudBand
        ? [createReason(getCloudReasonCode(cloudBand), weather?.cloudCoverPct)]
        : []
    )
  );

  const waterRecommended =
    (temperature !== null && temperature >= 28) ||
    (Number.isFinite(weather?.humidityPct) && weather.humidityPct >= 80);
  const waterSignalsKnown =
    temperature !== null && Number.isFinite(weather?.humidityPct);
  const waterReasons = [];
  if (temperature !== null && temperature >= 28) {
    waterReasons.push(
      createReason(temperature >= 32 ? "TEMP_HOT" : "TEMP_WARM", temperature)
    );
  }
  if (Number.isFinite(weather?.humidityPct) && weather.humidityPct >= 80) {
    waterReasons.push(
      createReason(getHumidityReasonCode(humidityBand), weather.humidityPct)
    );
  }
  items.push(
    createItem(
      "drinking-water",
      "Drinking water",
      waterRecommended
        ? "recommended"
        : waterSignalsKnown
          ? "probably_unnecessary"
          : "optional",
      waterReasons
    )
  );

  return items;
}
