import { evaluateActivities } from "./activityAdvisor.js";
import { calculateComfortIndex } from "./comfortIndex.js";
import { calculateMobilityMood } from "./mobilityMood.js";
import { calculateOutdoorReadiness } from "./outdoorReadiness.js";
import { buildPreparationChecklist } from "./preparationAdvisor.js";
import { evaluateTravelDecision } from "./travelDecision.js";
import {
  calculateWeatherMood,
  chooseWeatherPersonality
} from "./weatherPersonality.js";
import { buildWeatherStory } from "./weatherStory.js";

/**
 * Transforms one NormalizedWeather object into the complete deterministic
 * NIMBUS insight model.
 *
 * @param {object} weather
 * @returns {{
 *   outdoorReadiness: object,
 *   comfort: object,
 *   mobility: object,
 *   weatherMood: object,
 *   personality: object,
 *   activities: object[],
 *   travelDecision: object,
 *   preparation: object[],
 *   story: string
 * }}
 */
export function createNimbusInsight(weather) {
  const outdoorReadiness = calculateOutdoorReadiness(weather);
  const comfort = calculateComfortIndex(weather);
  const mobility = calculateMobilityMood(weather);

  return {
    outdoorReadiness,
    comfort,
    mobility,
    weatherMood: calculateWeatherMood(weather),
    personality: chooseWeatherPersonality(weather),
    activities: evaluateActivities(weather),
    travelDecision: evaluateTravelDecision(
      weather,
      outdoorReadiness,
      mobility
    ),
    preparation: buildPreparationChecklist(weather),
    story: buildWeatherStory(weather)
  };
}
