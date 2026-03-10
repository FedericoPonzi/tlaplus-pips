/**
 * Fetch puzzle data from the NYT PIPS API.
 * Server-side (build time): direct fetch.
 * Client-side: tries direct, falls back to CORS proxy.
 */

const API_URL = "https://www.nytimes.com/svc/pips/v1/{date}.json";
const CORS_PROXY = "https://corsproxy.io/?url=";

export async function fetchPuzzle(date) {
  const directUrl = API_URL.replace("{date}", date);

  // Server-side: direct fetch always works (no CORS)
  if (typeof window === "undefined") {
    const res = await fetch(directUrl);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    return await res.json();
  }

  // Client-side: try direct first, fall back to CORS proxy
  try {
    const res = await fetch(directUrl);
    if (res.ok) return await res.json();
  } catch {
    // CORS blocked — try proxy
  }

  const proxyUrl = CORS_PROXY + encodeURIComponent(directUrl);
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Failed to fetch puzzle: ${res.status}`);
  return await res.json();
}
