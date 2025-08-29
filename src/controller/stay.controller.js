import Stays from "../model/stays.model.js";
import { processStaysData } from "../services/dataProcess.services.js";

import {
  backGroundScraping,
  performScraping,
} from "../services/scrapper.service.js";

import { scrapeAllHotelsDehradun } from "./../scrapper/googleMaps.scrapper.js";

export const getStaysAirbnb = async (req, res) => {
  try {
    const { city } = req.query;

    if (!city) {
      return res.status(400).json({ message: "city query param required" });
    }

    // Regex for flexible city search
    const cityRegex = new RegExp(city, "i");
    console.log(cityRegex);

    // 1) Fetch existing stays from DB for the given city
    const existingStays = await Stays.find({
      address: cityRegex,
      type: "airbnb",
    }).lean();

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

    if (existingStays.length === 0) {
      let data = await performScraping("airbnb");
      return res.json({
        source: "scrapper",
        data,
      });
    }

    if (useCachedData === false) {
      backGroundScraping("airbnb").catch((err) =>
        console.log("background scraping failed:", err)
      );
    }

    return res.json({
      source: "cache",
      data: existingStays,
      replaced: false,
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
