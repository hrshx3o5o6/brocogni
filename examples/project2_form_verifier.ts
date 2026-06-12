import { chromium } from "playwright";
import { BrowserCognitionService } from "../src/index.js";

// Mock form survey html page with dependencies and dynamic inputs
const mockFormHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Developer Survey & Application</title>
  <style>
    body { font-family: 'Outfit', sans-serif; background: #0f172a; color: #cbd5e1; padding: 2rem; max-width: 600px; margin: auto; }
    h1 { color: #f8fafc; border-bottom: 2px solid #334155; padding-bottom: 0.5rem; }
    .form-group { margin-bottom: 1.5rem; display: flex; flex-direction: column; }
    label { font-weight: bold; margin-bottom: 0.5rem; color: #94a3b8; }
    input[type="text"], select { background: #1e293b; border: 1px solid #475569; padding: 0.75rem; border-radius: 6px; color: white; outline: none; }
    input[type="text"]:disabled, select:disabled { opacity: 0.4; cursor: not-allowed; }
    .checkbox-group { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
    .checkbox-group input { width: 18px; height: 18px; cursor: pointer; }
    .submit-btn { background: #3b82f6; color: white; border: none; padding: 0.75rem; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
    .submit-btn:disabled { background: #475569; opacity: 0.6; cursor: not-allowed; }
    .success-alert { display: none; margin-top: 1.5rem; padding: 1rem; background: #065f46; border: 1px solid #10b981; color: #34d399; border-radius: 6px; text-align: center; }
  </style>
</head>
<body>
  <h1>Developer Application Form</h1>
  
  <form id="appForm" onsubmit="event.preventDefault(); submitForm();">
    <div class="form-group">
      <label for="fullName">Full Name</label>
      <input type="text" id="fullName" placeholder="John Doe">
    </div>

    <div class="checkbox-group">
      <input type="checkbox" id="employedCheck" onchange="toggleEmployment(this.checked)">
      <label for="employedCheck">Are you currently employed?</label>
    </div>

    <div class="form-group">
      <label for="companyName">Current Company Name</label>
      <input type="text" id="companyName" disabled placeholder="e.g. Acme Corp">
    </div>

    <div class="checkbox-group">
      <input type="checkbox" id="termsCheck" onchange="toggleTerms(this.checked)">
      <label for="termsCheck">I agree to the Terms of Service</label>
    </div>

    <button type="submit" id="submitBtn" class="submit-btn" disabled>Submit Application</button>
  </form>

  <div id="successMessage" class="success-alert">
    🎉 Thank you! Your application has been successfully submitted.
  </div>

  <script>
    function toggleEmployment(isEmployed) {
      const companyInput = document.getElementById('companyName');
      companyInput.disabled = !isEmployed;
      if (!isEmployed) companyInput.value = '';
    }

    function toggleTerms(accepted) {
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.disabled = !accepted;
    }

    function submitForm() {
      document.getElementById('appForm').style.display = 'none';
      document.getElementById('successMessage').style.display = 'block';
    }
  </script>
</body>
</html>
`;

async function main() {
  console.log("===============================================================");
  console.log("📝 PROJECT 2: INTERACTIVE FORM FILLER & ACTION PRE-FLIGHT VERIFIER");
  console.log("===============================================================\n");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(mockFormHtml);

  const cognition = new BrowserCognitionService();

  // 1. Observe and print initial state
  let { state } = await cognition.observePage(page);
  console.log(`👀 Observed initial page: ${state.summary.nodeCount} nodes found.`);

  // Find targeted form inputs by Role
  const nameInput = state.nodes.find(n => n.role === "textbox" && n.name === "Full Name");
  const employedCheckbox = state.nodes.find(n => n.role === "checkbox" && n.name?.includes("employed"));
  const companyInput = state.nodes.find(n => n.role === "textbox" && n.name?.includes("Company"));
  const termsCheckbox = state.nodes.find(n => n.role === "checkbox" && n.name?.includes("Terms"));
  const submitButton = state.nodes.find(n => n.role === "button" && n.name === "Submit Application");

  // Helper function to print node state
  const logNodeState = (label: string, node: any) => {
    if (!node) console.log(`- ${label}: ❌ Not found`);
    else console.log(`- ${label} (ID: ${node.id}): visible=${node.visible}, enabled=${node.enabled}`);
  };

  console.log("\n📋 Form Input States:");
  logNodeState("Name Input", nameInput);
  logNodeState("Employed Checkbox", employedCheckbox);
  logNodeState("Company Input", companyInput);
  logNodeState("Terms Checkbox", termsCheckbox);
  logNodeState("Submit Button", submitButton);

  // 2. Perform verification test on disabled field
  if (companyInput) {
    console.log(`\n🚦 Testing pre-flight check for typing in "Company Name" (which is disabled):`);
    const verification = cognition.verifyAction(state, {
      nodeId: companyInput.id,
      action: "fill"
    });
    console.log(`- Action: fill`);
    console.log(`- Eligible to interact? ${verification.canAct ? "✅ Yes" : "❌ No"}`);
    console.log(`- Failed checks: ${JSON.stringify(verification.failedChecks)}`);
    console.log(`- Action preconditions: ${JSON.stringify(verification.preconditions)}`);
  }

  // 3. Let's fill the name input (should pass verification)
  if (nameInput) {
    console.log(`\n🚦 Verifying and filling "Full Name":`);
    const verifyName = cognition.verifyAction(state, { nodeId: nameInput.id, action: "fill" });
    if (verifyName.canAct) {
      const plan = cognition.getSelectorPlan(state, nameInput.id);
      if (plan && plan.selectors.length > 0) {
        console.log(`- Action verified. Filling "John Doe" using selector: "${plan.selectors[0].value}"`);
        await page.fill(plan.selectors[0].value, "John Doe");
      }
    }
  }

  // 4. Toggle the "Currently Employed?" checkbox to enable the Company Name field
  if (employedCheckbox) {
    console.log(`\n⚡ Checking the "employed" checkbox to enable "Company Name"...`);
    const plan = cognition.getSelectorPlan(state, employedCheckbox.id);
    if (plan && plan.selectors.length > 0) {
      await page.click(plan.selectors[0].value);
    }
  }

  // Wait a brief moment and observe the page state again
  console.log("\n👀 Observing page after checkbox toggle...");
  ({ state } = await cognition.observePage(page));

  // Find updated company input
  const updatedCompanyInput = state.nodes.find(n => n.role === "textbox" && n.name?.includes("Company"));
  logNodeState("Updated Company Input", updatedCompanyInput);

  if (updatedCompanyInput) {
    console.log(`🚦 Re-running pre-flight check for "Company Name":`);
    const verification = cognition.verifyAction(state, {
      nodeId: updatedCompanyInput.id,
      action: "fill"
    });
    console.log(`- Eligible to interact? ${verification.canAct ? "✅ Yes" : "❌ No"}`);
    
    if (verification.canAct) {
      const plan = cognition.getSelectorPlan(state, updatedCompanyInput.id);
      if (plan && plan.selectors.length > 0) {
        console.log(`- Action verified. Filling "Stark Industries" using selector: "${plan.selectors[0].value}"`);
        await page.fill(plan.selectors[0].value, "Stark Industries");
      }
    }
  }

  // 5. Try to submit without checking the terms checkbox (should fail verifyAction)
  const updatedSubmitBtn = state.nodes.find(n => n.role === "button" && n.name === "Submit Application");
  if (updatedSubmitBtn) {
    console.log(`\n🚦 Verifying "Submit Application" button before accepting Terms:`);
    const verification = cognition.verifyAction(state, {
      nodeId: updatedSubmitBtn.id,
      action: "click"
    });
    console.log(`- Eligible to click? ${verification.canAct ? "✅ Yes" : "❌ No"}`);
    console.log(`- Failed checks: ${JSON.stringify(verification.failedChecks)}`);
  }

  // 6. Check the terms checkbox
  if (termsCheckbox) {
    console.log(`\n⚡ Checking the "Terms" checkbox...`);
    const plan = cognition.getSelectorPlan(state, termsCheckbox.id);
    if (plan && plan.selectors.length > 0) {
      await page.click(plan.selectors[0].value);
    }
  }

  // Re-observe page state
  console.log("\n👀 Observing page after accepting terms...");
  ({ state } = await cognition.observePage(page));

  // 7. Verify and submit
  const finalSubmitBtn = state.nodes.find(n => n.role === "button" && n.name === "Submit Application");
  if (finalSubmitBtn) {
    console.log(`🚦 Verifying "Submit Application" button now:`);
    const verification = cognition.verifyAction(state, {
      nodeId: finalSubmitBtn.id,
      action: "click"
    });
    console.log(`- Eligible to click? ${verification.canAct ? "✅ Yes" : "❌ No"}`);
    
    if (verification.canAct) {
      const plan = cognition.getSelectorPlan(state, finalSubmitBtn.id);
      if (plan && plan.selectors.length > 0) {
        console.log(`- Action verified. Clicking submit using selector: "${plan.selectors[0].value}"`);
        await page.click(plan.selectors[0].value);
        
        // Wait for success message
        await page.waitForSelector("#successMessage", { state: "visible", timeout: 2000 });
        const successMessage = await page.textContent("#successMessage");
        console.log(`\n🎉 Success Alert: "${successMessage?.trim()}"`);
      }
    }
  }

  await browser.close();
  console.log("\n🏁 Project 2 Complete!\n");
}

main().catch(console.error);
