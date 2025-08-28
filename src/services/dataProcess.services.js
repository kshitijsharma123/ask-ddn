import Stay from "../model/stays.model.js";

export const processStaysData = async (data = [], scorce = "googlemaps") => {
  if (!Array.isArray(data) || data.length === 0) {
    console.log("No data from the " + scorce + " scrapper");
    return;
  }

  console.log(`🛠️ Processing ${data.length} stays from ${scorce}...`);

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

  try {
    const result = await Stay.bulkWrite(bulkOps, { ordered: false });
    console.log(
      `✅ ${scorce}: upserted=${result.upsertedCount || 0}, modified=${
        result.modifiedCount || 0
      }`
    );
    return result;
  } catch (error) {
    console.error(`❌ Error processing stays from ${scorce}:`, error);
    throw error;
  }
};
