import puppeteer from "puppeteer";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const CONFIG = {
  headless: true,
  viewport: { width: 1366, height: 768 },
  maxResultsTotal: 1500,
  protocolTimeout: 60000,

  searchStrategies: [
    // Category-based searches
    { query: "hotels in dehradun", type: "category" },
    { query: "resorts dehradun", type: "category" },
    { query: "guest house dehradun", type: "category" },
    { query: "lodges dehradun", type: "category" },
    { query: "homestay dehradun", type: "category" },
    { query: "accommodation dehradun", type: "category" },
    { query: "boutique hotels dehradun", type: "category" },
    { query: "budget hotels dehradun", type: "category" },
    { query: "luxury hotels dehradun", type: "category" },
    { query: "business hotels dehradun", type: "category" },

    // Major area-based searches
    { query: "hotels mussoorie road dehradun", type: "area" },
    { query: "hotels rajpur road dehradun", type: "area" },
    { query: "hotels clement town dehradun", type: "area" },
    { query: "hotels sahastradhara dehradun", type: "area" },
    { query: "hotels malsi deer park dehradun", type: "area" },
    { query: "hotels tapkeshwar dehradun", type: "area" },
    { query: "hotels gandhi park dehradun", type: "area" },
    { query: "hotels clock tower dehradun", type: "area" },

    // Transport hub searches
    { query: "hotels near dehradun railway station", type: "transport" },
    { query: "hotels near jolly grant airport", type: "transport" },
    { query: "hotels isbt dehradun", type: "transport" },

    // Landmark-based searches
    { query: "hotels near forest research institute", type: "landmark" },
    { query: "hotels near mindrolling monastery", type: "landmark" },
    { query: "hotels near robbers cave", type: "landmark" },
  ],

  // Enhanced selectors to catch more hotels
  selectors: {
    cards: [
      "[data-result-index]",
      ".Nv2PK",
      ".lI9IFe",
      '[jsaction*="pane.resultList.click"]',
      ".hfpxzc",
      "[data-cid]", // Additional card selector
      ".section-result", // Another common card selector
    ],
    leftPanel: ['[role="main"]', ".siAUzd-neVct", ".m6QErb", ".DxyBCb"],
    name: [
      ".qBF1Pd",
      ".DUwDvf",
      ".fontHeadlineSmall",
      "a[aria-label]",
      ".NrDZNb",
      "h3",
      ".section-result-title", // Additional name selector
      '[data-value="title"]', // Another name selector
    ],
    address: [
      ".Io6YTe",
      '.W4Efsd:not([aria-label*="₹"])',
      ".rogA2c",
      ".W4Efsd .fontBodyMedium",
      ".lI9IFe .fontBodyMedium",
      ".section-result-location", // Additional address selector
      '.fontBodyMedium:not([aria-label*="₹"])', // General medium text that's not price
    ],
    rating: [
      ".MW4etd",
      ".Yi40Hd",
      ".fontBodyMedium > span[aria-label]",
      ".z3HNkc",
      ".section-result-rating", // Additional rating selector
      'span[role="img"][aria-label*="stars"]', // Star rating
    ],
    // Simplified but comprehensive price selectors
    price: [
      '[aria-label*="₹"]',
      '.W4Efsd[aria-label*="₹"]',
      '.fontBodyMedium[aria-label*="₹"]',
      ".priceText",
      ".price",
      '[data-value*="₹"]',
      ".section-result-price", // Additional price selector
    ],
    link: [
      'a[href*="/place/"]',
      "a[jsaction]",
      "a[data-cid]",
      ".section-result-link", // Additional link selector
    ],
    loadMore: [
      'button[aria-label*="more results"]',
      'button[aria-label*="Show more"]',
      ".n7lv7yjyC35__root",
      'button:contains("Show more")', // Additional load more selector
    ],
  },

  scrollConfig: {
    maxScrollAttempts: 15,
    scrollStep: 1000,
    scrollDelay: 800,
    loadMoreDelay: 2000,
    consecutiveEmptyLimit: 2,
    extractionTimeout: 5000, // Back to reasonable timeout
  },
};

