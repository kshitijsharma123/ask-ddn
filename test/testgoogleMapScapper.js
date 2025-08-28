import { scrapeAllHotelsDehradun } from "./../src/scrapper/googleMaps.scrapper.js";
import fs from "fs";
const testGoogleScarpper = async () => {
  const data = await scrapeAllHotelsDehradun();
  const filename = "dehraunHotels.json";
  fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  console.log("result is stored in the file ", data.length, filename);
};

testGoogleScarpper();
