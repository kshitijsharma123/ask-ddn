import scrapeAirbnb from "../scrapper/airbnb.scrapper.js";
import { getCoordinates } from "./weather.services.js";
import { processStaysData } from "./dataProcess.services.js";

// fetch airbnb data
export const stayService = async (city) => {
  const rawData = await scrapeAirbnb(city);
  console.log(rawData);
  const data = processStaysData(rawData, "airbnb");
  console.log(data);
  //   console.log({ rawData });
  return rawData;
};

// fetch data of hotels
export const fetchHotelFromApi = async (city = "dehradun", radius = 3000) => {
  try {
    const { lat, lon } = await getCoordinates(city);
    console.log(lat, lon);
    return { lat, lon };
  } catch (error) {}
};
