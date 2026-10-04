/**
 * Renders a restrained structural loading state without animated shimmer.
 *
 * @param {HTMLElement} root
 * @param {string} message
 */
export function renderLoadingState(root, message = "Loading current weather…") {
  const container = document.createElement("div");
  container.className = "loading-state";

  const copy = document.createElement("p");
  copy.textContent = message;

  const lines = document.createElement("div");
  lines.className = "loading-lines";
  lines.setAttribute("aria-hidden", "true");

  for (let index = 0; index < 3; index += 1) {
    const line = document.createElement("span");
    line.className = "loading-line";
    lines.append(line);
  }

  container.append(copy, lines);
  root.replaceChildren(container);
}
