import {
  formatCondition,
  formatLevel,
  formatTemperature
} from "../utils/formatters.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MAP_ASSET_PATH = "assets/maps/bandung-kecamatan.svg";
const MAP_VIEW_BOX = "0 0 1032 721.47";

let mapRoot = null;
let mapSvg = null;
let tooltip = null;
let tooltipDistrictId = null;
let districtElements = new Map();
let currentDistricts = {};

function createSvgElement(tagName) {
  return document.createElementNS(SVG_NAMESPACE, tagName);
}

function toMapReadiness(level) {
  const normalizedLevel = typeof level === "string" ? level.toLowerCase() : null;
  return ["excellent", "good", "fair", "low", "poor"].includes(
    normalizedLevel
  )
    ? normalizedLevel
    : "unknown";
}

function getDistrictVisualState(districtState) {
  if (
    districtState.status === "loading" ||
    districtState.status === "idle"
  ) {
    return { readiness: "loading", status: "loading" };
  }

  if (!districtState.weather || !districtState.insight) {
    return { readiness: "unknown", status: "error" };
  }

  return {
    readiness: toMapReadiness(
      districtState.insight.outdoorReadiness?.level
    ),
    status: districtState.stale ? "stale" : "ready"
  };
}

function getReadinessLabel(districtState) {
  const { readiness, status } = getDistrictVisualState(districtState);
  if (status === "loading") return "Loading";
  if (status === "error" || readiness === "unknown") return "No data";
  return formatLevel(readiness);
}

function getDistrictAriaLabel(districtState) {
  const name = districtState.district.name;
  const { status } = getDistrictVisualState(districtState);

  if (status === "loading") return `${name}. Weather data loading.`;
  if (status === "error") return `${name}. Weather unavailable.`;

  const details = [
    `${name}. Outdoor readiness ${getReadinessLabel(districtState)}.`
  ];

  if (Number.isFinite(districtState.weather?.temperatureC)) {
    details.push(`${Math.round(districtState.weather.temperatureC)} degrees Celsius.`);
  }
  if (districtState.stale) details.push("Cached weather may be outdated.");

  return details.join(" ");
}

function createTooltipContent(districtState) {
  const fragment = document.createDocumentFragment();
  const name = document.createElement("strong");
  name.textContent = districtState.district.name;
  fragment.append(name);

  const { status } = getDistrictVisualState(districtState);
  const condition = document.createElement("span");
  condition.className = "map-tooltip__condition";

  if (status === "loading") {
    condition.textContent = "Weather data loading";
  } else if (status === "error") {
    condition.textContent = "Weather unavailable";
  } else {
    const currentDetails = [];
    if (Number.isFinite(districtState.weather.temperatureC)) {
      currentDetails.push(formatTemperature(districtState.weather.temperatureC));
    }
    const rawCondition = districtState.weather.description ??
      districtState.weather.condition;
    if (typeof rawCondition === "string" && rawCondition.trim() !== "") {
      currentDetails.push(formatCondition(rawCondition));
    }
    condition.textContent = currentDetails.join(" · ");
  }
  if (condition.textContent) fragment.append(condition);

  const readiness = document.createElement("span");
  readiness.textContent = `Outdoor readiness: ${getReadinessLabel(districtState)}`;
  fragment.append(readiness);

  if (districtState.stale) {
    const stale = document.createElement("span");
    stale.className = "map-tooltip__stale";
    stale.textContent = "Cached weather · may be outdated";
    fragment.append(stale);
  }

  return fragment;
}

function positionTooltip(clientX, clientY) {
  if (!mapRoot || !tooltip) return;

  const rootBounds = mapRoot.getBoundingClientRect();
  const gap = 12;
  const proposedX = clientX - rootBounds.left + gap;
  const proposedY = clientY - rootBounds.top + gap;
  const maxX = Math.max(gap, rootBounds.width - tooltip.offsetWidth - gap);
  const maxY = Math.max(gap, rootBounds.height - tooltip.offsetHeight - gap);

  tooltip.style.left = `${Math.min(Math.max(gap, proposedX), maxX)}px`;
  tooltip.style.top = `${Math.min(Math.max(gap, proposedY), maxY)}px`;
}

