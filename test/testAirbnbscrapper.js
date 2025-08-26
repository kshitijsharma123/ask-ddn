// testAirbnb.js
import { scrapeAirbnb } from "./../src/scrapper/airbnb.scrapper.js";

const testScraper = async () => {
  console.log("🔍 Scraping Airbnb stays...");

  const city = process.argv[2] || "Dehradun"; // pass city via CLI
  const stays = await scrapeAirbnb(city);
  console.log(stays);
  console.log(`\n📍 City: ${city}`);
  console.log(`🏠 Total stays found: ${stays.length}\n`);

  stays.forEach((stay, i) => {
    console.log(`--- Stay #${i + 1} ---`);
    console.log(`Name: ${stay.name}`);
    console.log(`Price: ${stay.price}`);
    console.log(`Rating: ${stay.rating}`);
    console.log(`Image: ${stay.images[0]}`);
    console.log("---------------------------\n");
  });

  console.log("✅ Scraping finished!");
};

testScraper();
