import {
  formatLevel,
  formatScore,
  toStatusToken
} from "../utils/formatters.js";
import { renderEmptyState, renderErrorState } from "./errorState.js";
import { renderLoadingState } from "./loadingState.js";

const ACTIVITY_LABELS = Object.freeze({
  running: "Running",
  walking: "Walking",
  riding: "Riding",
  "outdoor-hangout": "Outdoor hangout",
  cafe: "Café / indoor hangout",
  photography: "Photography",
  picnic: "Picnic",
  laundry: "Laundry / drying clothes"
});

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function renderReasons(reasons) {
  const list = document.createElement("ul");
  list.className = "activity-reasons";

  for (const reason of (Array.isArray(reasons) ? reasons : []).slice(0, 2)) {
    if (typeof reason?.message !== "string") continue;
    list.append(createTextElement("li", "", reason.message));
  }

  return list;
}

/**
 * Renders prepared activity results as aligned, comparable rows.
 *
 * @param {HTMLElement} root
 * @param {object | null} districtState
 */
export function renderActivityCards(root, districtState) {
  if (!districtState) {
    renderEmptyState(root, {
      title: "Activity guidance needs a district",
      message: "Select a district to compare current activity recommendations."
    });
    return;
  }

  if (!districtState.insight) {
    if (districtState.status === "error") {
      renderErrorState(root, {
        title: "Activity guidance is unavailable",
        message: `${districtState.district.name} weather could not be prepared for activity guidance.`
      });
      return;
    }

    renderLoadingState(root, `Preparing ${districtState.district.name} activity guidance…`);
    return;
  }

  const activities = Array.isArray(districtState.insight.activities)
    ? [...districtState.insight.activities].sort((left, right) => right.score - left.score)
    : [];
  const list = document.createElement("ol");
  list.className = "activity-list";

  for (const activity of activities) {
    const item = document.createElement("li");
    item.className = "activity-item";

    const name = createTextElement(
      "p",
      "activity-name",
      ACTIVITY_LABELS[activity.id] ?? formatLevel(activity.id)
    );
    const chip = createTextElement("span", "status-chip", formatLevel(activity.level));
    chip.dataset.level = toStatusToken(activity.level);

    const score = document.createElement("p");
    score.className = "activity-score score-value";
    score.append(
      createTextElement("strong", "", formatScore(activity.score)),
      document.createTextNode(" score")
    );

    item.append(name, chip, score, renderReasons(activity.reasons));
    list.append(item);
  }

  root.replaceChildren(list);
}
