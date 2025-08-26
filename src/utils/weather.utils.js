export const mapWeatherData = (weatherData) => {
  // Get current time and format it to match hourly data format (round to nearest hour)
  const currentTime = new Date(weatherData.current.time);
  // Round to the nearest hour to match hourly data format
  currentTime.setMinutes(0, 0, 0);
  const formattedCurrentTime = currentTime
    .toISOString()
    .replace(/\.\d{3}Z$/, "");

  // Find the hourly data for current time
  const hourlyTimes = weatherData.hourly.time;

  // Try to find exact match first, then try formatted match
  let currentIndex = hourlyTimes.indexOf(weatherData.current.time);

  if (currentIndex === -1) {
    // If exact match not found, try with formatted time
    currentIndex = hourlyTimes.indexOf(formattedCurrentTime);
  }

  if (currentIndex === -1) {
    // If still not found, find the closest time
    const currentTimestamp = new Date(weatherData.current.time).getTime();
    currentIndex = hourlyTimes.findIndex((time) => {
      const timeDiff = Math.abs(new Date(time).getTime() - currentTimestamp);
      return timeDiff < 60 * 60 * 1000; // Within 1 hour
    });
  }

  if (currentIndex === -1) {
    console.warn(
      "Current time not found in hourly data, using first available data"
    );
    currentIndex = 0; // Fallback to first available data
  }

  // Rest of your mapping code remains the same...
  // Get data for current time and next 3 hours and map to objects
  const hourlyData = [];
  for (let i = 0; i < 4 && currentIndex + i < hourlyTimes.length; i++) {
    const index = currentIndex + i;
    hourlyData.push({
      time: hourlyTimes[index],
      temperature: weatherData.hourly.temperature_2m[index],
      humidity: weatherData.hourly.relative_humidity_2m[index],
      precipitation: weatherData.hourly.precipitation[index],
      windspeed: weatherData.hourly.windspeed_10m[index],
      weatherCode: weatherData.hourly.weathercode[index],
    });
  }

  // Get sunrise/sunset for next 3 days
  const dailyTimes = weatherData.daily.time;
  const currentDate = weatherData.current.time.split("T")[0];
  const currentDateIndex = dailyTimes.indexOf(currentDate);

  if (currentDateIndex === -1) {
    throw new Error("Current date not found in daily data");
  }

  const next3DaysSunriseSunset = [];
  for (let i = 0; i < 3 && currentDateIndex + i < dailyTimes.length; i++) {
    const dayIndex = currentDateIndex + i;
    next3DaysSunriseSunset.push({
      date: dailyTimes[dayIndex],
      sunrise: weatherData.daily.sunrise[dayIndex],
      sunset: weatherData.daily.sunset[dayIndex],
      max_temp: weatherData.daily.temperature_2m_max[dayIndex],
      min_temp: weatherData.daily.temperature_2m_min[dayIndex],
      precipitation: weatherData.daily.precipitation_sum[dayIndex],
    });
  }

  // Create the result object
  const result = {
    city: weatherData.city,
    coordinates: weatherData.coordinates,
    current_time: weatherData.current.time,
    current_conditions: {
      temperature: weatherData.current.temperature,
      windspeed: weatherData.current.windspeed,
      weatherCode: weatherData.current.weatherCode,
      is_day: weatherData.current.is_day,
    },
    three_hour_forecast: hourlyData,
    next_three_days_sunrise_sunset: next3DaysSunriseSunset,
  };

  // Add alerts if they exist
  if (weatherData.alerts && weatherData.alerts.length > 0) {
    result.alerts = weatherData.alerts;
  }

  return result;
};
