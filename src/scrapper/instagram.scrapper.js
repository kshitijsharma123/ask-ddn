import puppeteer from "puppeteer";

const USER_AGENT =
  process.env.SCRAPER_USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (min = 800, max = 2000) =>
  Math.floor(Math.random() * (max - min + 1) + min);

function parseCount(s) {
  if (!s && s !== 0) return 0;
  if (typeof s === "number") return s;

  s = String(s)
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\s+/g, "")
    .replace(/likes?/gi, "")
    .replace(/views?/gi, "")
    .replace(/others?/gi, "");

  if (!s) return 0;

  try {
    // Handle formats like "1.2k", "5.5m", "10k", "2m"
    if (s.includes("k")) {
      return Math.round(parseFloat(s.replace("k", "")) * 1000);
    }
    if (s.includes("m")) {
      return Math.round(parseFloat(s.replace("m", "")) * 1000000);
    }

    // Extract pure numbers
    const numMatch = s.match(/[\d.]+/);
    if (numMatch) {
      return Math.round(parseFloat(numMatch[0]));
    }

    return 0;
  } catch (e) {
    console.warn(`Failed to parse count: "${s}"`);
    return 0;
  }
}

// Enhanced login function with better error handling
async function loginToInstagram(page, username, password) {
  console.log("🔐 Logging into Instagram...");

  try {
    await page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for login form
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    await sleep(rnd(1000, 2000));

    // Clear and type credentials slowly
    await page.click('input[name="username"]');
    await page.evaluate(
      () => (document.querySelector('input[name="username"]').value = "")
    );
    await page.type('input[name="username"]', username, { delay: 100 });
    await sleep(rnd(500, 1000));

    await page.click('input[name="password"]');
    await page.evaluate(
      () => (document.querySelector('input[name="password"]').value = "")
    );
    await page.type('input[name="password"]', password, { delay: 100 });
    await sleep(rnd(500, 1000));

    // Submit login
    const submitButton = await page.$(
      'button[type="submit"], button._acan._acap._acas._aj1-'
    );
    if (!submitButton) {
      throw new Error("Login submit button not found");
    }

    await Promise.all([
      submitButton.click(),
      page
        .waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 30000,
        })
        .catch(() => console.log("Navigation timeout, continuing...")),
    ]);

    await sleep(rnd(2000, 3000));

    // Handle common post-login dialogs
    const dialogSelectors = [
      "//button[contains(text(), 'Not Now')]",
      "//button[contains(text(), 'Not now')]",
      "//button[contains(text(), 'Maybe Later')]",
      "//button[contains(text(), 'Skip')]",
      'button[class*="sqdOP"]', // Common dialog button class
    ];

    for (const selector of dialogSelectors) {
      try {
        let elements;
        if (selector.startsWith("//")) {
          elements = await page.$x(selector);
        } else {
          const element = await page.$(selector);
          elements = element ? [element] : [];
        }

        if (elements.length > 0) {
          await elements[0].click();
          console.log("✅ Dismissed dialog");
          await sleep(1500);
        }
      } catch (e) {
        // Continue if dialog not found
      }
    }

    // Verify login success
    await sleep(2000);
    const currentUrl = page.url();

    if (
      currentUrl.includes("/accounts/login") ||
      currentUrl.includes("/challenge")
    ) {
      throw new Error(
        "Login failed - still on login page or challenge required"
      );
    }

    // Try accessing a protected page to confirm login
    try {
      await page.goto("https://www.instagram.com/", {
        waitUntil: "networkidle2",
        timeout: 20000,
      });

      // Look for authenticated user indicators
      const authIndicators = [
        'svg[aria-label="Home"]',
        'a[href="/"]',
        'div[role="menuitem"]',
      ];

      let isLoggedIn = false;
      for (const indicator of authIndicators) {
        try {
          await page.waitForSelector(indicator, { timeout: 3000 });
          isLoggedIn = true;
          break;
        } catch {}
      }

      if (!isLoggedIn) {
        throw new Error("Login verification failed");
      }
    } catch (e) {
      throw new Error(`Login verification failed: ${e.message}`);
    }

    console.log("✅ Successfully logged into Instagram");
    return true;
  } catch (error) {
    console.error("❌ Instagram login failed:", error.message);
    throw error;
  }
}

