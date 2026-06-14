import { chromium } from "playwright";
import { BrowserCognitionService } from "../src/index.js";
import * as fs from "fs/promises";
import * as path from "path";

async function runPercipioTest() {
  console.log("🚀 Starting Percipio Analysis Demo...");

  // NOTE: Headless is FALSE so you can actually see the screen and log in manually.
  const browser = await chromium.launch({ headless: false });

  // We create a persistent context or just a standard page.
  // Using standard page here for simplicity.
  const context = await browser.newContext();
  const page = await context.newPage();

  const targetUrl = "https://cgi.percipio.com/library";
  console.log(`🌐 Navigating to ${targetUrl}`);

  await page.goto(targetUrl);

  console.log("⏳ Waiting for you to log in manually...");
  console.log("   The script will pause until you successfully reach the /library page.");

  // This will wait indefinitely (timeout: 0) until the URL matches the library page.
  // It handles the SSO redirect bouncing automatically!
  await page.waitForURL("https://cgi.percipio.com/library**", { timeout: 0 });

  console.log("✅ Login successful! You have reached the library.");

  // Wait an extra moment to ensure the Single Page App finishes rendering its DOM
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  console.log(`📍 Currently settled at: ${currentUrl}`);

  // 1. Initialize the Service
  const cognition = new BrowserCognitionService();

  // 2. Observe the page
  console.log("👀 Observing the page semantic state...");
  const { state } = await cognition.observePage(page);

  console.log(`\n📊 Page Summary:`);
  console.log(`- Title: ${state.summary.title}`);
  console.log(`- Total Nodes: ${state.summary.nodeCount}`);
  console.log(`- Actionable Nodes: ${state.summary.actionableCount}`);

  // 3. Look for common automation targets with Fallback selector plans
  console.log("\n🔍 Looking for common automation targets on the Library page...");

  // Search for buttons
  const buttons = cognition.findTargetsTool(state, { role: "button" });
  console.log(`✅ Found ${buttons.count} buttons. Top matches:`);
  buttons.matches.slice(0, 3).forEach(n => {
    console.log(`   - "${n.name}"`);
    const plan = cognition.getSelectorPlan(state, n.id);
    if (plan) {
      console.log(`     Primary Selector: ${plan.selectors[0].value}`);
      if (plan.fallbackChain.length > 0) {
        console.log(`     Healed Fallbacks: ${plan.fallbackChain.join(" | ")}`);
      }
    }
  });

  // Search for input fields
  const inputs = cognition.findTargetsTool(state, { role: "textbox" });
  console.log(`\n✅ Found ${inputs.count} text input fields:`);
  inputs.matches.forEach(n => {
    console.log(`   - Name/Label: "${n.name || 'Unnamed Input'}"`);
    const plan = cognition.getSelectorPlan(state, n.id);
    if (plan) {
      console.log(`     Primary Selector: ${plan.selectors[0].value}`);
      if (plan.fallbackChain.length > 0) {
        console.log(`     Healed Fallbacks: ${plan.fallbackChain.join(" | ")}`);
      }
    }
  });

  // 4. Test Dynamic Menu/Dropdowns using Delta Snapshots
  console.log("\n🎯 Detecting hover/dropdown targets on the page...");
  const hoverCandidates = state.nodes.filter(n =>
    n.enabled && n.visible &&
    (n.role === "button" || n.role === "link" || n.role === "tab" || n.role === "menuitem") &&
    n.selectors.length > 0
  );

  if (hoverCandidates.length > 0) {
    // Look for dynamic targets like "Library" or "Browse", fallback to the first actionable node
    const candidate = hoverCandidates.find(c =>
      (c.name || "").toLowerCase().includes("library") ||
      (c.name || "").toLowerCase().includes("browse") ||
      (c.name || "").toLowerCase().includes("menu")
    ) || hoverCandidates[0];

    console.log(`👉 Hovering over target: "${candidate.name}" (Role: ${candidate.role})`);

    // Verify the pre-flight interaction eligibility
    const actionVerify = cognition.verifyAction(state, {
      nodeId: candidate.id,
      action: "click" // verifying readiness
    });
    console.log(`   Pre-flight Verification: Can interact? ${actionVerify.canAct ? "✅ Yes" : "❌ No"}`);

    const plan = cognition.getSelectorPlan(state, candidate.id);
    if (plan && plan.selectors.length > 0) {
      const primarySelector = plan.selectors[0].value;

      try {
        console.log(`   Performing hover on: ${primarySelector}...`);
        await page.hover(primarySelector);

        // Wait for dynamic animation / menu rendering
        await page.waitForTimeout(1500);

        // Capture new page state
        console.log("👀 Observing the new page state after hover...");
        const { state: stateAfterHover } = await cognition.observePage(page);

        // Compute Delta to isolate new menu items
        console.log("⚡ Computing UI state delta...");
        const delta = cognition.observeDelta({
          oldState: state,
          newState: stateAfterHover
        });

        console.log(`\n📈 UI Delta Analysis:`);
        console.log(`   - Added elements: ${delta.added.length}`);
        console.log(`   - Removed elements: ${delta.removed.length}`);
        console.log(`   - Modified elements: ${delta.modified.length}`);

        if (delta.added.length > 0) {
          console.log(`\n✨ Newly revealed interactive elements (e.g. Dropdown menu links):`);
          delta.added.slice(0, 5).forEach((n, idx) => {
            console.log(`   ${idx + 1}. [${n.role}] "${n.name || 'Unnamed'}"`);
            const targetPlan = cognition.getSelectorPlan(stateAfterHover, n.id);
            if (targetPlan) {
              console.log(`      Selector: ${targetPlan.selectors[0].value}`);
            }
          });
        } else {
          console.log("   ℹ️ No new elements appeared in the accessibility tree after hover.");
        }
      } catch (hoverErr: any) {
        console.warn(`⚠️ Failed to perform hover delta test: ${hoverErr.message}`);
      }
    }
  }

  // 5. Save the full state to a file
  const outputPath = path.join(process.cwd(), "examples", "percipio_state.json");
  await fs.writeFile(outputPath, JSON.stringify(state, null, 2));
  console.log(`\n💾 Saved the full initial semantic state to: ${outputPath}`);

  console.log("\n🛑 Closing browser in 10 seconds...");
  await page.waitForTimeout(10000);
  await browser.close();
}

runPercipioTest().catch(console.error);
