import {
  formatCondition,
  formatLevel,
  formatScore,
  formatTemperature,
  toStatusToken
} from "../utils/formatters.js";
import { formatWeatherTime } from "../utils/time.js";
import { renderErrorState } from "./errorState.js";
import { renderLoadingState } from "./loadingState.js";

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function createStatusChip(level) {
  const chip = createTextElement("span", "status-chip", formatLevel(level));
  chip.dataset.level = toStatusToken(level);
  return chip;
}

function createSummary(label, value, level = null) {
  const container = document.createElement("div");
  container.append(createTextElement("p", "summary-label", label));

  if (level) {
    container.append(createStatusChip(level));
  } else {
    container.append(createTextElement("p", "summary-value", value));
  }

  return container;
}

function getFreshnessText(cityState) {
  const observedTime = formatWeatherTime(
    cityState.weather?.observedAt,
    cityState.weather?.timezoneOffsetSec
  );
  const observationCopy = observedTime === "Unavailable"
    ? "Observation time unavailable"
    : `Observed at ${observedTime} local time`;

  if (cityState.stale) {
    return `Cached weather · may be outdated · ${observationCopy}`;
  }

  if (cityState.source === "cache") {
    return `Cached weather within the refresh window · ${observationCopy}`;
  }

  return observationCopy;
}

/**
 * Renders the prepared Bandung city state without retrieving or interpreting it.
 *
 * @param {HTMLElement} root
 * @param {object} cityState
 */
export function renderHero(root, cityState) {
  if (!cityState?.weather || !cityState?.insight) {
    if (cityState?.status === "error") {
      renderErrorState(root, {
        title: "Bandung weather is unavailable",
        message: "District weather may still be available below. You can also try refreshing."
      });
      return;
    }

    renderLoadingState(root, "Loading Bandung's current weather…");
    return;
  }

  const { weather, insight } = cityState;
  const content = document.createElement("div");
  content.className = "hero-content content-transition";

  const primary = document.createElement("div");
  primary.className = "hero-primary";
  primary.append(
    createTextElement("p", "hero-location", "Bandung, Indonesia"),
    createTextElement("p", "hero-temperature temperature", formatTemperature(weather.temperatureC)),
    createTextElement(
      "p",
      "hero-condition",
      formatCondition(weather.description ?? weather.condition)
    ),
    createTextElement(
      "p",
      "hero-feels-like",
      `Feels like ${formatTemperature(weather.feelsLikeC)}`
    )
  );

  const freshness = createTextElement(
    "p",
    "freshness-note",
    getFreshnessText(cityState)
  );
  if (cityState.stale) freshness.dataset.state = "stale";
  primary.append(freshness);

  const decision = document.createElement("div");
  decision.className = "hero-decision";

  const summaryGrid = document.createElement("div");
  summaryGrid.className = "hero-decision-grid";
  summaryGrid.append(
    createSummary(
      "Outdoor readiness",
      formatScore(insight.outdoorReadiness?.score),
      insight.outdoorReadiness?.level
    ),
    createSummary("Mobility mood", "", insight.mobility?.level)
  );

  const readinessScore = createTextElement(
    "p",
    "summary-value score-value",
    formatScore(insight.outdoorReadiness?.score)
  );
  readinessScore.setAttribute("aria-label", `Outdoor readiness ${readinessScore.textContent}`);
  summaryGrid.firstElementChild.append(readinessScore);

  const travel = insight.travelDecision;
  decision.append(
    summaryGrid,
    createTextElement("p", "summary-label", "Practical decision"),
    createTextElement("h3", "decision-title", travel?.title ?? "Decision unavailable"),
    createTextElement(
      "p",
      "decision-advice",
      travel?.advice ?? "Current decision guidance is unavailable."
    )
  );

  if (insight.personality) {
    const personality = document.createElement("div");
    personality.className = "city-personality";
    personality.append(
      createTextElement("p", "summary-label", "Bandung weather personality"),
      createTextElement("h3", "", insight.personality.title),
      createTextElement("p", "", insight.personality.description)
    );
    decision.append(personality);
  }

  content.append(primary, decision);
  root.replaceChildren(content);
}
