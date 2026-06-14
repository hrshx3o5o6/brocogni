#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const isLocalDev = process.argv.includes("--local");

function expandHome(filepath) {
  if (filepath.startsWith("~")) {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

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

console.log("\x1b[36m%s\x1b[0m", "Brocogni MCP installer");
console.log("");

// Prepare configuration block
let serverBlock = {};
if (isLocalDev) {
  const localMcpPath = path.resolve(path.join(import.meta.dirname, "../dist/src/runtime/mcp.js"));
  serverBlock = {
    command: "node",
    args: [localMcpPath]
  };
} else {
  serverBlock = {
    command: "npx",
    args: ["-y", "browser-cognition-mcp"]
  };
}

// Try configuring Claude Desktop if available
const configPath = getClaudeConfigPath();
if (configPath) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf8");
      config = JSON.parse(raw);
    } catch {
      console.warn("  Existing config malformed, creating new one.");
    }
  }

  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  config.mcpServers["brocogni"] = serverBlock;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  console.log("  Configured for Claude Desktop: " + configPath);
} else {
  console.log("  Claude Desktop config path not found on this platform.");
}

console.log("");
console.log("Brocogni registered. To connect it to your MCP client:");
console.log("");
console.log("  Claude Desktop    Restart the app (already configured)");
console.log("  Claude Code       claude mcp add brocogni -- npx -y browser-cognition-mcp");
console.log("  Cursor            Settings -> Features -> MCP -> Add New");
console.log("                    Name: brocogni | Type: stdio | Cmd: npx -y browser-cognition-mcp");
console.log("  OpenCode          Auto-detected via opencode.json in project root");
console.log("");
console.log("Make sure Playwright browsers are installed:");
console.log("  npx playwright install chromium");
console.log("");
