#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const isLocalDev = process.argv.includes("--local");

// Helper for expanding home directories on Unix
function expandHome(filepath) {
  if (filepath.startsWith("~")) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

// Locate Claude Desktop Config Path
function getClaudeConfigPath() {
  const platform = process.platform;
  if (platform === "darwin") {
    return expandHome("~/Library/Application Support/Claude/claude_desktop_config.json");
  } else if (platform === "win32") {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Claude", "claude_desktop_config.json");
  }
  return null;
}

console.log("\x1b[36m%s\x1b[0m", "⚙️  Browser Cognition MCP Installer");
console.log("-----------------------------------------");

const configPath = getClaudeConfigPath();
if (!configPath) {
  console.error("\x1b[31m%s\x1b[0m", "❌ Error: Claude Desktop is only supported on macOS and Windows.");
  process.exit(1);
}

console.log(`📂 Target Config File: ${configPath}`);

// Ensure parent directories exist
const dir = path.dirname(configPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Read current config
let config = {};
if (fs.existsSync(configPath)) {
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    config = JSON.parse(raw);
  } catch (err) {
    console.warn("\x1b[33m%s\x1b[0m", "⚠️  Warning: Existing config file could not be parsed. Initializing new one.");
  }
}

// Ensure mcpServers exists
if (!config.mcpServers) {
  config.mcpServers = {};
}

// Prepare configuration block
let serverBlock = {};
if (isLocalDev) {
  // Developer dev mode: point to absolute local path
  const localMcpPath = path.resolve(path.join(import.meta.dirname, "../dist/src/runtime/mcp.js"));
  console.log(`🔧 Local Dev Mode active. Pointing to: ${localMcpPath}`);
  serverBlock = {
    command: "node",
    args: [localMcpPath]
  };
} else {
  // Production global mode: use npx wrapper
  console.log("📦 Production mode active. Configuring to run via global NPX wrapper...");
  serverBlock = {
    command: "npx",
    args: ["-y", "browser-cognition-mcp"]
  };
}

config.mcpServers["browser-cognition"] = serverBlock;

// Write updated config file
try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  console.log("\x1b[32m%s\x1b[0m", "✅ Success! Browser Cognition MCP registered successfully.");
  console.log("");
  console.log("👉 Next steps:");
  console.log("   1. Close and completely restart your Claude Desktop app.");
  console.log("   2. Verify that Playwright browsers are installed locally:");
  console.log("      \x1b[36mnpx playwright install chromium\x1b[0m");
  console.log("   3. Open a chat and verify the browser tools are available.");
  console.log("");
} catch (err) {
  console.error("\x1b[31m%s\x1b[0m", `❌ Error writing configuration file: ${err.message}`);
  process.exit(1);
}
