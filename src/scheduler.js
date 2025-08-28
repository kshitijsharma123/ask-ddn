import cron from "node-cron";
import { scrapeAirbnb } from "./../src/scrapper/airbnb.scrapper.js";
import {} from "./scrapper/googleMaps.scrapper.js";

cron.schedule("* * * * *", () => {
  console.log("running a task every minute");
});