// Enhanced post data extraction
async function extractPostData(page, url) {
  try {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 25000,
    });
    await sleep(rnd(1000, 2000));

    const postData = await page.evaluate(() => {
      // Enhanced location detection with multiple fallbacks
      const locationSelectors = [
        'a[href*="/explore/locations/"]',
        'header a[href*="/explore/locations/"]',
        'div[class*="_aaqm"] a[href*="/explore/locations/"]',
        'span._aaqm a[href*="/explore/locations/"]',
        'div[role="button"] + div a[href*="/explore/locations/"]',
      ];

      let place = null;
      for (const selector of locationSelectors) {
        const locElement = document.querySelector(selector);
        if (locElement && locElement.textContent.trim()) {
          place = locElement.textContent.trim();
          break;
        }
      }

      // Enhanced caption extraction
      const captionSelectors = [
        "article div._a9zs h1", // New Instagram layout
        "article div.C4VMK span", // Old layout
        "article div._a9zr span",
        'div[data-testid="post-caption"] span',
        'article span[dir="auto"]',
        'article div[role="button"] + div span',
      ];

      let caption = "";
      for (const selector of captionSelectors) {
        const captionEl = document.querySelector(selector);
        if (captionEl && captionEl.textContent) {
          caption = captionEl.textContent.trim().slice(0, 500);
          break;
        }
      }

      // Enhanced likes/views detection
      const likesSelectors = [
        "article section div button span", // New like count location
        "section div.Nm9 span",
        'section div[class*="Nm9"] span',
        'article section span[class*="_aacl"]',
        'button span[class*="_aacl"]',
        "section button span",
        "article section div span",
      ];

      let likesText = "";
      for (const selector of likesSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent || el.innerText || "";
          // Look for text that contains numbers and like-related words
          if (
            text &&
            /\d/.test(text) &&
            (/like/i.test(text) ||
              /view/i.test(text) ||
              /\d+[km]?\s*$/.test(text.trim()) ||
              /^\d+[,.]?\d*[km]?$/.test(text.trim()))
          ) {
            likesText = text;
            break;
          }
        }
        if (likesText) break;
      }

      // Enhanced comments count - try multiple approaches
      let comments = 0;

      // Method 1: Count comment list items
      const commentsList = document.querySelector('ul[role="list"]');
      if (commentsList) {
        const commentItems = commentsList.querySelectorAll(
          'li[role="menuitem"]'
        );
        comments = Math.max(0, commentItems.length - 1); // -1 for caption
      }

      // Method 2: Look for "View all X comments" text
      if (comments === 0) {
        const viewCommentsText = document.body.textContent;
        const commentMatch = viewCommentsText.match(
          /View all (\d+) comments?/i
        );
        if (commentMatch) {
          comments = parseInt(commentMatch[1]);
        }
      }

      // Method 3: Count visible comment elements
      if (comments === 0) {
        const commentElements = document.querySelectorAll(
          'div[role="button"][tabindex="0"] span[dir="auto"]'
        );
        comments = Math.max(0, commentElements.length - 2); // Exclude caption and other elements
      }

      return {
        place,
        caption,
        likesText: likesText.trim(),
        comments,
      };
    });

    const likes = parseCount(postData.likesText);
    const comments = Math.max(0, postData.comments || 0);

    return {
      postUrl: url,
      place: postData.place,
      caption: postData.caption,
      likes,
      comments,
      score: likes + 3 * comments, // Comments are more valuable for engagement
      rawLikesText: postData.likesText,
    };
  } catch (error) {
    console.warn(`Failed to extract data from ${url}: ${error.message}`);
    return null;
  }
}