// Simplified and working data extraction
const extractHotelCards = async (page) => {
  try {
    const cards = await Promise.race([
      page.evaluate((selectors) => {
        const results = [];

        // Try each card selector
        for (const cardSelector of selectors.cards) {
          const cardElements = document.querySelectorAll(cardSelector);

          for (const card of cardElements) {
            try {
              // More lenient name extraction to catch more hotels
              let name = null;
              for (const nameSelector of selectors.name) {
                const nameEl = card.querySelector(nameSelector);
                if (nameEl) {
                  name =
                    nameEl.innerText?.trim() ||
                    nameEl.getAttribute("aria-label")?.trim();
                  // More lenient - just check it's not empty and not a rating
                  if (name && name.length > 1 && !name.match(/^\d+\.\d+/))
                    break;
                }
              }

              if (!name) continue;

              // Fixed address extraction - avoid rating data
              let address = null;
              for (const addrSelector of selectors.address) {
                const addrEl = card.querySelector(addrSelector);
                if (addrEl) {
                  const text = addrEl.innerText?.trim();
                  // More strict filtering to avoid rating data
                  if (
                    text &&
                    text.length > 5 &&
                    !text.includes("₹") &&
                    !text.match(/^\d+\.\d+\(\d+\)$/) && // Avoid "4.3(849)" pattern
                    !text.match(/^\d+\.\d+$/) && // Avoid "4.3" pattern
                    (text.includes(",") ||
                      text.includes("Road") ||
                      text.includes("Near") ||
                      text.includes("Dehradun"))
                  ) {
                    address = text;
                    break;
                  }
                }
              }

              // Improved rating extraction
              let rating = null;
              for (const ratingSelector of selectors.rating) {
                const ratingEl = card.querySelector(ratingSelector);
                if (ratingEl) {
                  let text =
                    ratingEl.innerText?.trim() ||
                    ratingEl.getAttribute("aria-label")?.trim();
                  if (text && /\d+\.?\d*/.test(text)) {
                    // Extract just the rating number (e.g., "4.3" from "4.3(849)")
                    const ratingMatch = text.match(/(\d+\.?\d*)/);
                    if (ratingMatch) {
                      rating = ratingMatch[1];
                      break;
                    }
                  }
                }
              }

              // Fixed price extraction - extract clean price only
              let price = null;
              let priceSource = null;

              // Try direct price selectors first
              for (const priceSelector of selectors.price) {
                const priceEl = card.querySelector(priceSelector);
                if (priceEl) {
                  const text =
                    priceEl.innerText?.trim() ||
                    priceEl.getAttribute("aria-label")?.trim();
                  if (text && text.includes("₹")) {
                    // Extract clean price using regex
                    const priceMatch = text.match(/₹[\s]?([0-9,]+)/);
                    if (priceMatch) {
                      price = `₹${priceMatch[1]}`;
                      priceSource = priceSelector;
                      break;
                    }
                  }
                }
              }

              // If no direct price found, look for rupee symbol in small text elements
              if (!price) {
                const smallElements = card.querySelectorAll("span, div");
                for (const el of smallElements) {
                  const text = el.innerText?.trim();
                  if (text && text.includes("₹") && text.length < 20) {
                    // Short price text only
                    const priceMatch = text.match(/₹[\s]?([0-9,]+)/);
                    if (
                      priceMatch &&
                      !text.toLowerCase().includes("road") &&
                      !text.toLowerCase().includes("street") &&
                      !text.toLowerCase().includes("rating") &&
                      !text.toLowerCase().includes("reviews")
                    ) {
                      price = `₹${priceMatch[1]}`;
                      priceSource = "fallback_search";
                      break;
                    }
                  }
                }
              }

              // Look for booking platform links
              const bookingLinks = [];
              const bookingSelectors = [
                'a[href*="booking.com"]',
                'a[href*="agoda.com"]',
                'a[href*="makemytrip.com"]',
                'a[href*="goibibo.com"]',
                'a[href*="trivago.com"]',
              ];

              for (const bookingSelector of bookingSelectors) {
                const bookingEl = card.querySelector(bookingSelector);
                if (bookingEl && bookingEl.href) {
                  const platform = bookingEl.href.includes("booking.com")
                    ? "Booking.com"
                    : bookingEl.href.includes("agoda.com")
                    ? "Agoda"
                    : bookingEl.href.includes("makemytrip.com")
                    ? "MakeMyTrip"
                    : bookingEl.href.includes("goibibo.com")
                    ? "Goibibo"
                    : "Other";

                  bookingLinks.push({
                    platform: platform,
                    url: bookingEl.href,
                    text: bookingEl.textContent?.trim(),
                  });
                }
              }

              // Link extraction
              let link = null;
              for (const linkSelector of selectors.link) {
                const linkEl = card.querySelector(linkSelector);
                if (linkEl && linkEl.href) {
                  link = linkEl.href;
                  break;
                }
              }

              // Fixed coordinate extraction
              let coordinates = null;
              if (link) {
                // Try multiple coordinate patterns in Google Maps URLs
                let coordMatch = link.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
                if (!coordMatch) {
                  coordMatch = link.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
                }
                if (!coordMatch) {
                  coordMatch = link.match(/ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
                }

                if (coordMatch) {
                  coordinates = {
                    lat: parseFloat(coordMatch[1]),
                    lng: parseFloat(coordMatch[2]),
                  };
                }
              }

              results.push({
                name,
                address,
                rating,
                price,
                priceSource,
                bookingLinks,
                link,
                coordinates,
              });
            } catch (error) {
              // Skip problematic cards
              continue;
            }
          }

          if (results.length > 0) break; // Use first successful selector
        }

        return results;
      }, CONFIG.selectors),

      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Extraction timeout")),
          CONFIG.scrollConfig.extractionTimeout
        )
      ),
    ]);

    return cards.filter((card) => card.name && card.name.length > 2);
  } catch (error) {
    console.warn("   ⚠️  Extraction failed:", error.message);
    return [];
  }
};

