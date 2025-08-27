// src/utils/staySaver.js
import Stays from "../model/stays.model.js"; // adjust path to your model

/**
 * Save scraped stays into MongoDB using bulk upsert.
 *
 * @param {Array<Object>} rawData - array of scraped stay objects
 * @param {Object} options
 *   - defaultLocation: { lat: Number, lon: Number }  // fallback if no location
 *   - geocode: async (city) => ({ lat, lon })        // optional async function to resolve city -> coords
 *   - logger: console-like object                   // optional logger (defaults to console)
 *
 * @returns {Object} summary { processed, upsertedCount, modifiedCount, skipped: [items] }
 */
export async function saveScrapedStays(rawData = [], options = {}) {
  console.log("saved data working");
  const { defaultLocation = null, geocode = null, logger = console } = options;

  if (!Array.isArray(rawData)) {
    throw new Error("rawData must be an array");
  }

  // simple city -> coords map you can extend (quick fallback)
  const cityCoords = {
    dehradun: { lat: 30.3165, lon: 78.0322 },
    mussoorie: { lat: 30.4595, lon: 78.096 },
    // add more if needed...
  };

  const ops = [];
  const seen = new Set();
  const skipped = [];

  // helper to normalize image arrays
  const normalizeImages = (imgField) => {
    if (!imgField) return [];
    if (Array.isArray(imgField)) return imgField.filter(Boolean).map(String);
    if (typeof imgField === "string") return [imgField];
    // sometimes puppeteer output: [Array] placeholder - skip
    return [];
  };

  for (const item of rawData) {
    try {
      // dedupe by sourceUrl if present, else by id fallback
      const uniqueKey = item?.sourceUrl || item?.id || JSON.stringify(item);
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);

      // required field: name
      const name = (item.name || item.title || item.id || "").toString().trim();
      if (!name) {
        skipped.push({ reason: "missing_name", item });
        continue;
      }

      // type (hotel | airbnb) — default to scraped type or 'airbnb'
      const type =
        item.type && ["hotel", "airbnb"].includes(item.type)
          ? item.type
          : "airbnb";

      // rating
      const rating = item.rating != null ? Number(item.rating) : null;

      // price as string or "N/A"
      const price = item.price != null ? String(item.price) : "N/A";

      // images
      const images = normalizeImages(item.images);

      // sourceUrl
      const sourceUrl = item.sourceUrl ? String(item.sourceUrl) : null;

      // address/description fallback
      const address = item.address
        ? String(item.address)
        : item.city
        ? String(item.city)
        : undefined;
      const description = item.description
        ? String(item.description)
        : undefined;

      // location resolution (most important because schema requires it)
      let location = null;
      if (
        item.location &&
        typeof item.location === "object" &&
        (Number.isFinite(item.location.lat) ||
          Number.isFinite(item.location.lon))
      ) {
        // accept either {lat,lon} or {latitude,longitude}
        const lat = Number(
          item.location.lat ?? item.location.latitude ?? item.location.lat
        );
        const lon = Number(
          item.location.lon ?? item.location.longitude ?? item.location.lon
        );
        if (Number.isFinite(lat) && Number.isFinite(lon))
          location = { lat, lon };
      }

      // try geocode callback
      if (!location && typeof geocode === "function") {
        const cityName = item.city || item.address || null;
        if (cityName) {
          try {
            // allow geocode to throw if fails
            const geo = await geocode(cityName);
            if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
              location = { lat: Number(geo.lat), lon: Number(geo.lon) };
            }
          } catch (e) {
            logger?.debug?.("geocode failed for", cityName, e?.message ?? e);
          }
        }
      }
      // fallback to defaultLocation param or simple city map
      if (!location) {
        const cityKey = (item.city || "").toString().toLowerCase();
        if (
          defaultLocation &&
          Number.isFinite(defaultLocation.lat) &&
          Number.isFinite(defaultLocation.lon)
        ) {
          location = {
            lat: Number(defaultLocation.lat),
            lon: Number(defaultLocation.lon),
          };
        } else if (cityCoords[cityKey]) {
          location = cityCoords[cityKey];
        }
      }

      // If still no location, skip to avoid schema validation errors
      if (!location) {
        skipped.push({ reason: "missing_location", item });
        continue;
      }

      // build document to upsert
      const doc = {
        name,
        description,
        type,
        address,
        location,
        rating,
        price,
        amenities: Array.isArray(item.amenities)
          ? item.amenities.map(String)
          : [],
        images,
        sourceUrl,
        lastUpdated: new Date(),
      };

      // Use sourceUrl as the dedupe/upsert key if available, else use name+city
      const filter = sourceUrl
        ? { sourceUrl }
        : { name, "location.lat": location.lat, "location.lon": location.lon };

      ops.push({
        updateOne: {
          filter,
          update: { $set: doc },
          upsert: true,
        },
      });
    } catch (err) {
      skipped.push({
        reason: "exception_building_doc",
        error: err.message,
        item,
      });
    }
  } // end loop

  if (ops.length === 0) {
    return {
      processed: 0,
      upsertedCount: 0,
      modifiedCount: 0,
      skipped,
      message:
        "No valid docs to write. Provide defaultLocation or geocode for missing locations.",
    };
  }

  // perform bulkWrite
  try {
    const result = await Stays.bulkWrite(ops, { ordered: false });
    // result may vary depending on mongoose version; use available fields
    const upserted = result.upsertedCount ?? result.nUpserted ?? 0;
    const modified = result.modifiedCount ?? result.nModified ?? 0;

    return {
      processed: ops.length,
      upsertedCount: upserted,
      modifiedCount: modified,
      rawResult: result,
      skipped,
    };
  } catch (err) {
    // partial failure: return error + what we skipped earlier
    logger?.error?.("bulkWrite failed", err);
    return {
      processed: ops.length,
      upsertedCount: 0,
      modifiedCount: 0,
      error: err.message,
      skipped,
    };
  }
}
