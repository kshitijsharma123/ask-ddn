import Stays from "../model/stays.model.js";
import { processStaysData } from "../services/dataProcess.services.js";
import { stayService, fetchHotelFromApi } from "../services/stays.services.js";
import { saveScrapedStays } from "../utils/stay.utils.js";
import { scrapeAllHotelsDehradun } from "./../scrapper/googleMaps.scrapper.js";
export const getStaysAirbnb = async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ message: "city query param required" });
    }

    // Regex for flexible city search
    const cityRegex = new RegExp(city, "i");

    // 1) Fetch existing stays from DB for the given city
    const existingStays = await Stays.find({ address: cityRegex })
      .sort({ lastUpdated: -1 })
      .lean();

    // 2) Check last update time (6 hours = 21600000 ms)
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    const now = Date.now();

    let useCachedData = false;

    if (existingStays.length > 0) {
      const lastUpdated = existingStays[0]?.lastUpdated || 0;
      const timeDiff = now - new Date(lastUpdated).getTime();

      if (timeDiff < SIX_HOURS) {
        // ✅ Use cached data if updated within 6 hours
        useCachedData = true;
      }
    }

    // 3) If recent data exists → return it directly
    if (useCachedData) {
      return res.json({
        source: "cache",
        data: existingStays,
        replaced: false,
      });
    }

    // 4) Else, scrape fresh data
    console.log(`🔄 Fetching fresh data for city: ${city}...`);
    const rawServiceResult = await stayService(city);

    const scraped = Array.isArray(rawServiceResult)
      ? rawServiceResult
      : Array.isArray(rawServiceResult?.rawData)
      ? rawServiceResult.rawData
      : Array.isArray(rawServiceResult?.data)
      ? rawServiceResult.data
      : [];

    if (!scraped.length) {
      return res.status(404).json({
        message: "No data found from scraper",
        data: existingStays,
      });
    }

    // 5) Delete old records for the city
    await Stays.deleteMany({ address: cityRegex });

    // 6) Default locations for known cities
    const defaultLocations = {
      dehradun: { lat: 30.3165, lon: 78.0322 },
      mussoorie: { lat: 30.4595, lon: 78.096 },
    };
    const defaultLocation = defaultLocations[city.toLowerCase()] ?? null;

    // 7) Save fresh data into DB
    const saveSummary = await saveScrapedStays(scraped, {
      defaultLocation,
      logger: console,
    });

    // 8) Fetch new records from DB
    const finalDocs = await Stays.find({ address: cityRegex }).lean();

    return res.json({
      source: "scrapper",
      data: finalDocs,
      replaced: true,
      saveSummary,
    });
  } catch (err) {
    console.error("getStays error:", err);
    return res
      .status(500)
      .json({ message: "internal error", error: err.message });
  }
};

export const getHotels = async (req, res) => {
  const googleMapsData = await scrapeAllHotelsDehradun();

  const hotels = await processStaysData(googleMapsData);

  return res.json({ message: "working", hotels });
};
