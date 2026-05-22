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
      console.log(`   - 🛠️  ${tool.name.padEnd(20)}: ${tool.description}`);
    });
    console.log("");

    // 3. Navigate to a test website
    const testUrl = "https://example.com";
    console.log(`👉 Calling [browser_navigate] to "${testUrl}"...`);
    const navRes = await sendRequest("tools/call", {
      name: "browser_navigate",
      arguments: { url: testUrl }
    });
    const navOutput = JSON.parse(navRes.content[0].text);
    console.log("✅ Navigation Result:", navOutput, "\n");

    // 4. Observe the semantic layout
    console.log("👉 Calling [browser_observe] to fetch simplified semantic layout...");
    const obsRes = await sendRequest("tools/call", {
      name: "browser_observe",
      arguments: { mode: "action", budget: 10 }
    });
    const obsOutput = JSON.parse(obsRes.content[0].text);
    console.log("✅ Semantic Observation Elements:");
    if (obsOutput && Array.isArray(obsOutput.elements)) {
      obsOutput.elements.forEach((el) => {
        console.log(`   • [ID: ${el.id}] <${el.role}> "${el.name}"${el.attributes ? ` ${JSON.stringify(el.attributes)}` : ""}`);
      });
    } else {
      console.log("   ", JSON.stringify(obsOutput).slice(0, 300) + "...");
    }
    console.log("");

    console.log("✨ All standard JSON-RPC operations completed successfully over stdio channels!");
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
