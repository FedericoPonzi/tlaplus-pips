/**
 * CheerpJ integration — manages TLC execution via hidden iframe.
 * Adapted from tlaplus-web's cheerpj.ts pattern.
 *
 * Usage:
 *   import { initCheerpJ, runTlc, isCheerpJReady } from './cheerpj-bridge.js';
 *   await initCheerpJ();
 *   const output = await runTlc(spec, cfg, { workers: 1, checkDeadlock: false }, onProgress);
 */

let iframe = null;
let iframeReady = false;
let readyResolve = null;
let readyReject = null;
let resultResolve = null;
let progressCallback = null;
let initPromise = null;
let listenerAdded = false;

function getWorkerUrl() {
  // Relative URL — resolved against the current page origin + path
  return "tlc-worker.html";
}

function handleMessage(event) {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === "ready") {
    iframeReady = true;
    readyResolve?.();
    readyResolve = null;
    readyReject = null;
  } else if (data.type === "error" && readyReject) {
    readyReject(new Error(data.message));
    readyResolve = null;
    readyReject = null;
  } else if (data.type === "result") {
    progressCallback = null;
    resultResolve?.(data.output);
    resultResolve = null;
  } else if (data.type === "progress") {
    progressCallback?.(data.line);
  }
}

function createIframe() {
  return new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
    iframeReady = false;

    if (iframe) {
      iframe.remove();
    }

    iframe = document.createElement("iframe");
    iframe.src = getWorkerUrl();
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    // Timeout after 120 seconds
    setTimeout(() => {
      if (!iframeReady) {
        readyReject?.(new Error("CheerpJ initialization timed out"));
        readyResolve = null;
        readyReject = null;
      }
    }, 120000);
  });
}

/**
 * Initialize CheerpJ and load the TLC JAR.
 * Must be called before runTlc(). Returns a promise that resolves when ready.
 */
export function initCheerpJ() {
  if (!initPromise) {
    if (!listenerAdded) {
      window.addEventListener("message", handleMessage);
      listenerAdded = true;
    }
    initPromise = createIframe();
  }
  return initPromise;
}

/**
 * Run TLC with the given spec and config.
 * @param {string} spec - TLA+ spec content
 * @param {string} cfg - TLC config content
 * @param {{ workers: number, checkDeadlock: boolean }} options
 * @param {function(string): void} [onProgress] - Called with each output line as it arrives
 * @returns {Promise<string>} TLC output
 */
export async function runTlc(spec, cfg, options, onProgress) {
  // Wait for any pending iframe reload to complete
  if (initPromise) {
    await initPromise;
  }
  if (!iframeReady || !iframe?.contentWindow) {
    throw new Error("CheerpJ not initialized. Call initCheerpJ() first.");
  }

  progressCallback = onProgress || null;

  const output = await new Promise((resolve) => {
    resultResolve = resolve;
    iframe.contentWindow.postMessage(
      {
        type: "run",
        spec,
        cfg,
        workers: options.workers,
        checkDeadlock: options.checkDeadlock,
      },
      "*"
    );
  });

  // Reload iframe to reset Java static state for next run
  initPromise = createIframe();

  return output;
}

/**
 * @returns {boolean} Whether CheerpJ is initialized and ready
 */
export function isCheerpJReady() {
  return iframeReady;
}
