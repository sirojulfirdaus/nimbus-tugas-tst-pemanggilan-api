import {
  formatWindDirection,
  formatWindSpeed
} from "../utils/formatters.js";
import { renderEmptyState, renderErrorState } from "./errorState.js";
import { renderLoadingState } from "./loadingState.js";

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function createCompass(directionDeg) {
  const compass = document.createElement("div");
  compass.className = "wind-compass-visual";

  const hasDirection = Number.isFinite(directionDeg);
  compass.dataset.available = String(hasDirection);
  compass.setAttribute("role", "img");
  compass.setAttribute(
    "aria-label",
    hasDirection
      ? `Wind direction ${formatWindDirection(directionDeg)}`
      : "Wind direction unavailable"
  );

  for (const [label, position] of [
    ["N", "north"],
    ["E", "east"],
    ["S", "south"],
    ["W", "west"]
  ]) {
    const marker = createTextElement("span", `wind-cardinal wind-cardinal--${position}`, label);
    marker.setAttribute("aria-hidden", "true");
    compass.append(marker);
  }

  const arrow = document.createElement("span");
  arrow.className = "wind-direction-arrow";
  arrow.setAttribute("aria-hidden", "true");
  if (hasDirection) {
    arrow.style.setProperty("--wind-direction", `${directionDeg}deg`);
  }
  compass.append(arrow);

  return compass;
}

/**
 * Renders current wind speed, direction, and gust without inventing missing
 * direction values.
 *
 * @param {HTMLElement} root
 * @param {object | null} districtState
 */
export function renderWindCompass(root, districtState) {
  if (!districtState) {
    renderEmptyState(root, {
      title: "Choose a district",
      message: "Select a district to view its current wind context."
    });
    return;
  }

  if (!districtState.weather) {
    if (districtState.status === "error") {
      renderErrorState(root, {
        title: "Wind is unavailable",
        message: `${districtState.district.name} has no usable current wind data.`
      });
      return;
    }

    renderLoadingState(root, `Loading ${districtState.district.name} wind…`);
    return;
  }

  const weather = districtState.weather;
  const content = document.createElement("div");
  content.className = "wind-compass-content content-transition";

  const readings = document.createElement("dl");
  readings.className = "wind-readings";
  const values = [
    ["Speed", formatWindSpeed(weather.windSpeedMps)],
    ["Direction", formatWindDirection(weather.windDirectionDeg)]
  ];
  if (Number.isFinite(weather.windGustMps)) {
    values.push(["Gust", formatWindSpeed(weather.windGustMps)]);
  }

  for (const [label, value] of values) {
    const row = document.createElement("div");
    row.append(
      createTextElement("dt", "", label),
      createTextElement("dd", "metric-value", value)
    );
    readings.append(row);
  }

  content.append(createCompass(weather.windDirectionDeg), readings);
  root.replaceChildren(content);
}
