import {
  categorizeCloudCover,
  categorizeHumidity,
  categorizeRain,
  categorizeWind,
  createReason,
  getHumidityReasonCode,
  getRainReasonCode,
  getWindReasonCode,
  isDaytime,
  isThunderstorm
} from "./weatherClassification.js";

const PERSONALITIES = Object.freeze({
  chaoticSky: {
    id: "chaotic-sky",
    title: "The Chaotic Sky",
    description: "Stormy, intense conditions call for extra caution right now."
  },
  heavySky: {
    id: "heavy-sky",
    title: "The Heavy Sky",
    description: "Heavy current rainfall gives the area a weighty, rain-soaked mood."
  },
  cozyDrizzle: {
    id: "cozy-drizzle",
    title: "The Cozy Drizzle",
    description: "Light rain and gentle wind create a calm, drizzly atmosphere."
  },
  moodyBandung: {
    id: "moody-bandung",
    title: "The Moody Bandung",
    description: "An overcast sky gives the current scene a muted, moody character."
  },
  greyBlanket: {
    id: "grey-blanket",
    title: "The Grey Blanket",
    description: "Mostly cloudy conditions soften the sky across the area."
  },
  goldenBandung: {
    id: "golden-bandung",
    title: "The Golden Bandung",
    description: "Dry daylight and an open sky create a brighter Bandung mood."
  },
  quietNight: {
    id: "quiet-night",
    title: "The Quiet Night",
    description: "Nighttime and gentle wind give the area a subdued atmosphere."
  },
  windyBandung: {
    id: "windy-bandung",
    title: "The Windy Bandung",
    description: "Strong wind is the most distinctive part of the current weather."
  },
  humidHush: {
    id: "humid-hush",
    title: "The Humid Hush",
    description: "Very humid air and gentle wind create a still, heavy feeling."
  },
  calmSky: {
    id: "calm-sky",
    title: "The Calm Sky",
    description: "No single weather signal dominates the current conditions."
  }
});

/**
 * Calculates the descriptive Weather Mood using the documented priority order.
 *
 * @param {object} weather
 * @returns {{ level: "BRIGHT" | "CALM" | "COZY" | "HUMID" | "WET" | "MOODY" | "ROUGH", reasons: object[] }}
 */
export function calculateWeatherMood(weather) {
  const rainBand = categorizeRain(weather);
  const humidityBand = categorizeHumidity(weather);
  const windBand = categorizeWind(weather);
  const cloudBand = categorizeCloudCover(weather);
  const hasThunderstorm = isThunderstorm(weather);

  if (hasThunderstorm || windBand === "strong" || windBand === "very_strong") {
    return {
      level: "ROUGH",
      reasons: [
        hasThunderstorm
          ? createReason("THUNDERSTORM")
          : createReason(getWindReasonCode(windBand), weather?.windSpeedMps)
      ]
    };
  }

  if (rainBand === "moderate" || rainBand === "heavy") {
    return {
      level: "WET",
      reasons: [createReason(getRainReasonCode(rainBand), weather?.rain1hMm)]
    };
  }

  if (
    rainBand === "light" &&
    (windBand === "calm" || windBand === "light")
  ) {
    return {
      level: "COZY",
      reasons: [
        createReason("RAIN_LIGHT", weather?.rain1hMm),
        createReason(getWindReasonCode(windBand), weather?.windSpeedMps)
      ]
    };
  }

  if (humidityBand === "very_humid" || humidityBand === "extremely_humid") {
    return {
      level: "HUMID",
      reasons: [createReason(getHumidityReasonCode(humidityBand), weather?.humidityPct)]
    };
  }

  if (cloudBand === "overcast") {
    return {
      level: "MOODY",
      reasons: [createReason("CLOUD_OVERCAST", weather?.cloudCoverPct)]
    };
  }

  if (cloudBand === "clear" && windBand === "calm") {
    return {
      level: "BRIGHT",
      reasons: [
        createReason("CLOUD_CLEAR", weather?.cloudCoverPct),
        createReason("WIND_CALM", weather?.windSpeedMps)
      ]
    };
  }

  return {
    level: "CALM",
    reasons: [createReason("CURRENT_CONDITIONS")]
  };
}

/**
 * Chooses one deterministic editorial Weather Personality.
 *
 * @param {object} weather
 * @returns {{ id: string, title: string, description: string }}
 */
export function chooseWeatherPersonality(weather) {
  const rainBand = categorizeRain(weather);
  const windBand = categorizeWind(weather);
  const cloudBand = categorizeCloudCover(weather);
  const daytime = isDaytime(weather);
  const hasThunderstorm = isThunderstorm(weather);
  const isStrongWind = windBand === "strong" || windBand === "very_strong";
  const isGentleWind = windBand === "calm" || windBand === "light";
  const hasNoRain = rainBand === "none";

  if (hasThunderstorm || (rainBand === "heavy" && isStrongWind)) {
    return PERSONALITIES.chaoticSky;
  }

  if (rainBand === "heavy") return PERSONALITIES.heavySky;
  if (rainBand === "light" && isGentleWind) return PERSONALITIES.cozyDrizzle;
  if (cloudBand === "overcast" && hasNoRain) return PERSONALITIES.moodyBandung;
  if (cloudBand === "mostly_cloudy" && hasNoRain) {
    return PERSONALITIES.greyBlanket;
  }

  if (
    (cloudBand === "clear" || cloudBand === "partly_cloudy") &&
    daytime === true &&
    hasNoRain
  ) {
    return PERSONALITIES.goldenBandung;
  }

  if (daytime === false && isGentleWind && rainBand !== "heavy") {
    return PERSONALITIES.quietNight;
  }

  if (isStrongWind) return PERSONALITIES.windyBandung;

  if (
    Number.isFinite(weather?.humidityPct) &&
    weather.humidityPct > 85 &&
    hasNoRain &&
    isGentleWind
  ) {
    return PERSONALITIES.humidHush;
  }

  return PERSONALITIES.calmSky;
}
