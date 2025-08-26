import scrapeAirbnb from "../scrapper/airbnb.scrapper.js";

export const stayService = async (city) => {
  const rawData = await scrapeAirbnb(city);
  //   console.log({ rawData });
  return rawData;
};
