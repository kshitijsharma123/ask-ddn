import puppeteer from "puppeteer";

export const scrapeBooking = async (
  city = "Dehradun",
  options = { maxResults: 200, maxPages: 8, headless: true, rowsPerPage: 25 }
) => {
  const {
    maxResults,
    maxPages,
    headless,
    rowsPerPage,
    checkInDate,
    checkOutDate,
  } = options;
  const results = [];
  let browser;

  // Helper to get tomorrow and day after tomorrow
  const getTomorrowDates = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    // Format: YYYY-MM-DD
    const formatDate = (date) => {
      return date.toISOString().split("T")[0];
    };

    return {
      checkIn: formatDate(tomorrow),
      checkOut: formatDate(dayAfterTomorrow),
    };
  };

  // Use provided dates or default to tomorrow/day after
  const dates = getTomorrowDates();
  const finalCheckIn = checkInDate || dates.checkIn;
  const finalCheckOut = checkOutDate || dates.checkOut;

  console.log(
    `🗓️  Using dates: Check-in: ${finalCheckIn}, Check-out: ${finalCheckOut}`
  );

  // small helper (Puppeteer v21+ compatible)
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    browser = await puppeteer.launch({
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=VizDisplayCompositor",
      ],
    });

    const page = await browser.newPage();

    // headers + ua for basic bot avoidance
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9",
    });
    await page.setViewport({ width: 1280, height: 900 });

    // Enhanced base search with check-in/check-out dates
    const baseSearch = (cityName, offset = 0) => {
      const params = new URLSearchParams({
        ss: cityName,
        checkin: finalCheckIn,
        checkout: finalCheckOut,
        rows: rowsPerPage.toString(),
        offset: offset.toString(),
        group_adults: "2", // Default 2 adults
        no_rooms: "1", // 1 room
        group_children: "0", // No children
      });

      return `https://www.booking.com/searchresults.html?${params.toString()}`;
    };

    let pageIndex = 0;
    let offset = 0;

    while (results.length < maxResults && pageIndex < maxPages) {
      const url = baseSearch(city, offset);
      console.log(
        `🔎 Loading page ${pageIndex + 1} -> ${url.substring(0, 100)}...`
      );

      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      } catch (e) {
        console.warn(
          `⚠️ Navigation timeout on page ${pageIndex + 1}, retrying...`
        );
        try {
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
        } catch (e2) {
          console.error(`❌ Failed to load page ${pageIndex + 1}, skipping...`);
          break;
        }
      }

      // Wait for property cards to load
      const cardSelectorFallbacks = [
        '[data-testid="property-card"]',
        ".sr_property_block",
        ".fcab3ed991",
        ".sr_item",
        '[data-testid="property-card-container"]',
      ];

      let found = false;
      for (const sel of cardSelectorFallbacks) {
        try {
          await page.waitForSelector(sel, { timeout: 15000 });
          found = true;
          console.log(`✅ Found cards with selector: ${sel}`);
          break;
        } catch {}
      }

      if (!found) {
        console.warn(
          "⚠️ No property cards found on this page. Stopping pagination."
        );
        break;
      }

      // Wait extra time for prices to load (they load via AJAX after dates are processed)
      console.log("⏳ Waiting for prices to load...");
      await sleep(4000);

      // Try to wait for price elements specifically
      const priceSelectors = [
        '[data-testid="price-and-discounted-price"]',
        '[data-testid="price"]',
        ".bui-price-display__value",
        ".prco-valign-middle-helper",
        ".sr_price_wrap",
        'span:contains("₹")',
      ];

      for (const priceSelector of priceSelectors) {
        try {
          await page.waitForSelector(priceSelector, { timeout: 5000 });
          console.log(`💰 Found prices with selector: ${priceSelector}`);
          break;
        } catch {}
      }

      // Scroll to trigger lazy loading and wait for dynamic content
      console.log("📜 Scrolling to load all content...");
      const maxScrollRounds = 6;
      for (let i = 0; i < maxScrollRounds; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
        await sleep(1500);
      }

      // Additional wait for all dynamic content to load
      await sleep(3000);

      // Extract cards with enhanced price detection
      const hotelsOnPage = await page.evaluate(() => {
        // helpers
        const pickText = (el) => (el ? el.textContent.trim() : null);
        const ensureAbsolute = (href) => {
          if (!href) return null;
          try {
            return href.startsWith("http")
              ? href
              : new URL(href, "https://www.booking.com").href;
          } catch {
            return href;
          }
        };

        // Find property cards
        const cardSelectors = [
          '[data-testid="property-card"]',
          '[data-testid="property-card-container"]',
          ".sr_property_block",
          ".sr_item",
          ".sr_item_content",
        ];

        let cards = [];
        for (const sel of cardSelectors) {
          const found = Array.from(document.querySelectorAll(sel));
          if (found && found.length) {
            cards = found;
            console.log(`Found ${found.length} cards with ${sel}`);
            break;
          }
        }

        const results = [];
        cards.forEach((card, index) => {
          try {
            // Name extraction
            const nameCandidates = [
              card.querySelector('[data-testid="title"]'),
              card.querySelector('[data-testid="title-link"]'),
              card.querySelector(".fcab3ed991"),
              card.querySelector("h3 a"),
              card.querySelector("h2 a"),
              card.querySelector(".sr-hotel__name a"),
              card.querySelector("h3"),
              card.querySelector("h2"),
            ];
            const nameEl = nameCandidates.find(Boolean);
            const name = nameEl ? pickText(nameEl) : null;

            // Enhanced price extraction for Indian market
            let priceText = null;
            let priceValue = null;

            // Strategy 1: Modern Booking.com price selectors (2024/2025)
            const priceSelectors = [
              '[data-testid="price-and-discounted-price"]',
              '[data-testid="price"]',
              '[data-testid="price-for-x-nights"]',
              ".bui-price-display__value",
              ".bui-price-display__label",
              ".sr_price_wrap .sr_price",
              ".prco-inline-block",
              ".prco-valign-middle-helper",
              ".sr-hotel__price",
              ".bui-f-font-strong_1",
              ".e4755bbd60",
              ".a78ca197d0",
              'span[aria-label*="price"]',
              'span[role="text"]',
            ];

            // Try each price selector
            for (const selector of priceSelectors) {
              try {
                const elements = card.querySelectorAll(selector);
                for (const el of elements) {
                  const text = pickText(el);
                  if (text && text.length < 50) {
                    // Match Indian currency formats
                    const priceMatches = [
                      text.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/),
                      text.match(/Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/),
                      text.match(/INR\s*([\d,]+(?:\.\d{1,2})?)/),
                      text.match(/^([\d,]+(?:\.\d{1,2})?)$/),
                    ];

                    for (const match of priceMatches) {
                      if (match && match[1]) {
                        const numValue = parseFloat(match[1].replace(/,/g, ""));
                        if (numValue >= 300 && numValue <= 100000) {
                          // Reasonable hotel price range
                          priceText = text;
                          priceValue = numValue;
                          break;
                        }
                      }
                    }
                    if (priceText) break;
                  }
                }
                if (priceText) break;
              } catch (e) {}
            }

            // Strategy 2: Search all text for price patterns if not found
            if (!priceText) {
              try {
                const allText = card.innerText || card.textContent || "";
                const lines = allText
                  .split(/\n|\s+/)
                  .map((line) => line.trim())
                  .filter(Boolean);

                for (const line of lines) {
                  if (line.length < 20) {
                    // Enhanced Indian price patterns
                    const patterns = [
                      /^₹\s*([\d,]+(?:\.\d{1,2})?)$/,
                      /^Rs\.?\s*([\d,]+(?:\.\d{1,2})?)$/,
                      /^INR\s*([\d,]+(?:\.\d{1,2})?)$/,
                      /^([\d,]+)\s*₹?$/,
                      /^([\d]{1,2},\d{3,})$/,
                    ];

                    for (const pattern of patterns) {
                      const match = line.match(pattern);
                      if (match) {
                        const numStr = match[1] || match[0];
                        const numValue = parseFloat(
                          numStr.replace(/[₹Rs.,\s]/g, "")
                        );
                        if (numValue >= 300 && numValue <= 100000) {
                          priceText = line;
                          priceValue = numValue;
                          break;
                        }
                      }
                    }
                    if (priceText) break;
                  }
                }
              } catch (e) {}
            }

            // Strategy 3: Look for any reasonable number that could be a price
            if (!priceText) {
              try {
                const numbers = (card.innerText || "").match(
                  /\b\d{1,2}[,\d]{3,}\b|\b\d{4,}\b/g
                );
                if (numbers) {
                  for (const num of numbers) {
                    const numValue = parseInt(num.replace(/,/g, ""));
                    if (numValue >= 500 && numValue <= 50000) {
                      priceText = `₹${num}`;
                      priceValue = numValue;
                      break;
                    }
                  }
                }
              } catch (e) {}
            }

            // Rating extraction
            const ratingCandidates = [
              card.querySelector('[data-testid="review-score"]'),
              card.querySelector('[aria-label*="Scored"]'),
              card.querySelector(".bui-review-score__badge"),
              card.querySelector(".review_score_value"),
              card.querySelector('[data-testid="review-score-badge"]'),
            ];

            let rating = null;
            for (const ratingEl of ratingCandidates) {
              if (ratingEl) {
                const ratingText = pickText(ratingEl);
                if (ratingText) {
                  const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
                  if (ratingMatch) {
                    rating = parseFloat(ratingMatch[1]);
                    break;
                  }
                }
              }
            }

            // Location extraction
            const locationCandidates = [
              card.querySelector('[data-testid="address"]'),
              card.querySelector('[data-testid="location"]'),
              card.querySelector(".sr_card_address_line"),
              card.querySelector(".hotel_address"),
              card.querySelector('[data-testid="distance"]'),
            ];

            let location = null;
            for (const locEl of locationCandidates) {
              if (locEl) {
                location = pickText(locEl);
                if (location && location.length > 3) break;
              }
            }

            // Image extraction
            const imgCandidates = [
              card.querySelector('img[data-testid="image"]'),
              card.querySelector(".hotel_image img"),
              card.querySelector("img"),
            ];

            let image = null;
            for (const img of imgCandidates) {
              if (img) {
                image =
                  img.currentSrc ||
                  img.src ||
                  img.getAttribute("data-src") ||
                  img.getAttribute("data-lazy-src");
                if (image && image.includes("http")) break;
              }
            }

            // Link extraction
            const linkCandidates = [
              card.querySelector('[data-testid="title-link"]'),
              card.querySelector("h3 a"),
              card.querySelector("h2 a"),
              card.querySelector('a[href*="/hotel/"]'),
              card.querySelector("a"),
            ];

            let sourceUrl = null;
            for (const link of linkCandidates) {
              if (link && link.href) {
                sourceUrl = ensureAbsolute(link.href);
                if (sourceUrl && sourceUrl.includes("booking.com")) break;
              }
            }

            // Only add if we have essential data
            if (name && sourceUrl) {
              const result = {
                name: name.substring(0, 200), // Limit length
                price: priceText,
                priceValue: priceValue,
                rating,
                location: location ? location.substring(0, 150) : null,
                image,
                sourceUrl,
                type: "hotel",
              };

              results.push(result);
              console.log(
                `Extracted: ${name} - ${priceText || "No price"} - Rating: ${
                  rating || "N/A"
                }`
              );
            }
          } catch (e) {
            console.error(`Error parsing card ${index}:`, e.message);
          }
        });

        return results;
      });

      // Add unique results
      let newResults = 0;
      for (const hotel of hotelsOnPage) {
        if (!hotel.sourceUrl) continue;

        const exists = results.find((r) => r.sourceUrl === hotel.sourceUrl);
        if (!exists) {
          results.push(hotel);
          newResults++;
        }

        if (results.length >= maxResults) break;
      }

      console.log(
        `  → Found ${hotelsOnPage.length} hotels on page, ${newResults} new unique results`
      );
      console.log(
        `  → Total collected so far: ${results.length}/${maxResults}`
      );

      // Show price statistics
      const withPrices = results.filter((r) => r.price);
      console.log(
        `  → Hotels with prices: ${withPrices.length}/${results.length}`
      );

      // Break if we found enough results or no new results on this page
      if (results.length >= maxResults || newResults === 0) {
        break;
      }

      // Move to next page
      pageIndex += 1;
      offset = pageIndex * rowsPerPage;

      // Polite delay between pages
      await sleep(2000 + Math.floor(Math.random() * 1000));
    }

    // Final statistics
    const withPrices = results.filter((r) => r.price);
    const avgPrice =
      withPrices.length > 0
        ? withPrices.reduce((sum, r) => sum + (r.priceValue || 0), 0) /
          withPrices.length
        : 0;

    console.log(`✅ Scraping completed!`);
    console.log(`   📊 Total results: ${results.length}`);
    console.log(
      `   💰 Hotels with prices: ${withPrices.length} (${Math.round(
        (withPrices.length / results.length) * 100
      )}%)`
    );
    console.log(`   📈 Average price: ₹${Math.round(avgPrice)}`);
    console.log(`   🗓️  Dates used: ${finalCheckIn} to ${finalCheckOut}`);

    return {
      data: results.slice(0, maxResults),
      total: results.length,
      stats: {
        withPrices: withPrices.length,
        avgPrice: Math.round(avgPrice),
        checkIn: finalCheckIn,
        checkOut: finalCheckOut,
      },
    };
  } catch (err) {
    console.error("❌ Booking.com scrape error:", err);
    return { data: [], total: 0, stats: null };
  } finally {
    if (browser) await browser.close();
  }
};

export default scrapeBooking;
