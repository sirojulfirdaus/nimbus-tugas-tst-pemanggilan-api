import {
  formatWeatherTime,
  getDaylightContext
} from "../utils/time.js";
import { renderEmptyState, renderErrorState } from "./errorState.js";
import { renderLoadingState } from "./loadingState.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function createSvgElement(tagName) {
  return document.createElementNS(SVG_NAMESPACE, tagName);
}

function getArcPoint(progress) {
  const start = { x: 14, y: 88 };
  const control = { x: 160, y: 4 };
  const end = { x: 306, y: 88 };
  const inverse = 1 - progress;

  return {
    x: (inverse ** 2 * start.x) + (2 * inverse * progress * control.x) + (progress ** 2 * end.x),
    y: (inverse ** 2 * start.y) + (2 * inverse * progress * control.y) + (progress ** 2 * end.y)
  };
}

function createJourneyGraphic(daylight) {
  const graphic = createSvgElement("svg");
  graphic.classList.add("sun-journey-graphic");
  graphic.setAttribute("viewBox", "0 0 320 104");
  graphic.setAttribute("role", "img");
  graphic.setAttribute("aria-label", daylight.progress === null
    ? `${daylight.phase === "unknown" ? "Daylight" : daylight.phase} context; progress unavailable.`
    : `Approximately ${Math.round(daylight.progress * 100)} percent through daylight at observation time.`
  );

  const arc = createSvgElement("path");
  arc.classList.add("sun-journey-arc");
  arc.setAttribute("d", "M14 88 Q160 4 306 88");

  const horizon = createSvgElement("line");
  horizon.classList.add("sun-journey-horizon");
  horizon.setAttribute("x1", "8");
  horizon.setAttribute("y1", "88");
  horizon.setAttribute("x2", "312");
  horizon.setAttribute("y2", "88");

  graphic.append(arc, horizon);

  if (daylight.progress !== null) {
    const position = getArcPoint(daylight.progress);
    const marker = createSvgElement("circle");
    marker.classList.add("sun-journey-marker");
    marker.setAttribute("cx", String(position.x));
    marker.setAttribute("cy", String(position.y));
    marker.setAttribute("r", "7");
    graphic.append(marker);
  }

  return graphic;
}

/**
 * Renders sunrise, sunset, and honest observation-time daylight context.
 * Daylight progress is omitted when the required timestamps are unavailable.
 *
 * @param {HTMLElement} root
 * @param {object | null} districtState
 */
export function renderSunJourney(root, districtState) {
  if (!districtState) {
    renderEmptyState(root, {
      title: "Choose a district",
      message: "Select a district to view its current daylight context."
    });
    return;
  }

  if (!districtState.weather) {
    if (districtState.status === "error") {
      renderErrorState(root, {
        title: "Daylight context is unavailable",
        message: `${districtState.district.name} has no usable sunrise or sunset context.`
      });
      return;
    }

    renderLoadingState(root, `Loading ${districtState.district.name} daylight context…`);
    return;
  }

  const weather = districtState.weather;
  const daylight = getDaylightContext(weather);
  const sunrise = formatWeatherTime(weather.sunriseUnix, weather.timezoneOffsetSec);
  const sunset = formatWeatherTime(weather.sunsetUnix, weather.timezoneOffsetSec);
  const observed = formatWeatherTime(weather.observedAt, weather.timezoneOffsetSec);

  const content = document.createElement("div");
  content.className = "sun-journey-content content-transition";
  content.dataset.phase = daylight.phase;
  content.append(createJourneyGraphic(daylight));

  const times = document.createElement("dl");
  times.className = "sun-times";
  for (const [label, value] of [["Sunrise", sunrise], ["Observed", observed], ["Sunset", sunset]]) {
    const row = document.createElement("div");
    row.append(
      createTextElement("dt", "", label),
      createTextElement("dd", "metric-value", value)
    );
    times.append(row);
  }

  const phaseText = daylight.phase === "day"
    ? "Daytime at the current observation."
    : daylight.phase === "night"
      ? "Nighttime at the current observation."
      : "Day or night context is unavailable.";
  const progressText = daylight.progress === null
    ? "Daylight progress is unavailable."
    : `Approximately ${Math.round(daylight.progress * 100)}% through the sunrise-to-sunset interval.`;

  content.append(
    times,
    createTextElement("p", "sun-journey-note supporting-copy", `${phaseText} ${progressText}`)
  );
  root.replaceChildren(content);
}
