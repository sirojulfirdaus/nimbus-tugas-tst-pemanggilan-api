import { formatLevel, toStatusToken } from "../utils/formatters.js";
import { renderEmptyState, renderErrorState } from "./errorState.js";
import { renderLoadingState } from "./loadingState.js";

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

/**
 * Renders the existing deterministic preparation checklist.
 *
 * @param {HTMLElement} root
 * @param {object | null} districtState
 */
export function renderPreparation(root, districtState) {
  if (!districtState) {
    renderEmptyState(root, {
      title: "Preparation depends on your district",
      message: "Choose a district to see what may be useful right now."
    });
    return;
  }

  if (!districtState.insight) {
    if (districtState.status === "error") {
      renderErrorState(root, {
        title: "Preparation advice is unavailable",
        message: `${districtState.district.name} weather is unavailable right now.`
      });
      return;
    }

    renderLoadingState(root, `Preparing advice for ${districtState.district.name}…`);
    return;
  }

  const list = document.createElement("ul");
  list.className = "preparation-list";

  for (const preparation of districtState.insight.preparation ?? []) {
    const item = document.createElement("li");
    item.className = "preparation-item";
    item.dataset.status = toStatusToken(preparation.status);
    const row = document.createElement("div");
    row.className = "preparation-row";
    const chip = createTextElement(
      "span",
      "status-chip",
      formatLevel(preparation.status)
    );
    chip.dataset.level = toStatusToken(preparation.status);

    row.append(
      createTextElement("p", "preparation-name", preparation.label),
      chip
    );
    item.append(row);

    const reason = preparation.reasons?.find(
      candidate => typeof candidate?.message === "string"
    );
    if (reason) {
      item.append(createTextElement("p", "preparation-reason", reason.message));
    }

    list.append(item);
  }

  root.replaceChildren(list);
}

/**
 * Renders the prepared Weather Personality and current-weather story.
 *
 * @param {HTMLElement} root
 * @param {object | null} districtState
 */
export function renderWeatherStory(root, districtState) {
  if (!districtState) {
    renderEmptyState(root, {
      title: "Choose a district",
      message: "Select a district to read its current weather personality and story."
    });
    return;
  }

  if (!districtState.insight) {
    if (districtState.status === "error") {
      renderErrorState(root, {
        title: "Weather story is unavailable",
        message: `${districtState.district.name} does not have usable current weather data.`
      });
      return;
    }

    renderLoadingState(root, `Writing ${districtState.district.name}'s current weather story…`);
    return;
  }

  const personality = districtState.insight.personality;
  const content = document.createElement("article");
  content.className = "editorial-content content-transition";

  const personalityBlock = document.createElement("div");
  personalityBlock.append(
    createTextElement("p", "eyebrow", `${districtState.district.name} weather personality`),
    createTextElement(
      "h3",
      "personality-title",
      personality?.title ?? "Weather personality unavailable"
    ),
    createTextElement(
      "p",
      "",
      personality?.description ?? "A personality description is unavailable."
    )
  );

  const storyBlock = document.createElement("div");
  storyBlock.append(
    createTextElement("p", "summary-label", "Current weather story"),
    createTextElement(
      "p",
      "weather-story",
      districtState.insight.story ?? "A current weather story is unavailable."
    )
  );

  content.append(personalityBlock, storyBlock);
  root.replaceChildren(content);
}
