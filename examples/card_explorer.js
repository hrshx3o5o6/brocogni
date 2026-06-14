import { chromium } from "playwright";
import { writeFileSync, readFileSync, existsSync } from "fs";

const COOKIE_FILE = "session_cookies.json";
const OUTPUT = "library_data.json";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  if (existsSync(COOKIE_FILE)) {
    const cookies = JSON.parse(readFileSync(COOKIE_FILE, "utf-8"));
    await context.addCookies(cookies);
    console.log("Loaded cookies.");
  }

  await page.goto("https://cgi.percipio.com/library", { waitUntil: "load", timeout: 30000 });

  // Wait for SAML redirect chain
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    const cur = page.url();
    if (cur.includes("/library") && !cur.includes("login")) break;
    if (i === 0) console.log("Waiting for SAML auto-login...");
  }

  console.log("URL:", page.url());

  if (page.url().includes("login") || page.url().includes("microsoftonline")) {
    console.log("\n=== SSO LOGIN REQUIRED ===");
    console.log("Log in manually. Auto-detects library page.\n");
    for (let i = 0; i < 120; i++) {
      await sleep(2000);
      const cur = page.url();
      if (cur.includes("/library") && !cur.includes("login") && !cur.includes("microsoftonline")) break;
      if (i % 10 === 9) console.log(`  Waiting... (${(i + 1) * 2}s)`);
    }
    const cookies = await context.cookies();
    writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
    console.log(`Saved ${cookies.length} cookies.`);
  }

  console.log("\n=== Finding & clicking category cards ===");

  const result = {
    url: page.url(),
    title: await page.title().catch(() => ""),
    capturedAt: new Date().toISOString(),
    categoryCards: [],
  };

  // Wait for page to fully render with retry
  let cardInfos = [];
  for (let retry = 0; retry < 10; retry++) {
    await sleep(2000);
    // Scroll to trigger lazy load
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    }).catch(() => {});
    await sleep(500);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

    cardInfos = await page.evaluate(() => {
      const items = [];
      const seenTexts = new Set();

      // Method 1: Custom CSS module class names
      const cards = document.querySelectorAll(
        "[class*='customAreaCard'], [class*='skillAreaCard'], [class*='expandableSection']"
      );
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (rect.width < 200) continue;
        // Get first meaningful text line
        const text = (card.textContent || "").trim().split("\n").filter(l => l.trim().length > 2)[0]?.trim() || "";
        if (!text) continue;
        const dedupKey = text + Math.round(rect.y / 10);
        if (seenTexts.has(dedupKey)) continue;
        seenTexts.add(dedupKey);
        items.push({
          text: text.substring(0, 120),
          y: Math.round(rect.y),
          x: Math.round(rect.x),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }

      // Method 2 (fallback): look for clickable divs by position
      if (items.length < 5) {
        const allDivs = document.querySelectorAll("div");
        for (const div of allDivs) {
          const rect = div.getBoundingClientRect();
          if (rect.y < 400 || rect.width < 300 || rect.width > 600 || rect.height < 80) continue;
          const text = (div.textContent || "").trim().split("\n").filter(l => l.trim().length > 2)[0]?.trim() || "";
          if (text.length < 5) continue;
          const dedupKey = text + Math.round(rect.y / 10);
          if (seenTexts.has(dedupKey)) continue;
          seenTexts.add(dedupKey);
          items.push({
            text: text.substring(0, 120),
            y: Math.round(rect.y),
            x: Math.round(rect.x),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
      }

      return items;
    }).catch(() => []);

    if (cardInfos.length > 10) break;
    console.log(`  Retry ${retry + 1}: found ${cardInfos.length} cards...`);
  }

  console.log(`Found ${cardInfos.length} cards:`);
  for (const c of cardInfos) {
    console.log(`  ${c.text.substring(0, 50)} @ y=${c.y}`);
  }

  // Click each card and collect sublinks
  for (const cardInfo of cardInfos) {
    try {
      const cardData = { name: cardInfo.text, sublinks: [] };

      // Record baseline links before clicking
      const baseline = await page.evaluate(() => {
        const texts = new Set();
        const links = document.querySelectorAll("a[href]");
        for (const link of links) {
          const t = (link.textContent || "").trim();
          if (t.length > 2) texts.add(t);
        }
        return [...texts];
      }).catch(() => []);

      // Scroll card into view and click
      await page.evaluate(({ y, x, w, h }) => {
        window.scrollTo(0, Math.max(0, y - 200));
        const cx = x + w / 2;
        const cy = y + h / 2;
        const el = document.elementFromPoint(cx, cy);
        if (el) {
          el.scrollIntoView({ block: "center" });
          el.click();
        }
      }, cardInfo);

      await sleep(2000);

      // Collect only NEW links that appeared after clicking
      const sublinks = await page.evaluate((baseline) => {
        const items = [];
        const seen = new Set(baseline);
        const links = document.querySelectorAll("a[href]");
        for (const link of links) {
          const rect = link.getBoundingClientRect();
          if (rect.y < 300) continue;
          const text = (link.textContent || "").trim();
          const href = link.getAttribute("href") || "";
          if (text.length > 2 && !seen.has(text)) {
            seen.add(text);
            items.push({ text: text.substring(0, 120), href });
          }
        }
        return items;
      }, baseline).catch(() => []);

      cardData.sublinks = sublinks;
      result.categoryCards.push(cardData);
      console.log(`  ✓ ${cardInfo.text.substring(0, 40)} — ${sublinks.length} new links`);

      // Collapse by clicking again
      if (sublinks.length > 0) {
        await page.evaluate(({ y, x, w, h }) => {
          window.scrollTo(0, Math.max(0, y - 200));
          const cx = x + w / 2;
          const cy = y + h / 2;
          const el = document.elementFromPoint(cx, cy);
          if (el) {
            el.scrollIntoView({ block: "center" });
            el.click();
          }
        }, cardInfo);
        await sleep(800);
      }
    } catch (e) {
      console.log(`  ✗ ${cardInfo.text.substring(0, 30)}: ${e.message}`);
    }
  }

  console.log(`\nTotal: ${result.categoryCards.length} cards`);
  writeFileSync(OUTPUT, JSON.stringify(result, null, 2));
  console.log(`Saved to ${OUTPUT}`);

  await browser.close();
}

main().catch(console.error);
