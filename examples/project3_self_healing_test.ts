import { chromium } from "playwright";
import { BrowserCognitionService } from "../src/index.js";

// Mock Revision 1: Initial layout with standard class names and predictable IDs.
const mockRev1Html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Auth Portal v1</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #cbd5e1; padding: 3rem; text-align: center; }
    .btn-primary { background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; }
    .success { display: none; margin-top: 1rem; color: #34d399; }
  </style>
</head>
<body>
  <h2>Welcome to the Portal</h2>
  <!-- Easy selector: #btn-login or .btn-primary -->
  <button id="btn-login" class="btn-primary" onclick="login()">Login to Account</button>
  <div id="status" class="success">Authenticated successfully on Portal v1!</div>
  
  <script>
    function login() {
      document.getElementById('status').style.display = 'block';
    }
  </script>
</body>
</html>
`;

// Mock Revision 2: Refactored page where classes are obfuscated, DOM structure shifted, and button ID changed.
// However, the semantic role (button) and accessible name ("Login to Account") remain identical.
const mockRev2Html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Auth Portal v2</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #cbd5e1; padding: 3rem; text-align: center; }
    /* Obfuscated, randomized styling class and a different DOM structure wrapper */
    .styled-wrapper { margin: 2rem; padding: 1rem; background: #1e293b; border-radius: 8px; }
    .x_btn_82af9 { background: #10b981; color: white; padding: 0.8rem 2rem; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: bold; }
    .success { display: none; margin-top: 1rem; color: #34d399; }
  </style>
</head>
<body>
  <h2>Welcome to the Portal (v2 Refactored)</h2>
  <div class="styled-wrapper">
    <!-- The ID and class changed! #btn-login and .btn-primary NO LONGER EXIST! -->
    <button id="act-login-v2-xyz" class="x_btn_82af9" onclick="login()">Login to Account</button>
  </div>
  <div id="status" class="success">Authenticated successfully on Portal v2!</div>
  
  <script>
    function login() {
      document.getElementById('status').style.display = 'block';
    }
  </script>
</body>
</html>
`;

async function main() {
  console.log("===============================================================");
  console.log("🛡️  PROJECT 3: SELF-HEALING WEB TEST SUITE (REGRESSION GUARD)");
  console.log("===============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const cognition = new BrowserCognitionService();

  // ----------------------------------------------------
  // STEP 1: RUN ON PORTAL V1
  // ----------------------------------------------------
  console.log("🌐 Step 1: Navigating to Portal Revision 1...");
  await page.setContent(mockRev1Html);

  // Observe state & generate selector plan for the login button
  const { state: stateV1 } = await cognition.observePage(page);
  const loginBtnV1 = stateV1.nodes.find(n => n.role === "button" && n.name === "Login to Account");
  
  if (!loginBtnV1) {
    console.error("Login button not found in Portal v1!");
    await browser.close();
    return;
  }

  const v1Plan = cognition.getSelectorPlan(stateV1, loginBtnV1.id);
  console.log(`- Found "Login to Account" button on v1.`);
  console.log(`- Base Selector (e.g. ID/CSS) saved from run: "#btn-login"`);

  if (v1Plan) {
    console.log(`- Cognition Selector Plan:`);
    v1Plan.selectors.forEach((sel, i) => {
      console.log(`   ${i + 1}. [${sel.kind.toUpperCase()}] "${sel.value}"`);
    });
  }

  // ----------------------------------------------------
  // STEP 2: REFRACTOR / DEPLOYMENT OF PORTAL V2
  // ----------------------------------------------------
  console.log("\n🌐 Step 2: Simulating UI refactor/deployment. Navigating to Portal Revision 2...");
  await page.setContent(mockRev2Html);

  // Simulating a fragile automation script trying to use the old hardcoded ID locator
  console.log("\n💥 Testing fragility: Attempting to click with hardcoded locator '#btn-login'...");
  try {
    // We expect this to fail or timeout because the button ID changed to 'act-login-v2-xyz'
    await page.click("#btn-login", { timeout: 2000 });
    console.log("✅ Wait, click succeeded? (Unexpected)");
  } catch (err: any) {
    console.log(`❌ Expected Failure: Playwright failed to locate element using '#btn-login'. Error: "${err.message.split('\n')[0]}"`);
  }

  // ----------------------------------------------------
  // STEP 3: HEAL WITH BROWSER COGNITION SELECTOR PLAN
  // ----------------------------------------------------
  console.log("\n🩹 Step 3: Executing Self-Healing Action with Browser Cognition...");
  
  // Observe the new layout
  const { state: stateV2 } = await cognition.observePage(page);
  
  // In a self-healing client, if the hardcoded selector fails, the agent looks up the
  // element semantically or iterates through the pre-generated fallback chain.
  // Let's locate the corresponding button in the v2 tree (matching role & name)
  const loginBtnV2 = stateV2.nodes.find(n => n.role === "button" && n.name === "Login to Account");
  
  if (loginBtnV2) {
    console.log(`- Located target button in the v2 layout (ID: ${loginBtnV2.id})`);
    
    // Obtain selector plan for the v2 node
    const planV2 = cognition.getSelectorPlan(stateV2, loginBtnV2.id);
    
    if (planV2 && planV2.selectors.length > 0) {
      console.log("- Iterating selector plan to find a working healed selector...");
      
      let clicked = false;
      for (const selector of planV2.selectors) {
        try {
          console.log(`  🔍 Trying: [${selector.kind.toUpperCase()}] "${selector.value}"`);
          
          let locator;
          if (selector.kind === "aria") {
            const match = selector.value.match(/role=(\w+)\[name='(.*)'\]/);
            if (match) {
              const [, role, nameVal] = match;
              locator = page.getByRole(role as any, { name: nameVal });
            } else {
              locator = page.locator(selector.value);
            }
          } else {
            locator = page.locator(selector.value);
          }

          // Wait short time to verify presence
          await locator.waitFor({ timeout: 1500 });
          await locator.click();
          
          clicked = true;
          console.log(`  ✨ Success! Interacted successfully using: "${selector.value}"`);
          break;
        } catch (e: any) {
          console.log(`  ⚠️ Failed selector: ${e.message.split('\n')[0]}`);
        }
      }

      if (clicked) {
        const successMsg = await page.textContent("#status");
        console.log(`\n🎉 Web App Response after Healing: "${successMsg?.trim()}"`);
      } else {
        console.error("❌ Failed to heal click action across all candidates.");
      }
    }
  }

  await browser.close();
  console.log("\n🏁 Project 3 Complete!\n");
}

main().catch(console.error);
