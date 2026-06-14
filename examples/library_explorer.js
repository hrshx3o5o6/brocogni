import { chromium } from "playwright";
import { writeFileSync, readFileSync, existsSync } from "fs";

// Provide credentials via environment variables or a .env file
const EMAIL = process.env.PERCIPIO_EMAIL || "";
const PASSWORD = process.env.PERCIPIO_PASSWORD || "";
const COOKIE_FILE = "session_cookies.json";
const OUTPUT = "library_data.json";

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function login(page, context) {
  // Load saved cookies if available
  if (existsSync(COOKIE_FILE)) {
    const cookies = JSON.parse(readFileSync(COOKIE_FILE, "utf-8"));
    await context.addCookies(cookies);
  }

  await page.goto("https://cgi.percipio.com/library", { waitUntil: "domcontentloaded", timeout: 30000 });
  await sleep(3000);

  if (page.url().includes("login") || page.url().includes("microsoftonline")) {
    console.log("Session expired. Performing SSO login...");
    await sleep(2000);

    // Debug screenshot before login
    await page.screenshot({ path: "login_before.png" }).catch(() => {});

    // === Microsoft SAML Login Handlers ===

    // 1. Enter email — Microsoft uses name="loginfmt" as the primary email field
    async function fillMicrosoftEmail() {
      // Try known Microsoft email field selectors
      const emailSelectors = [
        "input[name='loginfmt']",
        "input[type='email']",
        "input[placeholder*='Email' i]",
        "input[placeholder*='phone' i]",
        "input[placeholder*='account' i]",
        "#i0116",  // Microsoft's standard email input ID
      ];
      for (const sel of emailSelectors) {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.fill(EMAIL);
          console.log(`  Filled email using selector: ${sel}`);
          return true;
        }
      }
      console.log("  WARN: Could not find email input");
      return false;
    }

    // 2. Click "Next" or "Sign in" after email
    async function clickNextAfterEmail() {
      const nextSelectors = [
        "input[type='submit']",
        "button:has-text('Next')",
        "input[value='Next']",
        "button:has-text('Sign in')",
        "input[value='Sign in']",
        "#idSIButton9",    // Microsoft's standard submit button
        "[data-report-event='Signin_Submit']",
      ];
      for (const sel of nextSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false) &&
            await btn.isEnabled().catch(() => false)) {
          await btn.click();
          console.log(`  Clicked submit using: ${sel}`);
          return true;
        }
      }
      console.log("  WARN: Could not find Next button");
      return false;
    }

    // 3. Enter password — Microsoft uses name="passwd"
    async function fillMicrosoftPassword() {
      const passSelectors = [
        "input[name='passwd']",
        "input[type='password']",
        "#i0118",  // Microsoft's standard password input ID
      ];
      for (const sel of passSelectors) {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
          await el.fill(PASSWORD);
          console.log(`  Filled password using selector: ${sel}`);
          return true;
        }
      }
      console.log("  WARN: Could not find password input");
      return false;
    }

    // 4. Handle "Stay signed in?" prompt
    async function handleStaySignedIn() {
      const yesSelectors = [
        "button:has-text('Yes')",
        "input[value='Yes']",
        "#idSIButton9",    // Microsoft reuses this ID for "Yes" too
        "[data-report-event='StaySignedin_Submit']",
        "input[type='submit']",
      ];
      for (const sel of yesSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          const text = await btn.getAttribute("value").catch(() => "");
          const content = await btn.textContent().catch(() => "");
          if (text.toLowerCase().includes("yes") || content.toLowerCase().includes("yes")) {
            await btn.click();
            console.log(`  Clicked 'Yes' on stay signed in`);
            return true;
          }
        }
      }
      return false;
    }

    // 5. Check for "Don't show this again" checkbox and "No" button
    async function handleDontShowAgain() {
      const noSelectors = [
        "button:has-text('No')",
        "input[value='No']",
        "#idBtn_Back",  // Microsoft's "No / sign out" button ID
      ];
      for (const sel of noSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          const content = await btn.textContent().catch(() => "");
          if (content.toLowerCase().includes("no")) {
            await btn.click();
            console.log(`  Clicked 'No' (don't show this again)`);
            return true;
          }
        }
      }
      return false;
    }

    // === Execute login flow ===
    // Loop through login stages until we reach the library
    for (let attempt = 0; attempt < 30; attempt++) {
      const currentUrl = page.url();
      if (currentUrl.includes("/library") && !currentUrl.includes("login")) {
        console.log("  Reached library page.");
        break;
      }

      if (currentUrl.includes("microsoftonline") || currentUrl.includes("login.microsoft")) {
        await sleep(1000); // Wait for page to settle

        // Try each login stage in sequence
        if (await fillMicrosoftPassword()) {
          await sleep(500);
          await clickNextAfterEmail();
          await sleep(3000);
          if (await handleStaySignedIn()) {
            await sleep(3000);
          }
          if (await handleDontShowAgain()) {
            await sleep(1000);
          }
        } else if (await fillMicrosoftEmail()) {
          await sleep(500);
          await clickNextAfterEmail();
          await sleep(3000);
        } else {
          // Check for SAML auto-redirect 
          const samlForms = page.locator("form[name='azure-saml-form'], form[action*='saml']");
          if (await samlForms.count().catch(() => 0) > 0) {
            console.log("  SAML form found, submitting...");
            await samlForms.first().evaluate((f) => f.submit());
            await sleep(3000);
          } else {
            await sleep(2000);
          }
        }
      } else {
        // Not on Microsoft login page — maybe on Percipio or intermediate redirect
        await sleep(2000);
      }

      if (attempt % 5 === 4) {
        console.log(`  Login attempt ${attempt + 1}, current URL: ${currentUrl.substring(0, 80)}`);
      }
    }

    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

    // Debug screenshot after login
    await page.screenshot({ path: "login_after.png" }).catch(() => {});

    // Save cookies for future runs
    const cookies = await context.cookies();
    writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
    console.log("Session cookies saved for future runs.");
  } else {
    console.log("Already authenticated. Using existing session.");
  }

  console.log("URL:", page.url());
}

