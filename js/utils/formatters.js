const ONE_DECIMAL_FORMATTER = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1
});

function isFiniteNumber(value) {
  return Number.isFinite(value);
}

/** @param {number | null | undefined} value */
export function formatTemperature(value) {
  return isFiniteNumber(value) ? `${Math.round(value)}°C` : "Unavailable";
}

/** @param {number | null | undefined} value */
export function formatScore(value) {
  return isFiniteNumber(value) ? `${Math.round(value)} / 100` : "Unavailable";
}

/** @param {number | null | undefined} value */
export function formatPercentage(value) {
  return isFiniteNumber(value) ? `${Math.round(value)}%` : "Unavailable";
}

/** @param {number | null | undefined} value */
export function formatVisibility(value) {
  if (!isFiniteNumber(value)) return "Unavailable";
  if (value < 1000) return `${Math.round(value)} m`;
  return `${ONE_DECIMAL_FORMATTER.format(value / 1000)} km`;
}

/** @param {number | null | undefined} value */
export function formatWindSpeed(value) {
  return isFiniteNumber(value)
    ? `${ONE_DECIMAL_FORMATTER.format(value)} m/s`
    : "Unavailable";
}

/** @param {number | null | undefined} value */
export function formatWindDirection(value) {
  if (!isFiniteNumber(value)) return "Unavailable";

  const normalizedDegrees = ((value % 360) + 360) % 360;
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const direction = labels[Math.round(normalizedDegrees / 45) % labels.length];
  return `${direction} · ${Math.round(normalizedDegrees)}°`;
}

/** @param {number | null | undefined} value */
export function formatRainfall(value) {
  return isFiniteNumber(value)
    ? `${ONE_DECIMAL_FORMATTER.format(value)} mm`
    : "Unavailable";
}

/** @param {number | null | undefined} value */
export function formatPressure(value) {
  return isFiniteNumber(value) ? `${Math.round(value)} hPa` : "Unavailable";
}

/** @param {string | null | undefined} value */
export function formatCondition(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return "Current condition unavailable";
  }

  const trimmedValue = value.trim();
  return `${trimmedValue.charAt(0).toUpperCase()}${trimmedValue.slice(1)}`;
}

/** @param {string | null | undefined} value */
export function formatLevel(value) {
  if (typeof value !== "string" || value.trim() === "") return "Unavailable";

  return value
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

/** @param {string | null | undefined} value */
export function toStatusToken(value) {
  if (typeof value !== "string") return "unknown";
  return value.trim().toLowerCase().replaceAll("_", "-") || "unknown";
}
