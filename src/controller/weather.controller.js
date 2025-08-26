import { getWeather } from "../services/weather.services.js";
import Weathers from "../model/weather.model.js";

const CACHE_TTL = 1 * 60 * 60 * 1000; // 1 hour
export const fetchWeather = async (req, res) => {
  try {
    const { city, detailed = false } = req.query;

    if (!city) {
      return res.status(400).json({ error: "City name is required" });
    }

    const isDetailed = detailed === "true";
    const cityLower = city.toLowerCase();

    // Check cache - using the new model structure
    let cachedWeather = await Weathers.findOne({
      city: cityLower,
      lastUpdated: { $gte: new Date(Date.now() - CACHE_TTL) },
    });

    if (cachedWeather) {
      const { _id, __v, createdAt, updatedAt, ...cleanData } =
        cachedWeather.toObject();
      return res.status(200).json({
        source: "cache",
        data: cleanData,
      });
    }

    // Fetch fresh data
    const freshWeather = await getWeather(city, isDetailed);

    if (freshWeather.error) {
      return res.status(500).json({ error: freshWeather.error });
    }

    // Create or update the document with the fresh data
    const weatherData = {
      city: cityLower,
      coordinates: freshWeather.coordinates,
      current_time: freshWeather.current_time,
      current_conditions: freshWeather.current_conditions,
      three_hour_forecast: freshWeather.three_hour_forecast,
      next_three_days_sunrise_sunset:
        freshWeather.next_three_days_sunrise_sunset,
      lastUpdated: new Date(),
    };

    const updatedWeather = await Weathers.findOneAndUpdate(
      { city: cityLower },
      weatherData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    // Remove MongoDB-specific fields before sending response
    const { _id, __v, createdAt, updatedAt, ...cleanData } =
      updatedWeather.toObject();

    return res.status(200).json({
      source: "api",
      data: cleanData,
    });
  } catch (error) {
    console.error("Weather Controller Error:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
