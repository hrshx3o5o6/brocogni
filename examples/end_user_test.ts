import { chromium } from "playwright";
import { BrowserCognitionService } from "../src/index.js";

async function runEndUserTest() {
  console.log("🚀 Starting End-User Demo...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const targetUrl = "https://github.com/login";
  console.log(`🌐 Navigating to ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

  // 1. Initialize the Service (This is how an end-user uses your library)
  const cognition = new BrowserCognitionService();
  
  console.log("👀 Observing the page semantic state...");
  const { state } = await cognition.observePage(page);

  // 2. Finding a target (Simulating an AI looking for a button)
  console.log("🔍 Searching for the 'Sign in' button...");
  const targets = cognition.findTargetsTool(state, {
    role: "button",
    nameIncludes: "Sign in"
  });

  if (targets.count === 0) {
    console.log("❌ Target not found!");
    await browser.close();
    return;
  }

  const targetNode = targets.matches[0];
  console.log(`✅ Found target: ${targetNode.name} (Node ID: ${targetNode.id})`);

  // 3. Verifying Actions (The Pre-flight Check)
  console.log("\n🛡️ Running Action Verifications...");
  
  const validCheck = cognition.verifyAction(state, {
    nodeId: targetNode.id,
    action: "click"
  });
  console.log(`- Can we CLICK it? ${validCheck.canAct ? "✅ YES" : "❌ NO"}`);

  const invalidCheck = cognition.verifyAction(state, {
    nodeId: targetNode.id,
    action: "fill" // You can't type into a button
  });
  console.log(`- Can we FILL it? ${invalidCheck.canAct ? "✅ YES" : "❌ NO"} (Reason: ${invalidCheck.failedChecks.join(", ")})`);

  // 4. Getting the Selector Plan
  console.log("\n📋 Getting the fallback selector plan to hand back to Playwright...");
  const plan = cognition.getSelectorPlan(state, targetNode.id);
  
  if (plan) {
    console.log("Primary Selector:", plan.selectors[0].value);
    console.log("Fallback Selectors:", plan.fallbackChain);
  }

  await browser.close();
  console.log("\n✨ Demo Finished!");
}

runEndUserTest().catch(console.error);
