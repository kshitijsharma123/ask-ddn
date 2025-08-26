import axios from "axios";

import { mapWeatherData } from "./../utils/weather.utils.js";

// Helper function to get latitude & longitude from city name
const getCoordinates = async (city) => {
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city
    )}&count=1&language=en&format=json`;

    const geoResponse = await axios.get(geoUrl);

    if (
      !geoResponse.data ||
      !geoResponse.data.results ||
      geoResponse.data.results.length === 0
    ) {
      throw new Error("City not found");
    }

    const { latitude, longitude } = geoResponse.data.results[0];
    return { lat: latitude, lon: longitude };
  } catch (error) {
    throw new Error("Failed to fetch city coordinates");
  }
};

// Main function: Get current weather by city name
export const getWeather = async (city, isDetailed) => {
  try {
    // Get city coordinates
    const { lat, lon } = await getCoordinates(city);

    // Base URL
    let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto`;

    // Always get current weather
    url += "&current_weather=true";

    // If detailed weather is requested, add hourly, daily & alerts
    if (isDetailed) {
      // Changed from !isDetailed to isDetailed
      url +=
        "&hourly=temperature_2m,relative_humidity_2m,precipitation,weathercode,windspeed_10m" +
        "&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum" +
        "&alerts=1";
    }

    // Fetch weather data
    const response = await axios.get(url);

    if (!response.data) {
      throw new Error("Weather data not available");
    }

    const { data } = response;

    // Basic current weather
    const current = data.current_weather;

    // If not detailed, return only current data
    if (!isDetailed) {
      // This condition is correct
      return {
        city,
        coordinates: { lat, lon },
        current: {
          temperature: current?.temperature ?? "N/A",
          windspeed: current?.windspeed ?? "N/A",
          weatherCode: current?.weathercode ?? "N/A",
          time: current?.time ?? "N/A",
          is_day: current?.is_day === 1 ? "Day" : "Night",
        },
      };
    }

    // If detailed, return everything
    const rawData = {
      city,
      coordinates: { lat, lon },
      current: {
        temperature: current?.temperature ?? "N/A",
        windspeed: current?.windspeed ?? "N/A",
        weatherCode: current?.weathercode ?? "N/A",
        time: current?.time ?? "N/A",
        is_day: current?.is_day === 1 ? "Day" : "Night",
      },
      hourly: data.hourly || {},
      daily: data.daily || {},
      alerts: data.alerts || [],
    };
    console.log(mapWeatherData(rawData));
    return mapWeatherData(rawData);
  } catch (error) {
    console.error("Weather API Error:", error.message);
    return { error: "Failed to fetch weather data" };
  }
};