export async function scrapeInstagramTagPlacesNoSave({
  username,
  password,
  tag = "dehradun",
  maxScrolls = 8,
  maxPosts = 100,
  headless = false,
  delay = 1000,
} = {}) {
  console.log(username, password);
  if (!username || !password) {
    throw new Error("Instagram username & password are required");
  }

  console.log(`🚀 Starting Instagram scraper for hashtag: #${tag}`);
  console.log(`📊 Target: ${maxPosts} posts, ${maxScrolls} scrolls`);

  const browser = await puppeteer.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=VizDisplayCompositor",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1280, height: 900 });

    // Enhanced request interception to block unnecessary resources
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const resourceType = req.resourceType();
      if (resourceType === "image" || resourceType === "media") {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Step 1: Login
    await loginToInstagram(page, username, password);
    await sleep(rnd(2000, 3000));

    // Step 2: Navigate to hashtag page
    const tagUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(
      tag
    )}/`;
    console.log(`🏷️  Navigating to: ${tagUrl}`);

    await page.goto(tagUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Wait for posts to load
    try {
      await page.waitForSelector("article", { timeout: 15000 });
    } catch (e) {
      throw new Error(
        `No posts found for hashtag #${tag}. Tag might not exist or be restricted.`
      );
    }

    // Step 3: Scroll to load more posts
    console.log(`📜 Scrolling to load posts (${maxScrolls} scrolls)...`);

    let lastHeight = 0;
    let scrolls = 0;
    let noChangeCount = 0;

    while (scrolls < maxScrolls && noChangeCount < 3) {
      const currentHeight = await page.evaluate(
        () => document.body.scrollHeight
      );

      if (currentHeight === lastHeight) {
        noChangeCount++;
      } else {
        noChangeCount = 0;
      }

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await sleep(rnd(2000, 3500));
      lastHeight = currentHeight;
      scrolls++;

      console.log(`  📄 Scroll ${scrolls}/${maxScrolls} completed`);
    }

    // Step 4: Collect post URLs
    console.log("🔗 Collecting post URLs...");

    const postUrls = await page.evaluate((limit) => {
      const postLinks = [];
      const anchors = document.querySelectorAll("article a[href*='/p/']");

      anchors.forEach((anchor) => {
        const href = anchor.href;
        if (href && href.includes("/p/") && !postLinks.includes(href)) {
          postLinks.push(href);
        }
      });

      return postLinks.slice(0, limit);
    }, maxPosts);

    console.log(`📋 Found ${postUrls.length} post URLs`);

    if (postUrls.length === 0) {
      throw new Error(
        "No post URLs found. The hashtag page might not have loaded properly."
      );
    }

    // Step 5: Extract data from each post
    console.log("🔍 Extracting data from posts...");

    const rawPosts = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < postUrls.length; i++) {
      const url = postUrls[i];
      console.log(`  📝 Processing post ${i + 1}/${postUrls.length}`);

      const postData = await extractPostData(page, url);

      if (postData) {
        rawPosts.push(postData);
        successCount++;

        if (postData.place) {
          console.log(
            `    📍 Found place: "${postData.place}" (${postData.likes} likes, ${postData.comments} comments)`
          );
        }
      } else {
        failCount++;
      }

      // Polite delay between posts
      await sleep(rnd(delay, delay + 1000));
    }

    console.log(
      `✅ Data extraction completed: ${successCount} success, ${failCount} failed`
    );

    // Step 6: Aggregate places data
    console.log("📊 Aggregating places data...");

    const placeMap = new Map();

    for (const post of rawPosts) {
      if (!post.place) continue;

      const key = post.place.trim().toLowerCase();

      if (!placeMap.has(key)) {
        placeMap.set(key, {
          name: post.place.trim(),
          mentions: 0,
          totalLikes: 0,
          totalComments: 0,
          totalScore: 0,
          examples: [],
          avgLikes: 0,
          avgComments: 0,
        });
      }

      const placeData = placeMap.get(key);
      placeData.mentions += 1;
      placeData.totalLikes += post.likes;
      placeData.totalComments += post.comments;
      placeData.totalScore += post.score;

      if (placeData.examples.length < 5) {
        placeData.examples.push(post.postUrl);
      }
    }

    // Calculate averages and create final places array
    const places = Array.from(placeMap.values())
      .map((place) => ({
        name: place.name,
        mentions: place.mentions,
        totalLikes: place.totalLikes,
        totalComments: place.totalComments,
        avgLikes: Math.round(place.totalLikes / place.mentions),
        avgComments: Math.round(place.totalComments / place.mentions),
        score: place.totalScore,
        popularity: place.totalScore + place.mentions * 10, // Bonus for multiple mentions
        examples: place.examples,
      }))
      .sort((a, b) => b.popularity - a.popularity);

    const successRate =
      postUrls.length > 0 ? (successCount / postUrls.length) * 100 : 0;

    console.log(`🎯 Final Results:`);
    console.log(`   📈 Found ${places.length} unique places`);
    console.log(`   📊 Success rate: ${successRate.toFixed(1)}%`);
    console.log(
      `   🏆 Top place: ${places[0]?.name || "None"} (${
        places[0]?.mentions || 0
      } mentions)`
    );

    return {
      meta: {
        tag,
        scrapedPosts: postUrls.length,
        successfulPosts: successCount,
        extractedPlaces: places.length,
        successRate: Math.round(successRate),
        timestamp: new Date().toISOString(),
      },
      places,
      rawPosts,
    };
  } catch (error) {
    console.error("❌ Instagram scraping failed:", error.message);
    throw error;
  } finally {
    await browser.close();
  }
}
