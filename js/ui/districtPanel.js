import {
  formatCondition,
  formatLevel,
  formatScore,
  formatTemperature,
  toStatusToken
} from "../utils/formatters.js";
import { formatWeatherTime } from "../utils/time.js";
import { renderEmptyState, renderErrorState } from "./errorState.js";
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

function createReasonList(reasons) {
  const list = document.createElement("ul");
  list.className = "reason-list";

  for (const reason of (Array.isArray(reasons) ? reasons : []).slice(0, 3)) {
    if (typeof reason?.message !== "string") continue;
    list.append(createTextElement("li", "", reason.message));
  }

  return list;
}

function createPulseList(insight) {
  const list = document.createElement("dl");
  list.className = "pulse-list";
  const items = [
    ["Comfort index", `${formatLevel(insight.comfort?.level)} · ${formatScore(insight.comfort?.score)}`],
    ["Mobility mood", formatLevel(insight.mobility?.level)],
    ["Weather mood", formatLevel(insight.weatherMood?.level)]
  ];

  for (const [label, value] of items) {
    const row = document.createElement("div");
    row.append(
      createTextElement("dt", "", label),
      createTextElement("dd", "", value)
    );
    list.append(row);
  }

  return list;
}

/**
 * Renders the selected district's prepared weather and insight state.
 *
 * @param {HTMLElement} root
 * @param {object | null} districtState
 */
export function renderDistrictPanel(root, districtState) {
  if (!districtState) {
    renderEmptyState(root, {
      title: "Choose a district",
      message: "Select a district to view its current local weather and NIMBUS guidance."
    });
    return;
  }

  const districtName = districtState.district.name;
  if (!districtState.weather || !districtState.insight) {
    if (districtState.status === "error") {
      renderErrorState(root, {
        title: `${districtName} weather is unavailable`,
        message: "Choose another district or refresh the current weather."
      });
      return;
    }

    renderLoadingState(root, `Loading ${districtName} weather…`);
    return;
  }

  const { weather, insight } = districtState;
  const article = document.createElement("article");
  article.className = "district-summary content-transition";

  const headingRow = document.createElement("div");
  headingRow.className = "district-heading-row";
  headingRow.append(
    createTextElement("h3", "", `${districtName} right now`),
    districtState.stale ? createStatusChip("stale") : document.createTextNode("")
  );

  const conditionRow = document.createElement("div");
  conditionRow.className = "district-condition-row";
  const condition = document.createElement("div");
  condition.append(
    createTextElement(
      "p",
      "district-temperature temperature",
      formatTemperature(weather.temperatureC)
    ),
    createTextElement(
      "p",
      "district-condition",
      formatCondition(weather.description ?? weather.condition)
    ),
    createTextElement(
      "p",
      "supporting-copy",
      `Feels like ${formatTemperature(weather.feelsLikeC)}`
    )
  );
  conditionRow.append(condition);

  const observedAt = formatWeatherTime(weather.observedAt, weather.timezoneOffsetSec);
  const freshness = document.createElement("div");
  freshness.className = "freshness-row";
  freshness.append(createTextElement(
    "span",
    "supporting-copy",
    observedAt === "Unavailable" ? "Observation time unavailable" : `Observed ${observedAt} local`
  ));
  if (districtState.stale) {
    freshness.append(createTextElement("span", "supporting-copy", "Cached · may be outdated"));
  }

  const readiness = document.createElement("div");
  readiness.className = "readiness-block";
  const readinessRow = document.createElement("div");
  readinessRow.className = "readiness-row";
  const readinessLabel = document.createElement("div");
  readinessLabel.append(
    createTextElement("p", "summary-label", "Outdoor readiness"),
    createStatusChip(insight.outdoorReadiness?.level)
  );
  const readinessScore = document.createElement("div");
  readinessScore.className = "readiness-score";
  readinessScore.append(
    createTextElement("strong", "score-value", formatScore(insight.outdoorReadiness?.score)),
    createTextElement("span", "supporting-copy", "NIMBUS interpretation")
  );
  readinessRow.append(readinessLabel, readinessScore);
  readiness.append(readinessRow, createReasonList(insight.outdoorReadiness?.reasons));

  const travel = document.createElement("div");
  travel.className = "travel-decision";
  travel.append(
    createTextElement("p", "summary-label", `Should I go to ${districtName}?`),
    createTextElement("h4", "", insight.travelDecision?.title ?? "Decision unavailable"),
    createTextElement(
      "p",
      "",
      insight.travelDecision?.advice ?? "Current guidance is unavailable."
    ),
    createReasonList(insight.travelDecision?.reasons)
  );

  const personality = document.createElement("div");
  personality.className = "personality-compact";
  personality.append(
    createTextElement("p", "summary-label", "Weather personality"),
    createTextElement(
      "p",
      "",
      insight.personality?.title ?? "Personality unavailable"
    )
  );

  article.append(
    headingRow,
    conditionRow,
    freshness,
    readiness,
    createPulseList(insight),
    travel,
    personality
  );
  root.replaceChildren(article);
}