function showTooltip(districtId, clientX, clientY) {
  const districtState = currentDistricts[districtId];
  if (!districtState || !tooltip) return;

  tooltip.replaceChildren(createTooltipContent(districtState));
  tooltipDistrictId = districtId;
  tooltip.hidden = false;
  positionTooltip(clientX, clientY);
}

function showFocusedTooltip(element, districtId) {
  const bounds = element.getBoundingClientRect();
  showTooltip(
    districtId,
    bounds.left + (bounds.width / 2),
    bounds.top + (bounds.height / 2)
  );
}

function hideTooltip() {
  if (tooltip) tooltip.hidden = true;
  tooltipDistrictId = null;
}

function bindDistrictInteraction(element, districtId, onSelect) {
  element.addEventListener("click", () => onSelect(districtId));
  element.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect(districtId);
  });
  element.addEventListener("pointerenter", event => {
    showTooltip(districtId, event.clientX, event.clientY);
  });
  element.addEventListener("pointermove", event => {
    positionTooltip(event.clientX, event.clientY);
  });
  element.addEventListener("pointerleave", hideTooltip);
  element.addEventListener("focus", () => {
    showFocusedTooltip(element, districtId);
  });
  element.addEventListener("blur", hideTooltip);
}

/**
 * Mounts all canonical Bandung district regions once using the local SVG asset.
 *
 * @param {{
 *   root: HTMLElement,
 *   districts: Record<string, object>,
 *   onSelect: (districtId: string) => void
 * }} options
 */
export function initializeWeatherMap({ root, districts, onSelect }) {
  mapRoot = root;
  currentDistricts = districts;
  districtElements = new Map();

  mapSvg = createSvgElement("svg");
  mapSvg.classList.add("bandung-map");
  mapSvg.setAttribute("viewBox", MAP_VIEW_BOX);
  mapSvg.setAttribute("role", "group");
  mapSvg.setAttribute("aria-labelledby", "bandung-map-title bandung-map-description");
  mapSvg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const title = createSvgElement("title");
  title.id = "bandung-map-title";
  title.textContent = "Bandung district weather readiness map";

  const description = createSvgElement("desc");
  description.id = "bandung-map-description";
  description.textContent =
    "Select a district to view current weather and recommendations. A textual district selector follows the map.";

  const regions = createSvgElement("g");
  regions.classList.add("bandung-map__regions");

  for (const districtState of Object.values(districts)) {
    const district = districtState.district;
    const region = createSvgElement("use");
    region.id = district.mapRegionId;
    region.classList.add("district");
    region.setAttribute("href", `${MAP_ASSET_PATH}#geometry-${district.id}`);
    region.setAttribute("data-district-id", district.id);
    region.setAttribute("role", "button");
    region.setAttribute("tabindex", "0");
    region.setAttribute("aria-pressed", "false");
    bindDistrictInteraction(region, district.id, onSelect);
    districtElements.set(district.id, region);
    regions.append(region);
  }

  tooltip = document.createElement("div");
  tooltip.className = "map-tooltip";
  tooltip.id = "bandung-map-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;

  mapSvg.append(title, description, regions);
  mapRoot.replaceChildren(mapSvg, tooltip);
}

/**
 * Updates visual and accessible state in place from prepared application state.
 *
 * @param {{ districts: Record<string, object>, selectedDistrictId: string | null }} viewState
 */
export function renderWeatherMap({ districts, selectedDistrictId }) {
  if (!mapSvg) return;
  currentDistricts = districts;
  const hasLoadingDistrict = Object.values(districts).some(
    districtState => districtState.status === "loading" || districtState.status === "idle"
  );
  mapSvg.setAttribute("aria-busy", String(hasLoadingDistrict));

  for (const [districtId, region] of districtElements) {
    const districtState = districts[districtId];
    if (!districtState) continue;

    const visualState = getDistrictVisualState(districtState);
    const isSelected = districtId === selectedDistrictId;
    region.dataset.readiness = visualState.readiness;
    region.dataset.status = visualState.status;
    region.dataset.selected = String(isSelected);
    region.setAttribute("aria-pressed", String(isSelected));
    region.setAttribute("aria-label", getDistrictAriaLabel(districtState));
  }

  if (tooltipDistrictId && !tooltip.hidden && districts[tooltipDistrictId]) {
    tooltip.replaceChildren(createTooltipContent(districts[tooltipDistrictId]));
  }
}
