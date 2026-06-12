import { spawn } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcpPath = path.resolve(__dirname, "../dist/src/runtime/mcp.js");

console.log("🚀 Starting Local MCP Client Integration Test...");
console.log(`📂 Launching MCP Server from: ${mcpPath}\n`);

// Spawn the MCP server process
const server = spawn("node", [mcpPath]);

let pendingRequests = new Map();
let requestIdCounter = 1;
let buffer = "";

// Read output line-by-line from MCP server's stdout
server.stdout.setEncoding("utf8");
server.stdout.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);
      const { id, result, error } = response;
      if (id && pendingRequests.has(id)) {
        const { resolve, reject } = pendingRequests.get(id);
        pendingRequests.delete(id);
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      } else {
        console.log("📩 Unsolicited message from server:", response);
      }
    } catch (e) {
      console.log(`⚠️ Raw server log / non-JSON output: ${line}`);
    }
  }
});

// Capture any error output from the server's stderr
server.stderr.on("data", (data) => {
  console.error(`🚨 SERVER STDERR: ${data.toString().trim()}`);
});

server.on("close", (code) => {
  console.log(`\n🛑 MCP Server process exited with code ${code}`);
});

// Helper to send a JSON-RPC request to the MCP server
function sendRequest(method, params = {}) {
  const id = requestIdCounter++;
  const payload = {
    jsonrpc: "2.0",
    id,
    method,
    params
  };

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    server.stdin.write(JSON.stringify(payload) + "\n");
  });
}

async function run() {
  try {
    // 1. Initialize the MCP Server
    console.log("👉 Sending [initialize] request...");
    const initRes = await sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" }
    });
    console.log("✅ Initialized successfully!");
    console.log(`   Server Name: ${initRes.serverInfo.name}`);
    console.log(`   Server Version: ${initRes.serverInfo.version}\n`);

    // 2. List the available tools
    console.log("👉 Sending [tools/list] request...");
    const toolsRes = await sendRequest("tools/list");
    console.log("✅ Available Tools List:");
    toolsRes.tools.forEach((tool) => {
      console.log(`   - 🛠️  ${tool.name.padEnd(25)}: ${tool.description}`);
    });
    console.log("");

    // 3. Test Prompts API
    console.log("👉 Sending [prompts/list] request...");
    const promptsRes = await sendRequest("prompts/list");
    console.log("✅ Available Prompts List:");
    promptsRes.prompts.forEach((prompt) => {
      console.log(`   - 📝  ${prompt.name.padEnd(30)}: ${prompt.description}`);
    });
    console.log("");

    console.log("👉 Sending [prompts/get] request for 'write-robust-playwright-script'...");
    const promptRes = await sendRequest("prompts/get", { name: "write-robust-playwright-script" });
    console.log("✅ Prompt received! Length:", promptRes.messages[0].content.text.length, "chars.\n");

    // 4. Navigate to a test website
    const testUrl = "https://example.com";
    console.log(`👉 Calling [browser_navigate] to "${testUrl}"...`);
    const navRes = await sendRequest("tools/call", {
      name: "browser_navigate",
      arguments: { url: testUrl }
    });
    const navOutput = JSON.parse(navRes.content[0].text);
    console.log("✅ Navigation Result:", navOutput, "\n");

    // 5. Observe the semantic layout
    console.log("👉 Calling [browser_observe] to fetch simplified semantic layout...");
    const obsRes = await sendRequest("tools/call", {
      name: "browser_observe",
      arguments: { mode: "action", budget: 10 }
    });
    const obsOutput = JSON.parse(obsRes.content[0].text);
    console.log("✅ Semantic Observation Elements:");
    if (obsOutput && Array.isArray(obsOutput.nodes)) {
      obsOutput.nodes.forEach((el) => {
        console.log(`   • [ID: ${el.id}] <${el.role}> "${el.name}"${el.attributes ? ` ${JSON.stringify(el.attributes)}` : ""}`);
      });
    } else {
      console.log("   ", JSON.stringify(obsOutput).slice(0, 300) + "...");
    }
    console.log("");

    // Test parameterless browser_delta by creating a second cached state
    console.log("👉 Refreshing page content slightly to cache second state...");
    await sendRequest("tools/call", {
      name: "browser_observe",
      arguments: { mode: "action", budget: 10 }
    });

    console.log("👉 Calling [browser_delta] (omitting oldState and newState)...");
    const deltaRes = await sendRequest("tools/call", {
      name: "browser_delta",
      arguments: {} // states are omitted!
    });
    const deltaOutput = JSON.parse(deltaRes.content[0].text);
    console.log("✅ Delta computed using cached states! Added:", deltaOutput.added.length, "Removed:", deltaOutput.removed.length, "Modified:", deltaOutput.modified.length, "\n");

    // 6. Test browser_find_targets to search cached state server-side
    console.log("👉 Calling [browser_find_targets] to find 'Learn more' link...");
    const findRes = await sendRequest("tools/call", {
      name: "browser_find_targets",
      arguments: { role: "link", nameIncludes: "Learn" }
    });
    const findOutput = JSON.parse(findRes.content[0].text);
    console.log("✅ Find Targets Result:");
    if (findOutput && Array.isArray(findOutput.matches)) {
      findOutput.matches.forEach((el) => {
        console.log(`   • [ID: ${el.id}] <${el.role}> "${el.name}"`);
      });

      if (findOutput.matches.length > 0) {
        const targetNode = findOutput.matches[0];
        // Test browser_get_selector_plan WITHOUT state parameter!
        console.log(`\n👉 Calling [browser_get_selector_plan] for Node ID "${targetNode.id}" (omitting state)...`);
        const planRes = await sendRequest("tools/call", {
          name: "browser_get_selector_plan",
          arguments: { nodeId: targetNode.id } // state is omitted!
        });
        const planOutput = JSON.parse(planRes.content[0].text);
        console.log("✅ Selector Plan Output (from cached state):");
        console.log(`   Node: ${planOutput.nodeId}`);
        planOutput.selectors.forEach((sel, i) => {
          console.log(`   ${i + 1}. [${sel.kind.toUpperCase()}] "${sel.value}"`);
        });
      }
    } else {
      console.log("   ", JSON.stringify(findOutput));
    }
    console.log("");

    // 7. Test browser_screenshot
    console.log("👉 Calling [browser_screenshot]...");
    const snapRes = await sendRequest("tools/call", {
      name: "browser_screenshot",
      arguments: { fullPage: false }
    });
    const snapOutput = JSON.parse(snapRes.content[0].text);
    if (snapOutput && snapOutput.screenshot) {
      console.log("✅ Screenshot captured successfully! Base64 length:", snapOutput.screenshot.length, "bytes.\n");
    } else {
      console.log("❌ Failed to capture screenshot.\n");
    }

    console.log("✨ All custom and standard JSON-RPC operations completed successfully over stdio channels!");
  } catch (error) {
    console.error("❌ Test encountered an error:", error);
  } finally {
    // Terminate the process cleanly
    console.log("👋 Shutting down the test client...");
    server.stdin.end();
    server.kill();
  }
}

// Allow server process some milliseconds to spin up before feeding input
setTimeout(run, 500);