// Fixed scrolling function
const performFastScroll = async (page, strategy) => {
  const {
    maxScrollAttempts,
    scrollStep,
    scrollDelay,
    loadMoreDelay,
    consecutiveEmptyLimit,
  } = CONFIG.scrollConfig;

  let scrollAttempts = 0;
  let consecutiveEmpty = 0;
  let allResults = [];
  let loadMoreClickCount = 0;
  const maxLoadMoreClicks = 3;
  const seenHotels = new Set();

  console.log(`   🔄 Starting scroll for: ${strategy.query}`);

  while (
    scrollAttempts < maxScrollAttempts &&
    consecutiveEmpty < consecutiveEmptyLimit
  ) {
    const beforeCount = allResults.length;

    try {
      // Extract current cards
      const currentCards = await extractHotelCards(page);

      // Add unique cards
      for (const card of currentCards) {
        const uniqueKey = card.link || `${card.name}_${card.address}`;
        if (!seenHotels.has(uniqueKey)) {
          seenHotels.add(uniqueKey);
          allResults.push({
            ...card,
            searchStrategy: strategy.type,
            searchQuery: strategy.query,
            extractedAt: new Date().toISOString(),
          });
        }
      }

      // Try "Show more" button
      let loadMoreClicked = false;
      if (loadMoreClickCount < maxLoadMoreClicks) {
        try {
          loadMoreClicked = await Promise.race([
            page.evaluate((selectors) => {
              for (const selector of selectors.loadMore) {
                const button = document.querySelector(selector);
                if (
                  button &&
                  button.offsetParent !== null &&
                  !button.disabled
                ) {
                  button.click();
                  return true;
                }
              }
              return false;
            }, CONFIG.selectors),
            new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
          ]);
        } catch (error) {
          loadMoreClicked = false;
        }
      }

      if (loadMoreClicked) {
        loadMoreClickCount++;
        console.log(
          `   📋 Clicked "Show more" (${loadMoreClickCount}/${maxLoadMoreClicks})`
        );
        await delay(loadMoreDelay);
        continue;
      }

      // Scroll down
      try {
        const scrollResult = await Promise.race([
          page.evaluate(
            (selectors, step) => {
              // Try left panel first
              for (const panelSelector of selectors.leftPanel) {
                const panel = document.querySelector(panelSelector);
                if (panel) {
                  const before = panel.scrollTop;
                  panel.scrollBy(0, step);
                  if (panel.scrollTop > before) {
                    return { success: true, type: "panel" };
                  }
                }
              }
              // Fallback to window
              const before = window.pageYOffset;
              window.scrollBy(0, step);
              return { success: window.pageYOffset > before, type: "window" };
            },
            CONFIG.selectors,
            scrollStep
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Scroll timeout")), 3000)
          ),
        ]);

        if (!scrollResult.success) {
          consecutiveEmpty++;
        }
      } catch (error) {
        console.log(`   ⚠️  Scroll timeout`);
      }

      await delay(scrollDelay);

      // Check progress
      const newResultsCount = allResults.length - beforeCount;
      if (newResultsCount === 0) {
        consecutiveEmpty++;
        console.log(
          `   ⚠️  No new results (${consecutiveEmpty}/${consecutiveEmptyLimit})`
        );
      } else {
        consecutiveEmpty = 0;
        console.log(
          `   ✅ Found ${newResultsCount} new hotels (total: ${allResults.length})`
        );
      }

      scrollAttempts++;

      // Stop if enough results
      if (allResults.length >= CONFIG.maxResultsTotal) {
        console.log("   🎯 Reached maximum results");
        break;
      }
    } catch (error) {
      console.error(`   ❌ Scroll attempt failed: ${error.message}`);
      scrollAttempts++;
    }
  }

  console.log(`   📊 Completed: ${allResults.length} hotels`);
  return allResults;
};

