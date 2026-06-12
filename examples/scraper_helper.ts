import { chromium } from "playwright";
import { BrowserCognitionService } from "../src/index.js";

// Mock a modern, dynamic dynamic catalog page with lazy-loaded data
const mockCatalogHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Smart-Home Dashboard</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.5rem; position: relative; transition: all 0.3s; }
    .card:hover { border-color: #38bdf8; box-shadow: 0 0 15px rgba(56, 189, 248, 0.2); }
    .title { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem; }
    .buy-btn { background: #0284c7; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; margin-top: 1rem; }
    
    /* Lazy details, completely hidden from DOM/AX Tree until hover */
    .lazy-details { display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #475569; color: #cbd5e1; font-size: 0.9rem; }
    .card.hovered .lazy-details { display: block; }
  </style>
</head>
<body>
  <h1>Devices Catalog</h1>
  <div class="grid">
    <div class="card" id="card-1" onmouseenter="this.classList.add('hovered')" onmouseleave="this.classList.remove('hovered')">
      <div class="title">Smart Hub Pro</div>
      <p>Central controller for your smart devices.</p>
      <div class="lazy-details">
        <span>⚡ Efficiency: 98%</span> | <span>📈 Rating: 4.9⭐ (120 reviews)</span>
      </div>
      <button class="buy-btn" id="btn-buy-1">Buy Hub</button>
    </div>
    
    <div class="card" id="card-2" onmouseenter="this.classList.add('hovered')" onmouseleave="this.classList.remove('hovered')">
      <div class="title">Acoustic Beam Soundbar</div>
      <p>Surround sound soundbar with voice control.</p>
      <div class="lazy-details">
        <span>⚡ Efficiency: 92%</span> | <span>📈 Rating: 4.7⭐ (85 reviews)</span>
      </div>
      <button class="buy-btn" id="btn-buy-2">Buy Soundbar</button>
    </div>
  </div>
</body>
</html>
`;

async function main() {
  console.log("🌟 RUNNING SEMANTIC SCAPER & SELECTOR-HEALING DEMO 🌟\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set up the mock HTML page
  await page.setContent(mockCatalogHtml);
  
  // Initialize our dynamic cognition service
  const cognition = new BrowserCognitionService();

  // ----------------------------------------------------
  // STEP 1: INITIAL PASSIVE OBSERVATION
  // ----------------------------------------------------
  console.log("👀 [Step 1] Initializing page and capturing Semantic AX Tree...");
  const initialResult = await cognition.observePage(page);
  const initialState = initialResult.state;
  
  console.log(`🔍 Found ${initialState.nodes.length} semantic elements on the page.`);
  
  // Try to find ratings in initial state
  const initialRatings = initialState.nodes.filter(n => n.name?.includes("Rating"));
  console.log(`📊 Ratings in initial DOM: ${initialRatings.length} found. (They are lazily-rendered!)`);
  
  // ----------------------------------------------------
  // STEP 2: SEMANTIC CARD HOVER DISCOVERY
  // ----------------------------------------------------
  console.log("\n🚀 [Step 2] Discovering Product Cards to trigger Lazy-Rendering...");
  
  // Find all smart device card items
  // Instead of hardcoding ".card", we find headings/titles and their surrounding group nodes
  const cards = initialState.nodes.filter(
    node => (node.role === "heading" || node.role === "text" || node.role === "generic") && 
            (node.name?.includes("Hub") || node.name?.includes("Soundbar"))
  );

  for (const card of cards) {
    if (!card.visible) continue;
    
    console.log(`\n👉 Hovering over semantic target: "${card.name}" (ID: ${card.id})`);
    
    // Execute a stable, self-healing hover action through the intelligence layer
    await cognition.observePage(page); // refresh
    const actResult = await page.hover(`[id="${card.attributes.backendDOMNodeId ? 'card-1' : ''}"]`).catch(async () => {
      // Fallback: use our computed selector plan
      const plan = cognition.getSelectorPlan(initialState, card.id);
      if (plan && plan.selectors.length > 0) {
        console.log(`   🛠️  Using self-healing selector: ${plan.selectors[0].value}`);
        await page.hover(plan.selectors[0].value);
      }
    });

    // Capture the newly loaded dynamic state
    const { state: activeState } = await cognition.observePage(page);
    
    // Compute semantic delta to see what lazy elements appeared
    const delta = cognition.observeDelta({ oldState: initialState, newState: activeState });
    
    console.log(`   ✨ Elements revealed:`);
    delta.added.forEach(node => {
      if (node.name?.trim()) {
        console.log(`      • [+ ${node.role}] "${node.name}"`);
      }
    });
  }

  // ----------------------------------------------------
  // STEP 3: HEALING & SELECTOR GENERATION FOR THE PURCHASE BUTTON
  // ----------------------------------------------------
  console.log("\n📋 [Step 3] Generating Self-Healing Selectors for purchasing...");
  
  // Find target button
  const { state: finalState } = await cognition.observePage(page);
  const purchaseButton = finalState.nodes.find(n => n.role === "button" && n.name?.includes("Buy Hub"));
  
  if (purchaseButton) {
    console.log(`Found target: "${purchaseButton.name}"`);
    const plan = cognition.getSelectorPlan(finalState, purchaseButton.id);
    
    if (plan) {
      console.log("\n🔗 Multi-Layered Selector Plan (From high reliability to structural fallback):");
      plan.selectors.forEach((sel, idx) => {
        console.log(`   ${idx + 1}. [${sel.kind.toUpperCase()}] ${sel.value}`);
        if (sel.reason) {
          console.log(`      💡 Reason: ${sel.reason}`);
        }
      });
    }
  }

  await browser.close();
  console.log("\n🏁 Demo Finished Successfully!");
}

main().catch(console.error);
