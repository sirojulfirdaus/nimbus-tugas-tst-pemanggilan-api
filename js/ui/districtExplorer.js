let districtSelector = null;
let availabilityRoot = null;

/**
 * Initializes the stable textual district selector once.
 *
 * @param {{
 *   selector: HTMLSelectElement,
 *   availability: HTMLElement,
 *   districts: object[],
 *   onSelect: (districtId: string) => void
 * }} options
 */
export function initializeDistrictExplorer({
  selector,
  availability,
  districts,
  onSelect
}) {
  districtSelector = selector;
  availabilityRoot = availability;

  const optionsFragment = document.createDocumentFragment();
  for (const districtState of districts) {
    const option = document.createElement("option");
    option.value = districtState.district.id;
    option.textContent = districtState.district.name;
    optionsFragment.append(option);
  }
  districtSelector.append(optionsFragment);

  districtSelector.addEventListener("change", event => {
    const districtId = event.currentTarget.value;
    if (districtId) onSelect(districtId);
  });
}

/**
 * Updates district availability and selection without rebuilding the selector.
 *
 * @param {{ districts: Record<string, object>, selectedDistrictId: string | null }} viewState
 */
export function renderDistrictExplorer({ districts, selectedDistrictId }) {
  if (!districtSelector || !availabilityRoot) return;

  const districtStates = Object.values(districts);
  const usableCount = districtStates.filter(
    districtState => districtState.status === "ready" || districtState.status === "stale"
  ).length;
  const loadingCount = districtStates.filter(
    districtState => districtState.status === "loading" || districtState.status === "idle"
  ).length;
  const errorCount = districtStates.filter(
    districtState => districtState.status === "error"
  ).length;

  if (districtSelector.value !== (selectedDistrictId ?? "")) {
    districtSelector.value = selectedDistrictId ?? "";
  }

  if (loadingCount > 0) {
    availabilityRoot.textContent = `Loading current weather for ${loadingCount} districts…`;
  } else if (errorCount > 0) {
    availabilityRoot.textContent = `${usableCount} districts available · ${errorCount} temporarily unavailable.`;
  } else {
    availabilityRoot.textContent = `Current weather is available for all ${usableCount} districts.`;
  }

}
