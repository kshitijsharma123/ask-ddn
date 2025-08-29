import Stay from "../model/stays.model.js";

// Normalize googleMaps data
const NormalizeGoogleMapsData = (data) => {
  const bulkOps = data.map((item) => {
    const name = (item.name || "Unnamed Stay").trim();
    const address = item.address || "Address not available";
    const lat = Number(item.coordinates?.lat ?? 0);
    const lon = Number(item.coordinates?.lng ?? 0);

    // Parse rating safely
    let rating = null;
    if (
      item.rating !== undefined &&
      item.rating !== null &&
      item.rating !== ""
    ) {
      const parsed = parseFloat(String(item.rating).replace(",", "."));
      rating = Number.isFinite(parsed) ? parsed : null;
    }

    const price = item.price || "N/A";
    const sourceUrl = item.link || null;
    const images = Array.isArray(item.images)
      ? item.images.filter(Boolean)
      : [];
    const amenities = Array.isArray(item.amenities)
      ? item.amenities.filter(Boolean)
      : [];

    const setOps = {
      name,
      description: item.description || "",
      type: "hotel",
      address,
      location: { lat, lon },
      price,
      sourceUrl,
      lastUpdated: new Date(),
    };

    if (rating !== null) {
      setOps.rating = rating; // ✅ No conflict now
    }

    const updateDoc = {
      $setOnInsert: { createdAt: new Date() },
      $set: setOps,
    };

    if (images.length > 0) {
      updateDoc.$addToSet = { images: { $each: images } };
    }
    if (amenities.length > 0) {
      updateDoc.$addToSet = updateDoc.$addToSet || {};
      updateDoc.$addToSet.amenities = { $each: amenities };
    }

    const filter = sourceUrl
      ? { sourceUrl }
      : { name, "location.lat": lat, "location.lon": lon };

    return {
      updateOne: {
        filter,
        update: updateDoc,
        upsert: true,
      },
    };
  });
  return bulkOps;
};

// Normalize airbnb data
const NormalizeAirbnbData = (data, options = {}) => {
  const { defaultLocation, logger = console } = options;

  const bulkOps = data.map((item) => {
    const name = (item.name || "Unnamed Property").trim();
    const city = item.city || "Unknown";
    const address = `${name}, ${city}`;

    // Handle location coordinates
    let lat = 0;
    let lon = 0;

    // Use default location if provided
    if (defaultLocation && defaultLocation.lat && defaultLocation.lon) {
      lat = Number(defaultLocation.lat);
      lon = Number(defaultLocation.lon);

      if (logger) {
        logger.log(`Using default location for ${city}:`, { lat, lon });
      }
    }

    // Parse rating safely
    let rating = null;
    if (
      item.rating !== undefined &&
      item.rating !== null &&
      item.rating !== ""
    ) {
      const parsed = parseFloat(String(item.rating).replace(",", "."));
      rating = Number.isFinite(parsed) ? parsed : null;
    }

    // Parse price safely
    let price = "N/A";
    if (item.price && item.price !== null) {
      const priceMatch = item.price.toString().match(/\d+/);
      price = priceMatch ? `₹${priceMatch[0]}` : "N/A";
    }

    const sourceUrl = item.sourceUrl || item.id || `airbnb_${Date.now()}`;
    const images = Array.isArray(item.images)
      ? item.images.filter(Boolean)
      : [];
    const amenities = Array.isArray(item.amenities)
      ? item.amenities.filter(Boolean)
      : [];

    const setOps = {
      name,
      description: item.description || "",
      type: "airbnb",
      address,
      location: { lat, lon },
      price,
      sourceUrl,
      lastUpdated: new Date(),
    };

    if (rating !== null) {
      setOps.rating = rating;
    }

    const updateDoc = {
      $setOnInsert: { createdAt: new Date() },
      $set: setOps,
    };

    if (images.length > 0) {
      updateDoc.$addToSet = { images: { $each: images } };
    }
    if (amenities.length > 0) {
      updateDoc.$addToSet = updateDoc.$addToSet || {};
      updateDoc.$addToSet.amenities = { $each: amenities };
    }

    // Use sourceUrl as primary filter since it's unique for Airbnb
    const filter = sourceUrl
      ? { sourceUrl }
      : { name, "location.lat": lat, "location.lon": lon };

    return {
      updateOne: {
        filter,
        update: updateDoc,
        upsert: true,
      },
    };
  });

  return bulkOps;
};
// Function stores the data in mongodb
export const processStaysData = async (data = [], source = "googlemaps") => {
  if (!Array.isArray(data) || data.length === 0) {
    console.log("No data from the " + source + " scrapper");
    return;
  }

  let NormalizeData;

  console.log(`🛠️ Processing ${data.length} stays from ${source}...`);

  if (source === "googlemaps") {
    NormalizeData = NormalizeGoogleMapsData(data);
  } else if (source === "airbnb") {
    NormalizeData = NormalizeAirbnbData(data);
    console.log(NormalizeData);
  } else {
    console.error(`❌ Unknown source: ${source}`);
    return;
  }

  if (
    !NormalizeData ||
    !Array.isArray(NormalizeData) ||
    NormalizeData.length === 0
  ) {
    console.error(`❌ No normalized data to process for ${source}`);
    return;
  }

  try {
    const result = await Stay.bulkWrite(NormalizeData, { ordered: false });
    console.log(
      `✅ ${source}: upserted=${result.upsertedCount || 0}, modified=${
        result.modifiedCount || 0
      }`
    );
    return result;
  } catch (error) {
    console.error(`❌ Error processing stays from ${source}:`, error);
    throw error;
  }
};
