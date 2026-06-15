#!/usr/bin/env node
import { chromium } from "playwright";
import { BrowserCognitionService } from "./src/runtime/service.js";

const service = new BrowserCognitionService();
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

console.log("npx browser-cognition-mcp");
console.log("");
console.log("> go to wikipedia.org and search for \"neural network\"");
console.log("");

await page.goto("https://www.wikipedia.org", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

console.log("Calling browser_observe...\n");
const { state } = await service.observePage(page, { mode: "action", budget: 20 });

state.nodes.slice(0, 8).forEach((n) => {
  const label = n.name || "(unnamed)";
  const enabled = n.enabled ? "" : " [disabled]";
  console.log(`  [${n.role}] "${label}"${enabled}`);
});

console.log("\nCalling browser_find_targets...");
const search = state.nodes.find((n) => n.role === "combobox");
if (search) {
  const plan = service.getSelectorPlan(state, search.id);
  if (plan?.selectors.length) {
    console.log("  Found search bar → " + plan.selectors[0].value);
  }
}

await page.waitForTimeout(5000);
await browser.close();
