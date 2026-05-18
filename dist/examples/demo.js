import { chromium } from "playwright";
import { observeSemanticState, compileContext } from "../src/index.js";
const url = process.argv[2] ?? "https://example.com";
async function main() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const state = await observeSemanticState(page);
    const actionContext = compileContext(state, "action", 50);
    console.log(JSON.stringify(actionContext, null, 2));
    await browser.close();
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