async function tryClick(page, locator) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await locator.scrollIntoViewIfNeeded({ timeout: 5000 });
      await sleep(300);
      await locator.click({ timeout: 5000, force: true });
      await sleep(800);
      return true;
    } catch {
      await sleep(500);
    }
  }
  return false;
}

async function explore(page) {
  const result = {
    url: page.url(),
    title: await page.title().catch(() => ""),
    capturedAt: new Date().toISOString(),
    headerDropdowns: [],
    navigationMenu: [],
    categoryCards: [],
    certifications: [],
    collections: [],
  };

  // Helper to collect visible links within a container
  async function collectLinks(container) {
    const items = [];
    const seen = new Set();
    const root = container || page;
    const links = root.locator("a[href]");
    const count = await links.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      try {
        const link = links.nth(i);
        const text = (await link.textContent().catch(() => "")).trim();
        const href = await link.getAttribute("href").catch(() => "");
        if (text && !seen.has(text)) {
          seen.add(text);
          items.push({ text, href });
        }
      } catch {}
    }
    return items;
  }

  // Helper to wait for a specific element group to appear
  async function waitForNewLinks(oldCount, timeout = 3000) {
    for (let i = 0; i < 10; i++) {
      const cur = await page.locator("a[href]").count().catch(() => 0);
      if (cur > oldCount) return true;
      await sleep(300);
    }
    return false;
  }

  // 1. Skillsoft apps dropdown
  const ssBtn = page.getByRole("button", { name: "Skillsoft apps" }).first();
  if (await ssBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    const linkCountBefore = await page.locator("a[href]").count().catch(() => 0);
    await tryClick(page, ssBtn);
    await waitForNewLinks(linkCountBefore);
    // Collect links — they appear in a popup near the header
    const items = await collectLinks();
    // Deduplicate by keeping only the new ones that look like dropdown items
    const headerArea = page.locator("header, [role='banner'], nav").first();
    const headerLinks = await collectLinks(headerArea);
    result.headerDropdowns.push({ dropdown: "Skillsoft apps", items: headerLinks.length > 0 ? headerLinks : items });
    await tryClick(page, ssBtn);
    await sleep(300);
  }

  // 2. Site Navigation sidebar
  const navBtn = page.getByRole("button", { name: "Site Navigation" }).first();
  if (await navBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tryClick(page, navBtn);
    await sleep(1500);
    // Collect links from sidebar nav
    const sidebar = page.locator("nav:visible, [role='navigation']:visible, aside:visible").first();
    const sidebarLinks = await collectLinks(sidebar).catch(() => []);
    result.navigationMenu = sidebarLinks.length > 0 ? sidebarLinks : await collectLinks();
    await tryClick(page, navBtn);
    await sleep(300);
  }

  // 3. Category card buttons
  const buttons = page.getByRole("button");
  const btnCount = await buttons.count().catch(() => 0);
  for (let i = 0; i < btnCount; i++) {
    try {
      const btn = buttons.nth(i);
      const text = (await btn.textContent().catch(() => "")).trim();
      if (!text || text.length < 3) continue;
      const box = await btn.boundingBox().catch(() => null);
      if (!box || box.y < 200 || box.y > 9000 || box.width < 150) continue;

      const cardData = { name: text, sublinks: [] };
      const clicked = await tryClick(page, btn);
      cardData.clicked = clicked;

      if (clicked) {
        await page.waitForTimeout(1500);
        // Wait for sublinks to appear — card expands
        const newLinks = page.locator("a[href]:not([href='#']):not([href='/'])");
        const lc = await newLinks.count().catch(() => 0);
        for (let j = 0; j < lc; j++) {
          try {
            const lt = (await newLinks.nth(j).textContent().catch(() => "")).trim();
            const lh = await newLinks.nth(j).getAttribute("href").catch(() => "");
            if (lt && lt.length > 2 && !cardData.sublinks.some((x) => x.text === lt)) {
              cardData.sublinks.push({ text: lt, href: lh });
            }
          } catch {}
        }
        // Try to collapse the card if possible
        await tryClick(page, btn);
        await sleep(300);
      }
      result.categoryCards.push(cardData);
      console.log(`  [${i+1}/${btnCount}] ${text.substring(0, 50)} - clicked: ${cardData.clicked}, sublinks: ${cardData.sublinks.length}`);
    } catch {}
  }

  return result;
}

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    console.log("Connecting to library...");
    await login(page, context);

    if (!page.url().includes("library")) {
      console.log("Could not reach library. Check login_debug.png");
      await page.screenshot({ path: "login_debug.png" });
      return;
    }

    console.log("Exploring page...");
    const data = await explore(page);

    writeFileSync(OUTPUT, JSON.stringify(data, null, 2));
    console.log(`\n✓ Data saved to ${OUTPUT}`);
    console.log(`Summary:
  Header dropdowns:   ${data.headerDropdowns.length}
  Navigation items:   ${data.navigationMenu.length}
  Category cards:     ${data.categoryCards.length}
  Certifications:     ${data.certifications.length}
  Collections:        ${data.collections.length}
`);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await browser.close();
  }
}

main();
