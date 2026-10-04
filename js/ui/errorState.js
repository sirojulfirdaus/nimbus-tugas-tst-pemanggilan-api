function createMessageState({ title, message, isError, headingLevel = "h3" }) {
  const container = document.createElement("div");
  container.className = isError
    ? "message-state message-state-error"
    : "message-state";

  const heading = document.createElement(headingLevel);
  heading.textContent = title;

  const copy = document.createElement("p");
  copy.textContent = message;

  container.append(heading, copy);
  return container;
}

/**
 * Renders a user-facing error without exposing technical provider details.
 *
 * @param {HTMLElement} root
 * @param {{ title: string, message: string, onRetry?: () => void, headingLevel?: "h2" | "h3" }} options
 */
export function renderErrorState(
  root,
  { title, message, onRetry, headingLevel = "h3" }
) {
  const container = createMessageState({
    title,
    message,
    isError: true,
    headingLevel
  });

  if (typeof onRetry === "function") {
    const retryButton = document.createElement("button");
    retryButton.className = "button button-primary";
    retryButton.type = "button";
    retryButton.textContent = "Try again";
    retryButton.addEventListener("click", onRetry);
    container.append(retryButton);
  }

  root.replaceChildren(container);
}

/**
 * Renders a neutral state for content that depends on district selection.
 *
 * @param {HTMLElement} root
 * @param {{ title: string, message: string }} options
 */
export function renderEmptyState(root, { title, message }) {
  root.replaceChildren(createMessageState({ title, message, isError: false }));
}
