import { toStatusToken } from "../utils/formatters.js";
import {
  formatApplicationTime,
  getDaylightContext
} from "../utils/time.js";
import { renderActivityCards } from "./activityCards.js";
import {
  initializeDistrictExplorer,
  renderDistrictExplorer
} from "./districtExplorer.js";
import { renderDistrictPanel } from "./districtPanel.js";
import { renderErrorState } from "./errorState.js";
import { renderHero } from "./hero.js";
import {
  renderPreparation,
  renderWeatherStory
} from "./preparationStory.js";
import { renderWeatherDetails } from "./weatherDetails.js";
import { initializeWeatherMap, renderWeatherMap } from "./weatherMap.js";
import { renderSunJourney } from "./sunJourney.js";
import { renderWindCompass } from "./windCompass.js";

let roots = null;
let refreshAction = null;

function getUsableDistrictCount(districts) {
  return Object.values(districts).filter(
    district => district.status === "ready" || district.status === "stale"
  ).length;
}

function renderWeatherAmbience(state, selectedDistrict) {
  const activeLocation = selectedDistrict?.weather && selectedDistrict?.insight
    ? selectedDistrict
    : state.city;
  const mood = toStatusToken(activeLocation?.insight?.weatherMood?.level);
  const daylight = getDaylightContext(activeLocation?.weather);

  document.body.dataset.weatherMood = mood === "unknown" ? "neutral" : mood;
  document.body.dataset.time = daylight.phase;
}

function getStatusMessage(state) {
  const districts = Object.values(state.districts);
  const usableDistrictCount = getUsableDistrictCount(state.districts);
  const errorCount = districts.filter(district => district.status === "error").length;
  const hasUsableCity = state.city.status === "ready" || state.city.status === "stale";
  const hasStaleData = state.city.stale || districts.some(district => district.stale);
  const hasUsableData = hasUsableCity || usableDistrictCount > 0;

  if (state.refresh.status === "loading") {
    return hasUsableData ? "Refreshing current weather…" : "Loading current weather…";
  }

  if (!hasUsableData && state.refresh.status === "error") {
    return "Current weather is unavailable. Try refreshing the weather data.";
  }

  if (hasStaleData) {
    return errorCount > 0
      ? "Using cached weather. Some district weather is unavailable."
      : "Using cached weather. Some information may be outdated.";
  }

  if (errorCount > 0 || state.city.status === "error") {
    return "Some current weather is unavailable; available locations remain usable.";
  }

  if (Number.isFinite(state.refresh.lastSuccessfulAt)) {
    return `Weather updated at ${formatApplicationTime(state.refresh.lastSuccessfulAt)}.`;
  }

  if (hasUsableData) return "Current weather loaded.";
  return "Preparing current weather…";
}

function renderRefreshControl(state) {
  const isLoading = state.refresh.status === "loading";
  const hasUsableData = state.city.weather != null ||
    Object.values(state.districts).some(district => district.weather != null);

  roots.refreshButton.disabled = isLoading;
  roots.refreshButton.setAttribute("aria-busy", String(isLoading));
  roots.refreshButton.textContent = isLoading
    ? (hasUsableData ? "Refreshing…" : "Loading weather…")
    : "Refresh weather";
  roots.appStatus.textContent = getStatusMessage(state);
}

function renderGlobalFailure(state) {
  const hasUsableCity = state.city.weather != null;
  const usableDistrictCount = getUsableDistrictCount(state.districts);
  const isCompleteFailure = state.refresh.status === "error" &&
    !hasUsableCity && usableDistrictCount === 0;

  if (!isCompleteFailure) {
    roots.globalState.hidden = true;
    roots.globalState.replaceChildren();
    return;
  }

  roots.globalState.hidden = false;
  renderErrorState(roots.globalState, {
    title: "Current weather is unavailable",
    message: "NIMBUS could not load usable Bandung weather. Try the request again.",
    headingLevel: "h2",
    onRetry: () => {
      if (refreshAction) void refreshAction();
    }
  });
}

/**
 * Initializes stable controls and their application actions once.
 *
 * @param {{
 *   state: object,
 *   onRefresh: () => Promise<object>,
 *   onSelectDistrict: (districtId: string) => object
 * }} options
 */
export function initializeAppView({ state, onRefresh, onSelectDistrict }) {
  roots = {
    refreshButton: document.getElementById("refresh-weather"),
    appStatus: document.getElementById("app-status"),
    globalState: document.getElementById("global-state-root"),
    hero: document.getElementById("hero-root"),
    weatherMap: document.getElementById("bandung-map-root"),
    districtPanel: document.getElementById("district-panel-root"),
    activities: document.getElementById("activity-root"),
    preparation: document.getElementById("preparation-root"),
    weatherDetails: document.getElementById("weather-details-root"),
    windCompass: document.getElementById("wind-compass-root"),
    sunJourney: document.getElementById("sun-journey-root"),
    weatherStory: document.getElementById("personality-story-root")
  };
  refreshAction = onRefresh;

  roots.refreshButton.addEventListener("click", () => {
    void onRefresh();
  });

  initializeDistrictExplorer({
    selector: document.getElementById("district-selector"),
    availability: document.getElementById("district-availability"),
    districts: Object.values(state.districts),
    onSelect: onSelectDistrict
  });
  initializeWeatherMap({
    root: roots.weatherMap,
    districts: state.districts,
    onSelect: onSelectDistrict
  });
}

/**
 * Coordinates targeted rendering from one application-store subscription.
 *
 * @param {object} state
 */
export function renderApp(state) {
  if (!roots) return;

  const selectedDistrict = state.selectedDistrictId
    ? state.districts[state.selectedDistrictId]
    : null;

  renderRefreshControl(state);
  renderGlobalFailure(state);
  renderWeatherAmbience(state, selectedDistrict);
  renderHero(roots.hero, state.city);
  renderDistrictExplorer({
    districts: state.districts,
    selectedDistrictId: state.selectedDistrictId
  });
  renderWeatherMap({
    districts: state.districts,
    selectedDistrictId: state.selectedDistrictId
  });
  renderDistrictPanel(roots.districtPanel, selectedDistrict);
  renderActivityCards(roots.activities, selectedDistrict);
  renderPreparation(roots.preparation, selectedDistrict);
  renderWeatherDetails(roots.weatherDetails, selectedDistrict);
  renderWindCompass(roots.windCompass, selectedDistrict);
  renderSunJourney(roots.sunJourney, selectedDistrict);
  renderWeatherStory(roots.weatherStory, selectedDistrict);
}