// Main Function
export const scrapeAllHotelsDehradun = async () => {
  console.log("🚀 Fixed Dehradun Hotels Scraper Starting...");
  console.log(`🔍 Using ${CONFIG.searchStrategies.length} search strategies`);
  console.log(`⚡ Max results: ${CONFIG.maxResultsTotal}`);

  const browser = await puppeteer.launch({
    headless: CONFIG.headless,
    protocolTimeout: CONFIG.protocolTimeout,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=VizDisplayCompositor",
      "--disable-web-security",
      "--disable-dev-shm-usage",
      "--disable-extensions",
    ],
    defaultViewport: CONFIG.viewport,
  });

  const page = await browser.newPage();

  // Optimize page settings
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });

  // Minimal request blocking - only block images
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.resourceType() === "image") {
      req.abort();
    } else {
      req.continue();
    }
  });

  const allResults = [];
  const globalSeenHotels = new Set();
  let startTime = Date.now();

  // Process each search strategy
  for (let i = 0; i < CONFIG.searchStrategies.length; i++) {
    const strategy = CONFIG.searchStrategies[i];
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(
      `\n🔍 Strategy ${i + 1}/${CONFIG.searchStrategies.length}: ${
        strategy.query
      } (${strategy.type}) [${elapsed}min]`
    );

    try {
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(
        strategy.query
      )}`;

      console.log("   📡 Loading Google Maps...");
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });

      // Wait for results to load
      await delay(2000);

      // Scroll and collect results
      const strategyResults = await performFastScroll(page, strategy);

      // Add unique results
      let newUnique = 0;
      for (const hotel of strategyResults) {
        const globalKey = hotel.link || `${hotel.name}_${hotel.address}`;
        if (!globalSeenHotels.has(globalKey)) {
          globalSeenHotels.add(globalKey);
          allResults.push(hotel);
          newUnique++;
        }
      }

      console.log(
        `   ✨ Added ${newUnique} unique hotels (Global total: ${allResults.length})`
      );

      // Stop if enough results
      if (allResults.length >= CONFIG.maxResultsTotal) {
        console.log("🎯 Reached maximum results across all strategies");
        break;
      }

      // Delay between strategies
      await delay(1000);
    } catch (error) {
      console.error(`   ❌ Strategy failed: ${error.message}`);
      continue;
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n✅ Scraping completed in ${totalTime} minutes!`);
  console.log(`🏨 Total unique hotels found: ${allResults.length}`);

  // Pricing analysis
  const pricingStats = {
    withPrice: 0,
    withBookingLinks: 0,
    noPricing: 0,
  };

  allResults.forEach((hotel) => {
    if (hotel.price) pricingStats.withPrice++;
    if (hotel.bookingLinks?.length > 0) pricingStats.withBookingLinks++;
    if (
      !hotel.price &&
      (!hotel.bookingLinks || hotel.bookingLinks.length === 0)
    )
      pricingStats.noPricing++;
  });

  console.log("\n💰 Pricing Analysis:");
  console.table(pricingStats);

  // Show hotels with pricing
  const hotelsWithPricing = allResults.filter(
    (hotel) =>
      hotel.price || (hotel.bookingLinks && hotel.bookingLinks.length > 0)
  );

  console.log(
    `\n🏨 ====== HOTELS WITH PRICING INFO (${hotelsWithPricing.length} found) ======`
  );

  hotelsWithPricing.forEach((hotel, index) => {
    console.log(`\n💰 Hotel ${index + 1}:`);
    console.log(`   Name: ${hotel.name}`);
    console.log(`   Address: ${hotel.address || "N/A"}`);
    console.log(`   Rating: ${hotel.rating || "N/A"}`);

    if (hotel.price) {
      console.log(`   💵 Price: ${hotel.price} (via ${hotel.priceSource})`);
    }

    if (hotel.bookingLinks?.length > 0) {
      console.log(`   🔗 Booking Options:`);
      hotel.bookingLinks.forEach((link) => {
        console.log(`     - ${link.platform}: ${link.url}`);
      });
    }

    console.log(`   📍 Link: ${hotel.link || "N/A"}`);
    console.log(
      `   🎯 Found via: ${hotel.searchStrategy} - "${hotel.searchQuery}"`
    );
  });

  console.log("\n💾 ====== COMPLETE JSON DATA ======");
  console.log(JSON.stringify(allResults, null, 2));

  await browser.close();
  return allResults;
};
