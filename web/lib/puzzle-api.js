/**
 * Fetch puzzle data.
 *
 * Server-side (build time): fetch directly from the NYT API (no CORS).
 * Client-side: fetch the same-origin static JSON prefetched at build time
 * into public/puzzles/ (see scripts/prefetch-puzzles.mjs).
 */

const API_URL = "https://www.nytimes.com/svc/pips/v1/{date}.json";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export async function fetchPuzzle(date) {
  const url =
    typeof window === "undefined"
      ? API_URL.replace("{date}", date)
      : `${BASE_PATH}/puzzles/${date}.json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return await res.json();
}
