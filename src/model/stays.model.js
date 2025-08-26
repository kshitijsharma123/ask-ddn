import mongoose from "mongoose";

const staySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    type: {
      type: String,
      enum: ["hotel", "airbnb"],
      required: true,
      index: true,
    },

    address: {
      type: String,
      trim: true,
    },

    location: {
      lat: { type: Number, required: true },
      lon: { type: Number, required: true },
    },

    rating: {
      type: Number,
      default: null,
    },

    price: {
      type: String,
      default: "N/A",
    },

    amenities: [String],

    images: [String],

    sourceUrl: {
      type: String,
      trim: true,
    },

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

staySchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 21600 });

const Stay = mongoose.model("Stay", staySchema);
export default Stay;
