// api.js
//
// Small collection of helper functions for calling our FastAPI
// backend. Keeping them in one place means the rest of the app
// doesn't need to know the actual URLs or fetch() details.

function getBaseCandidates() {
  const candidates = [];
  if (typeof window !== "undefined" && window.location) {
    const host = window.location.hostname || "localhost";
    // 1. Primary: exact same hostname as currently opened in the browser
    candidates.push(`http://${host}:8000`);
    // 2. Secondary: complement loopback host
    if (host === "localhost") {
      candidates.push("http://127.0.0.1:8000");
    } else if (host === "127.0.0.1") {
      candidates.push("http://localhost:8000");
    }
  }
  const envUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  if (!candidates.includes(envUrl)) {
    candidates.push(envUrl);
  }
  return candidates;
}

/**
 * Generic fetch wrapper.
 * Throws a friendly error if the backend can't be reached or
 * returns a non-OK response, so components can show a clear message.
 */
async function apiFetch(path, options = {}) {
  const hostnames = getBaseCandidates();
  let lastError = null;

  for (const baseUrl of hostnames) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        signal: options.signal || controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("That band does not exist in the simulated spectrum.");
        }
        throw new Error(`Backend returned an error (status ${response.status}).`);
      }
      return await response.json();
    } catch (networkError) {
      if (
        networkError.message.includes("does not exist") ||
        networkError.message.includes("status")
      ) {
        throw networkError;
      }
      lastError = networkError;
    }
  }

  throw new Error("Backend connection failed. Make sure FastAPI is running.");
}

export function checkHealth() {
  return apiFetch("/health");
}

export function getBands() {
  return apiFetch("/bands");
}

export function getSpectrum() {
  return apiFetch("/spectrum");
}

export function scanBand(bandId) {
  return apiFetch(`/scan/${bandId}`);
}

export function stepAutoScan(mode = "smart") {
  return apiFetch(`/scan/next-step?mode=${mode}`, { method: "POST" });
}

export function getScanStats() {
  return apiFetch("/scan/stats");
}

export function resetScanStats() {
  return apiFetch("/scan/reset-stats", { method: "POST" });
}

export function getScanEvents(limit = 50) {
  return apiFetch(`/scan/events?limit=${limit}`);
}

export function getExportCsvUrl() {
  const host = typeof window !== "undefined" && window.location
    ? window.location.hostname || "localhost"
    : "127.0.0.1";
  return `http://${host}:8000/scan/export`;
}

export function getXaiRankings() {
  return apiFetch("/scan/xai-rankings");
}

export function getModelBenchmarks() {
  return apiFetch("/models/benchmarks");
}

export function switchActiveModel(modelName) {
  return apiFetch(`/models/switch?model_name=${modelName}`, { method: "POST" });
}

export function runBenchmark(numSteps = 150) {
  return apiFetch(`/benchmark/run?num_steps=${numSteps}`, { method: "POST" });
}

export function getDbScans(limit = 50) {
  return apiFetch(`/database/scans?limit=${limit}`);
}

export function getPrgStatus() {
  return apiFetch("/prg-status");
}

export function getSmartScanRecommendation() {
  return apiFetch("/smart-scan");
}

