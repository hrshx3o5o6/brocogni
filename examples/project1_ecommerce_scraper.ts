import { chromium } from "playwright";
import { BrowserCognitionService } from "../src/index.js";

// Mock an E-Commerce site where product cards contain unique action buttons ("View product")
// followed immediately by generic "Add to Cart" buttons.
const mockEcomHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AeroGear Athletics Store</title>
  <style>
    body { font-family: 'Outfit', sans-serif; background: #0b0f19; color: #f3f4f6; padding: 2rem; max-width: 1000px; margin: auto; }
    h1 { text-align: center; color: #60a5fa; font-size: 2.5rem; margin-bottom: 2rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem; }
    
    .c_x92a1 { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.3s ease; }
    .c_x92a1:hover { border-color: #3b82f6; transform: translateY(-4px); box-shadow: 0 10px 20px rgba(59, 130, 246, 0.15); }
    .t_y82b2 { font-size: 1.25rem; font-weight: 600; color: #ffffff; margin-bottom: 0.5rem; }
    .p_z73c3 { font-size: 1.1rem; color: #10b981; font-weight: bold; margin-bottom: 1rem; }
    
    .action-group { display: flex; gap: 0.5rem; margin-top: 1rem; }
    .btn-view { background: #1f2937; color: #9ca3af; border: 1px solid #374151; padding: 0.5rem; border-radius: 6px; cursor: pointer; flex: 1; font-size: 0.85rem; }
    .btn-view:hover { background: #374151; color: #fff; }
    
    /* Identical generic buttons with no unique IDs or classes */
    .btn_w63d4 { background: #3b82f6; color: #ffffff; border: none; padding: 0.5rem; border-radius: 6px; font-weight: 500; cursor: pointer; flex: 1.5; font-size: 0.85rem; }
    .btn_w63d4:hover { background: #2563eb; }
    
    /* Dynamic review section revealed on hover */
    .r_u24e5 { display: none; margin-top: 1rem; background: #1f2937; padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; color: #9ca3af; }
    .c_x92a1:hover .r_u24e5 { display: block; }
    
    .status-msg { display: none; text-align: center; margin-top: 2rem; padding: 1rem; background: #065f46; color: #34d399; border-radius: 8px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>AeroGear Athletics Store</h1>
  
  <div class="grid">
    <!-- Product 1 -->
    <div class="c_x92a1" id="p1">
      <div>
        <div class="t_y82b2">AeroFit Running Shoes</div>
        <div class="p_z73c3">$120.00</div>
        <p style="color: #9ca3af; font-size: 0.9rem;">Ultra-light breathable mesh trainers.</p>
        <div class="r_u24e5">
          <span>⭐ 4.8 / 5.0 Rating (240 reviews)</span>
        </div>
      </div>
      <div class="action-group">
        <button class="btn-view">View Shoes</button>
        <button class="btn_w63d4" onclick="purchase('AeroFit Running Shoes')">Add to Cart</button>
      </div>
    </div>

    <!-- Product 2 -->
    <div class="c_x92a1" id="p2">
      <div>
        <div class="t_y82b2">ProGrip Yoga Mat</div>
        <div class="p_z73c3">$45.00</div>
        <p style="color: #9ca3af; font-size: 0.9rem;">Non-slip 6mm eco-friendly cushioning.</p>
        <div class="r_u24e5">
          <span>⭐ 4.9 / 5.0 Rating (180 reviews)</span>
        </div>
      </div>
      <div class="action-group">
        <button class="btn-view">View Yoga Mat</button>
        <button class="btn_w63d4" onclick="purchase('ProGrip Yoga Mat')">Add to Cart</button>
      </div>
    </div>

    <!-- Product 3 -->
    <div class="c_x92a1" id="p3">
      <div>
        <div class="t_y82b2">UltraLight Water Bottle</div>
        <div class="p_z73c3">$28.00</div>
        <p style="color: #9ca3af; font-size: 0.9rem;">Double-wall vacuum insulated flask.</p>
        <div class="r_u24e5">
          <span>⭐ 4.7 / 5.0 Rating (95 reviews)</span>
        </div>
      </div>
      <div class="action-group">
        <button class="btn-view">View Water Bottle</button>
        <button class="btn_w63d4" onclick="purchase('UltraLight Water Bottle')">Add to Cart</button>
      </div>
    </div>
  </div>

  <div id="status" class="status-msg"></div>

  <script>
    function purchase(productName) {
      const statusDiv = document.getElementById('status');
      statusDiv.innerText = '🛒 Success: ' + productName + ' has been added to your cart!';
      statusDiv.style.display = 'block';
      setTimeout(() => { statusDiv.style.display = 'none'; }, 5000);
    }
  </script>
</body>
</html>
`;

async function main() {
  console.log("===============================================================");
  console.log("🛍️  PROJECT 1: DYNAMIC E-COMMERCE DOCKER / SMART SCRAPER DEMO");
  console.log("===============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(mockEcomHtml);

  const cognition = new BrowserCognitionService();

  // 1. Capture initial page state
  console.log("👀 Step 1: Observing the page semantically...");
  const { state: initialState } = await cognition.observePage(page);
  console.log(`- Detected URL: ${initialState.summary.url}`);
  console.log(`- Total Actionable Nodes: ${initialState.summary.actionableCount}`);

  // 2. Perform Dynamic Hover Discovery for Lazy-loaded reviews
  console.log("\n🚀 Step 2: Running Hover State-Delta analysis for 'ProGrip Yoga Mat'...");
  
  // Find the button node for 'View Yoga Mat' to hover over
  const yogaMatViewNode = initialState.nodes.find(
    n => n.role === "button" && (n.name || "").includes("View Yoga Mat")
  );

  if (yogaMatViewNode) {
    console.log(`- Found view button element: "${yogaMatViewNode.name}" (ID: ${yogaMatViewNode.id})`);
    
    // Hover over the product card using its selector
    const hoverPlan = cognition.getSelectorPlan(initialState, yogaMatViewNode.id);
    if (hoverPlan && hoverPlan.selectors.length > 0) {
      const bestHoverSelector = hoverPlan.selectors[0].value;
      console.log(`- Hovering using selector: "${bestHoverSelector}"`);
      
      await page.hover(bestHoverSelector);
      await page.waitForTimeout(500); // let hover transition complete

      // Observe page state again after hover
      const { state: afterHoverState } = await cognition.observePage(page);
      
      // Calculate delta to see what revealed itself
      const delta = cognition.observeDelta({
        oldState: initialState,
        newState: afterHoverState
      });

      console.log(`- Delta calculated: Added: ${delta.added.length}, Removed: ${delta.removed.length}`);
      const revealedRating = delta.added.find(n => (n.name || "").includes("Rating"));
      if (revealedRating) {
        console.log(`✨ Revealed Lazy-Rendered Info: "${revealedRating.name}"`);
      } else {
        console.log("- Added nodes list:");
        delta.added.forEach(n => console.log(`  • [${n.role}] "${n.name || ''}"`));
      }
    }
  }

  // 3. Click the "Add to Cart" button specifically for "ProGrip Yoga Mat"
  console.log("\n🎯 Step 3: Finding and executing healed click on 'ProGrip Yoga Mat' button...");
  
  const { state: finalState } = await cognition.observePage(page);
  
  // Find all "Add to Cart" buttons
  const buttons = finalState.nodes.filter(n => n.role === "button" && n.name === "Add to Cart");
  console.log(`- Found ${buttons.length} buttons matching 'Add to Cart'.`);

  // Let's identify the one corresponding to ProGrip Yoga Mat (the second button in the list)
  const yogaMatButtonNode = buttons[1]; // Index 1 is Product 2 (ProGrip Yoga Mat)
  
  if (yogaMatButtonNode) {
    console.log(`- Targeted button ID: ${yogaMatButtonNode.id}`);
    
    const selectorPlan = cognition.getSelectorPlan(finalState, yogaMatButtonNode.id);
    if (selectorPlan) {
      console.log("\n📋 Ordered Selector Plan for the targeted 'Add to Cart' button:");
      selectorPlan.selectors.forEach((sel, idx) => {
        console.log(`  ${idx + 1}. [${sel.kind.toUpperCase()}] "${sel.value}" (Score: ${sel.score.toFixed(2)})`);
        console.log(`     💡 Rationale: ${sel.reason}`);
      });

      // Find the relational XPath sibling selector that anchors to "View Yoga Mat"
      const relationalSelector = selectorPlan.selectors.find(
        sel => sel.kind === "xpath" && sel.value.includes("View Yoga Mat")
      );

      if (relationalSelector) {
        console.log(`\n⚡ Simulating agent fallback click using: "${relationalSelector.value}"`);
        await page.click(relationalSelector.value);
        
        // Wait for status message
        await page.waitForSelector("#status", { state: "visible", timeout: 2000 });
        const successMessage = await page.textContent("#status");
        console.log(`\n🎉 Web App Response: "${successMessage?.trim()}"`);
      } else {
        // Fallback to the first available selector in the plan
        console.log(`\n⚡ Clicking using primary selector: "${selectorPlan.selectors[0].value}"`);
        await page.click(selectorPlan.selectors[0].value);
      }
    }
  }

  await browser.close();
  console.log("\n🏁 Project 1 Complete!\n");
}

main().catch(console.error);
