import { getWeather } from "../services/weather.services.js";

export const fetchWeather = async (req, res) => {
  try {
    const { city, detailed } = req.query;

    if (!city) {
      return res.status(400).json({ error: "City name is required" });
    }

    // detailed = true → fetch hourly, daily, alerts too
    // const isDetailed = detailed === "true";

    const weatherData = await getWeather(city);

    if (weatherData.error) {
      return res.status(500).json(weatherData);
    }

    return res.status(200).json(weatherData);
  } catch (error) {
    console.error("Weather Controller Error:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
