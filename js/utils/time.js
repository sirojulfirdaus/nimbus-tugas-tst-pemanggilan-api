const TIME_FORMAT_OPTIONS = Object.freeze({
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC"
});

/**
 * Formats a provider Unix timestamp in the location's timezone.
 *
 * @param {number | null | undefined} unixSeconds
 * @param {number | null | undefined} timezoneOffsetSec
 * @returns {string}
 */
export function formatWeatherTime(unixSeconds, timezoneOffsetSec) {
  if (!Number.isFinite(unixSeconds) || !Number.isFinite(timezoneOffsetSec)) {
    return "Unavailable";
  }

  const localTimestampMs = (unixSeconds + timezoneOffsetSec) * 1000;
  return new Intl.DateTimeFormat("en-GB", TIME_FORMAT_OPTIONS).format(
    new Date(localTimestampMs)
  );
}

/**
 * Formats an application timestamp in the user's current locale.
 *
 * @param {number | null | undefined} timestampMs
 * @returns {string}
 */
export function formatApplicationTime(timestampMs) {
  if (!Number.isFinite(timestampMs)) return "Unavailable";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestampMs));
}

/**
 * Derives presentational daylight context from normalized observation data.
 * Progress is only returned while the observation falls within a valid
 * sunrise-to-sunset interval.
 *
 * @param {{
 *   observedAt?: number | null,
 *   sunriseUnix?: number | null,
 *   sunsetUnix?: number | null,
 *   iconCode?: string | null
 * } | null | undefined} weather
 * @returns {{ phase: "day" | "night" | "unknown", progress: number | null }}
 */
export function getDaylightContext(weather) {
  const observedAt = weather?.observedAt;
  const sunriseUnix = weather?.sunriseUnix;
  const sunsetUnix = weather?.sunsetUnix;

  if (
    Number.isFinite(observedAt) &&
    Number.isFinite(sunriseUnix) &&
    Number.isFinite(sunsetUnix) &&
    sunsetUnix > sunriseUnix
  ) {
    const isDaytime = observedAt >= sunriseUnix && observedAt < sunsetUnix;
    return {
      phase: isDaytime ? "day" : "night",
      progress: isDaytime
        ? Math.min(1, Math.max(0, (observedAt - sunriseUnix) / (sunsetUnix - sunriseUnix)))
        : null
    };
  }

  if (typeof weather?.iconCode === "string") {
    if (weather.iconCode.endsWith("d")) return { phase: "day", progress: null };
    if (weather.iconCode.endsWith("n")) return { phase: "night", progress: null };
  }

  return { phase: "unknown", progress: null };
}
