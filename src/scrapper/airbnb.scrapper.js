import puppeteer from "puppeteer";

export const scrapeAirbnb = async (city = "Dehradun") => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true, // Run with visible browser
      devtools: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=VizDisplayCompositor",
        "--start-maximized",
      ],
    });

    const page = await browser.newPage();

    // Set realistic user agent and viewport
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to Airbnb search page
    const url = `https://www.airbnb.co.in/s/${encodeURIComponent(
      city
    )}--India/homes`;
    console.log(`Navigating to: ${url}`);

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Handle cookie consent banner
    try {
      await page.waitForSelector('button[data-testid="accept-btn"]', {
        timeout: 5000,
      });
      await page.click('button[data-testid="accept-btn"]');
      console.log("Cookie banner accepted");
    } catch (e) {
      console.log("No cookie banner found or already accepted");
    }

    // Wait for listings to load with multiple attempts
    console.log("Waiting for property listings to load...");
    const selectors = [
      '[data-testid="card-container"]',
      '[data-testid="property-card"]',
      '[itemprop="itemListElement"]',
      'div[data-testid="listing-card-title"]',
    ];

    let foundSelector = null;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        foundSelector = selector;
        console.log(`Found listings with selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`Selector ${selector} not found, trying next...`);
      }
    }

    if (!foundSelector) {
      console.log(
        "No listings found with any selector. Page might not have loaded properly."
      );
      // Take a screenshot to see what's on the page
      await page.screenshot({ path: "debug-no-listings.png", fullPage: true });
      return [];
    }

    // Scroll to load more listings
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Extract listing data with better selectors
    const stays = await page.evaluate((cityName) => {
      // Try multiple possible selectors for listing containers
      const possibleSelectors = [
        '[data-testid="card-container"]',
        '[data-testid="property-card"]',
        '[itemprop="itemListElement"]',
        'div[role="group"]',
        "a[aria-labelledby]",
      ];

      let listings = [];
      for (const selector of possibleSelectors) {
        listings = Array.from(document.querySelectorAll(selector));
        if (listings.length > 0) {
          console.log(
            `Using selector: ${selector}, found ${listings.length} listings`
          );
          break;
        }
      }

      if (listings.length === 0) {
        console.log("No listings found with any selector");
        return [];
      }

      return listings
        .map((card, index) => {
          try {
            // Try multiple selectors for title
            const titleSelectors = [
              '[data-testid="listing-card-title"]',
              'div[data-testid="listing-card-title"]',
              '[aria-hidden="false"]',
              "h3",
              "h4",
              ".t1jojoys",
            ];

            let titleElement = null;
            for (const selector of titleSelectors) {
              titleElement = card.querySelector(selector);
              if (titleElement && titleElement.textContent?.trim()) break;
            }

            // Enhanced price extraction - try multiple approaches
            let priceElement = null;
            let priceText = "";

            // First try: Look for specific price selectors
            const priceSelectors = [
              "span._tyxjp1",
              "span._1p7iugi",
              'span[aria-hidden="true"]',
              "._1y74zjx",
              "span._11jcbg2",
              "div._1jo4hgw",
            ];

            for (const selector of priceSelectors) {
              priceElement = card.querySelector(selector);
              if (priceElement && priceElement.textContent?.trim()) {
                priceText = priceElement.textContent.trim();
                break;
              }
            }

            // Second try: Look for any element containing currency symbols
            if (!priceText) {
              const allSpans = card.querySelectorAll("span, div");
              for (const element of allSpans) {
                const text = element.textContent?.trim() || "";
                if (
                  text &&
                  (text.includes("₹") ||
                    text.includes("$") ||
                    /night/i.test(text))
                ) {
                  priceText = text;
                  priceElement = element;
                  break;
                }
              }
            }

            // Try multiple selectors for rating
            const ratingSelectors = [
              "span.r1dxllyb",
              '[aria-label*="rating"]',
              ".r1dxllyb",
            ];

            let ratingElement = null;
            for (const selector of ratingSelectors) {
              ratingElement = card.querySelector(selector);
              if (ratingElement) break;
            }

            // Also try to find rating by looking for star symbols
            if (!ratingElement) {
              const allSpans = card.querySelectorAll("span");
              for (const span of allSpans) {
                const text = span.textContent || "";
                if (text.includes("★") || text.includes("⭐")) {
                  ratingElement = span;
                  break;
                }
              }
            }

            // Get image
            const imageElement =
              card.querySelector('img[data-testid="listing-card-image"]') ||
              card.querySelector("img") ||
              card.querySelector("picture img");

            // Get link
            const linkElement =
              card.querySelector('a[data-testid="card-container"]') ||
              card.querySelector("a") ||
              card.closest("a");

            // Extract and clean data
            const name = titleElement?.textContent?.trim();
            let price = null;

            // Improved price cleaning
            if (priceText) {
              console.log(
                `Raw price text for listing ${index + 1}: "${priceText}"`
              );

              // Remove currency symbols and extract all numbers
              const numbersOnly = priceText.replace(/[₹$£€,]/g, "");

              // Look for price patterns - numbers followed by common price indicators
              const pricePatterns = [
                /(\d{3,})\s*(?:per|\/|\s)*(?:night|day|stay)/i, // "1234 per night", "1234/night"
                /(\d{4,})/, // Any 4+ digit number (likely a price)
                /(\d{3})/, // 3 digit numbers as fallback
              ];

              let extractedPrice = null;
              for (const pattern of pricePatterns) {
                const match = numbersOnly.match(pattern);
                if (match) {
                  extractedPrice = match[1];
                  break;
                }
              }

              // If no pattern matched, try to extract any number sequence
              if (!extractedPrice) {
                const allNumbers = priceText.match(/\d+/g);
                if (allNumbers) {
                  // Take the largest number (most likely the price)
                  const numbers = allNumbers.map((n) => parseInt(n));
                  extractedPrice = Math.max(...numbers).toString();
                }
              }

              price = extractedPrice;
              console.log(`Cleaned price for listing ${index + 1}: "${price}"`);
            }

            let rating = null;
            if (ratingElement) {
              const ratingText =
                ratingElement.textContent ||
                ratingElement.getAttribute("aria-label") ||
                "";
              const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
              rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
            }

            const imageUrl =
              imageElement?.src || imageElement?.getAttribute("data-src");
            const listingUrl = linkElement?.href;

            // Debug log for first few items
            if (index < 3) {
              console.log(`Listing ${index + 1}:`, {
                name: name,
                rawPrice: priceText,
                cleanPrice: price,
                rating: rating,
                hasImage: !!imageUrl,
                hasUrl: !!listingUrl,
              });
            }

            return {
              id: `airbnb_${index + 1}`,
              name: name || null,
              price: price || null,
              rating: rating,
              images: imageUrl ? [imageUrl] : [],
              type: "airbnb",
              sourceUrl: listingUrl
                ? listingUrl.startsWith("http")
                  ? listingUrl
                  : `https://www.airbnb.co.in${listingUrl}`
                : window.location.href,
              city: cityName,
            };
          } catch (error) {
            console.log(`Error processing listing ${index}:`, error);
            return null;
          }
        })
        .filter((item) => item && item.name); // Filter out invalid entries
    }, city); // Pass city as parameter to the evaluate function

    console.log(`Successfully scraped ${stays.length} Airbnb listings`);
    return stays;
  } catch (error) {
    console.error("Airbnb scrape error:", error.message);

    // Take screenshot for debugging if possible
    if (browser) {
      try {
        const pages = await browser.pages();
        if (pages.length > 0) {
          await pages[0].screenshot({
            path: "debug-airbnb-error.png",
            fullPage: true,
          });
          console.log("Debug screenshot saved as debug-airbnb-error.png");
        }
      } catch (screenshotError) {
        console.log("Could not save debug screenshot");
      }
    }

    return [];
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export default scrapeAirbnb;
