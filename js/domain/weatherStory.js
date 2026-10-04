import {
  categorizeCloudCover,
  categorizeHumidity,
  categorizeRain,
  categorizeVisibility,
  categorizeWind,
  isThunderstorm
} from "./weatherClassification.js";

function joinPhrases(phrases) {
  if (phrases.length === 0) return "";
  if (phrases.length === 1) return phrases[0];
  return `${phrases.slice(0, -1).join(", ")} and ${phrases.at(-1)}`;
}

function getConditionPhrase(weather, rainBand) {
  if (isThunderstorm(weather)) return "a thunderstorm";

  const rainPhrases = {
    trace: "trace rainfall",
    light: "light rain",
    moderate: "moderate rain",
    heavy: "heavy rain"
  };

  if (rainPhrases[rainBand]) return rainPhrases[rainBand];

  if (typeof weather?.description === "string" && weather.description.trim() !== "") {
    return weather.description.toLowerCase();
  }

  if (typeof weather?.condition === "string" && weather.condition.trim() !== "") {
    return `${weather.condition.toLowerCase()} conditions`;
  }

  return "partially available weather information";
}

/**
 * Builds a deterministic current-weather narrative of no more than two
 * sentences.
 *
 * @param {object} weather
 * @returns {string}
 */
export function buildWeatherStory(weather) {
  const location =
    typeof weather?.locationName === "string" && weather.locationName.trim() !== ""
      ? weather.locationName.trim()
      : "This area";
  const rainBand = categorizeRain(weather);
  const cloudBand = categorizeCloudCover(weather);
  const humidityBand = categorizeHumidity(weather);
  const windBand = categorizeWind(weather);
  const visibilityBand = categorizeVisibility(weather);
  const atmosphericPhrases = [];

  if (cloudBand === "overcast") atmosphericPhrases.push("an overcast sky");
  else if (cloudBand === "mostly_cloudy") {
    atmosphericPhrases.push("mostly cloudy skies");
  }

  if (humidityBand === "humid") atmosphericPhrases.push("humid air");
  else if (humidityBand === "very_humid") {
    atmosphericPhrases.push("very humid air");
  } else if (humidityBand === "extremely_humid") {
    atmosphericPhrases.push("extremely humid air");
  }

  const firstSentence = `${location} is currently experiencing ${getConditionPhrase(
    weather,
    rainBand
  )}${
    atmosphericPhrases.length > 0
      ? ` with ${joinPhrases(atmosphericPhrases)}`
      : ""
  }.`;
  const mobilityPhrases = [];

  const windPhrases = {
    calm: "Winds are calm",
    light: "Winds are light",
    moderate: "Winds are moderate",
    strong: "Winds are strong",
    very_strong: "Winds are very strong"
  };
  const visibilityPhrases = {
    excellent: "visibility is excellent",
    good: "visibility remains good",
    reduced: "visibility is reduced",
    poor: "visibility is poor",
    very_poor: "visibility is very poor"
  };

  if (windPhrases[windBand]) mobilityPhrases.push(windPhrases[windBand]);
  if (visibilityPhrases[visibilityBand]) {
    const visibilityPhrase = visibilityPhrases[visibilityBand];
    mobilityPhrases.push(
      mobilityPhrases.length === 0
        ? `${visibilityPhrase[0].toUpperCase()}${visibilityPhrase.slice(1)}`
        : visibilityPhrase
    );
  }

  if (mobilityPhrases.length === 0) return firstSentence;
  return `${firstSentence} ${joinPhrases(mobilityPhrases)}.`;
}
