/**
 * Build-time prefetch of NYT PIPS puzzles.
 *
 * Static hosting (e.g. GitHub Pages) has no server at runtime, so the browser
 * cannot fetch the NYT API directly (CORS). Instead we download a window of
 * puzzles at build time (no CORS server-side) and write them as same-origin
 * static JSON files that the client can fetch.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API_URL = "https://www.nytimes.com/svc/pips/v1/{date}.json";
const DAYS = Number(process.env.PREFETCH_DAYS || 14);
const OUT_DIR = path.join(process.cwd(), "public", "puzzles");

function dateNDaysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let ok = 0;
  for (let i = 0; i < DAYS; i++) {
    const date = dateNDaysAgo(i);
    const url = API_URL.replace("{date}", date);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  skip ${date}: HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      await writeFile(
        path.join(OUT_DIR, `${date}.json`),
        JSON.stringify(data)
      );
      ok++;
    } catch (e) {
      console.warn(`  skip ${date}: ${e.message}`);
    }
  }

  console.log(`Prefetched ${ok}/${DAYS} puzzles into public/puzzles/`);
}

main();
