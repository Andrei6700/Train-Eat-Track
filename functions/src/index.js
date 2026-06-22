/**
 * Cloud Functions — Train-Eat-Track
 *
 * proxyUsdaSearch:
 *   Proxies USDA FoodData Central requests so the API key stays server-side.
 *   The client calls this function instead of hitting the USDA endpoint directly.
 *
 * Deployment:
 *   cd functions && npm install && firebase deploy --only functions
 */

const functions = require("firebase-functions");
const fetch = require("node-fetch");

const USDA_SEARCH_ENDPOINT = "https://api.nal.usda.gov/fdc/v1/foods/search";

/**
 * HTTP-callable Cloud Function that proxies USDA search requests.
 *
 * Expected request body (from `httpsCallable`):
 *   { query: string, pageSize?: number, pageNumber?: number }
 *
 * Returns:
 *   The raw JSON payload from the USDA FoodData Central API.
 */
exports.proxyUsdaSearch = functions.https.onCall(async (data, context) => {
  // data may be wrapped in { data: ... } depending on SDK version
  const payload = data?.data ?? data;

  const query = (payload?.query || "").trim();
  if (!query) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required field: query",
    );
  }

  const apiKey = process.env.USDA_API_KEY || functions.config().usda?.api_key;
  if (!apiKey) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "USDA API key is not configured on the server.",
    );
  }

  const pageSize = Number(payload?.pageSize) || 20;
  const pageNumber = Number(payload?.pageNumber) || 1;

  const params = new URLSearchParams({
    query,
    pageSize: String(pageSize),
    pageNumber: String(pageNumber),
    api_key: apiKey,
  });

  const url = `${USDA_SEARCH_ENDPOINT}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      timeout: 15000,
    });

    if (!response.ok) {
      console.error(
        `[proxyUsdaSearch] USDA API returned ${response.status}: ${response.statusText}`,
      );
      throw new functions.https.HttpsError(
        "unavailable",
        `USDA API error: ${response.status}`,
      );
    }

    const json = await response.json();
    return json;
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    console.error("[proxyUsdaSearch] Unexpected error:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to fetch from USDA API",
    );
  }
});
