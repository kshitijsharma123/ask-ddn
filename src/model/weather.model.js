import mongoose from "mongoose";

const weatherSchema = new mongoose.Schema(
  {
    city: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    coordinates: {
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
    },
    current_time: {
      type: String,
      required: true,
    },
    current_conditions: {
      temperature: { type: Number },
      windspeed: { type: Number },
      weatherCode: { type: Number },
      is_day: { type: String },
    },
    three_hour_forecast: [
      {
        time: String,
        temperature: Number,
        humidity: Number,
        precipitation: Number,
        windspeed: Number,
        weatherCode: Number,
      },
    ],
    next_three_days_sunrise_sunset: [
      {
        date: String,
        sunrise: String,
        sunset: String,
        max_temp: Number,
        min_temp: Number,
        precipitation: Number,
      },
    ],
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

weatherSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 3600 });

const Weather = mongoose.model("Weather", weatherSchema);
export default Weather;
