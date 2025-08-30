import { scrapeInstagramTagPlacesNoSave } from "./../src/scrapper/instagram.scrapper.js";

// ✅ CORRECT WAY - Pass username and password as named properties
const result = await scrapeInstagramTagPlacesNoSave({
  username: "askdnnai", // ← Named property
  password: "freedo12", // ← Named property
  tag: "dehradun",
  maxPosts: 100,
  maxScrolls: 10,
  headless: false,
  delay: 1500,
});

console.log("Top trending places in Dehradun:");
result.places.slice(0, 10).forEach((place, i) => {
  console.log(
    `${i + 1}. ${place.name} - ${place.mentions} mentions, ${
      place.avgLikes
    } avg likes`
  );
});

// Alternative: Using environment variables (recommended for security)
// Set these in your .env file:
// INSTAGRAM_USERNAME=askdnnai
// INSTAGRAM_PASSWORD=freedo12

const resultWithEnv = await scrapeInstagramTagPlacesNoSave({
  username: process.env.INSTAGRAM_USERNAME,
  password: process.env.INSTAGRAM_PASSWORD,
  tag: "dehradun",
  maxPosts: 100,
  maxScrolls: 10,
  headless: false, // Set to false for debugging
  delay: 1500,
});

// Enhanced results display
console.log("\n🏆 TOP TRENDING PLACES IN DEHRADUN:");
console.log("=" * 50);

if (resultWithEnv.places.length === 0) {
  console.log(
    "❌ No places found. Check if the hashtag exists or login was successful."
  );
} else {
  resultWithEnv.places.slice(0, 15).forEach((place, i) => {
    console.log(`${i + 1}. 📍 ${place.name}`);
    console.log(`   👥 ${place.mentions} mentions`);
    console.log(`   ❤️  ${place.avgLikes} avg likes`);
    console.log(`   💬 ${place.avgComments} avg comments`);
    console.log(`   🏆 Popularity: ${place.popularity}`);
    console.log(`   🔗 Examples: ${place.examples.slice(0, 2).join(", ")}`);
    console.log("");
  });
}

// Display summary statistics
console.log("\n📊 SCRAPING SUMMARY:");
console.log(`Posts scraped: ${resultWithEnv.meta.scrapedPosts}`);
console.log(`Successful extractions: ${resultWithEnv.meta.successfulPosts}`);
console.log(`Success rate: ${resultWithEnv.meta.successRate}%`);
console.log(`Places found: ${resultWithEnv.meta.extractedPlaces}`);
console.log(`Timestamp: ${resultWithEnv.meta.timestamp}`);

// Export results to JSON file (optional)
import fs from "fs";
const filename = `dehradun_places_${
  new Date().toISOString().split("T")[0]
}.json`;
fs.writeFileSync(filename, JSON.stringify(resultWithEnv, null, 2));
console.log(`\n💾 Results saved to: ${filename}`);
