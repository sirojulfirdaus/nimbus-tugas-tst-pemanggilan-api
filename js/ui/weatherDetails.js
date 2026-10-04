import {
  formatPercentage,
  formatPressure,
  formatRainfall,
  formatVisibility
} from "../utils/formatters.js";
import { renderEmptyState, renderErrorState } from "./errorState.js";
import { renderLoadingState } from "./loadingState.js";

function createMetric(label, value) {
  const row = document.createElement("div");
  row.className = "weather-metric";

  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  row.append(term, description);
  return row;
}

function createMetricGroup(title, metrics) {
  const section = document.createElement("section");
  section.className = "weather-metric-group";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const list = document.createElement("dl");
  list.className = "weather-metrics";
  for (const [label, value] of metrics) {
    list.append(createMetric(label, value));
  }

  section.append(heading, list);
  return section;
}

/**
 * Renders normalized current measurements without converting null to zero.
 *
 * @param {HTMLElement} root
 * @param {object | null} districtState
 */
export function renderWeatherDetails(root, districtState) {
  if (!districtState) {
    renderEmptyState(root, {
      title: "No district selected",
      message: "Choose a district to inspect its current weather measurements."
    });
    return;
  }

  if (!districtState.weather) {
    if (districtState.status === "error") {
      renderErrorState(root, {
        title: "Weather details are unavailable",
        message: `${districtState.district.name} has no usable current measurements.`
      });
      return;
    }

    renderLoadingState(root, `Loading ${districtState.district.name} measurements…`);
    return;
  }

  const weather = districtState.weather;
  const groups = document.createElement("div");
  groups.className = "weather-metric-groups content-transition";
  groups.append(
    createMetricGroup("Atmosphere", [
      ["Humidity", formatPercentage(weather.humidityPct)],
      ["Pressure", formatPressure(weather.pressureHpa)],
      ["Cloud cover", formatPercentage(weather.cloudCoverPct)]
    ]),
    createMetricGroup("Visibility and precipitation", [
      ["Visibility", formatVisibility(weather.visibilityM)],
      ["Rain in the last hour", formatRainfall(weather.rain1hMm)]
    ])
  );

  root.replaceChildren(groups);
}
