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
const NormalizeAirbnbData = (data) => {
  return data.map((item) => {
    // Parse price - handle null/undefined and extract numeric value if possible
    let normalizedPrice = "N/A";
    if (item.price && item.price !== null) {
      // Extract numbers from price string
      const priceMatch = item.price.toString().match(/\d+/);
      normalizedPrice = priceMatch ? priceMatch[0] : "N/A";
    }

    // Handle rating - convert null to undefined (which will use schema default)
    const normalizedRating = item.rating === null ? undefined : item.rating;

    // Use sourceUrl as the unique identifier since it's the same as scoreid
    const sourceIdentifier =
      item.sourceUrl || item.id || `airbnb_${Date.now()}`;

    // Create normalized object with MongoDB update operation structure
    return {
      updateOne: {
        filter: { sourceUrl: sourceIdentifier }, // Use sourceUrl as unique identifier
        update: {
          $set: {
            name: item.name || "Unnamed Property",
            description: "", // Not in source data
            type: item.type || "airbnb",
            address: "", // Not in source data
            location: {
              lat: 0, // Placeholder - need geocoding implementation
              lon: 0, // Placeholder - need geocoding implementation
            },
            rating: normalizedRating,
            price: normalizedPrice,
            amenities: [], // Not in source data
            images: Array.isArray(item.images) ? item.images : [],
            sourceUrl: sourceIdentifier,
            lastUpdated: new Date(),
          },
        },
        upsert: true,
      },
    };
  });
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
