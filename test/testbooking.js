import scrapeBooking from "../src/scrapper/booking .scrapper.js";

(async () => {
  console.log("test started");
  const data = await scrapeBooking();
  console.log(data);
})();
