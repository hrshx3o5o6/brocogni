import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

interface ServerBlock {
  command: string;
  args: string[];
}

interface ClientDef {
  id: string;
  name: string;
  detect(): boolean;
  isActive(): boolean;
  configPath(): string | null;
  serverKey(): string;
  write(block: ServerBlock): boolean;
  extraInstructions(): string | null;
}

function serializeYaml(block: ServerBlock): string {
  const args = block.args.map((a) => JSON.stringify(a)).join(", ");
  return `mcp_servers:\n  brocogni:\n    command: ${JSON.stringify(block.command)}\n    args: [${args}]\n`;
}

const CLIENTS: ClientDef[] = [
  {
    id: "antigravity",
    name: "Antigravity CLI",
    detect: () => fs.existsSync(path.join(os.homedir(), ".gemini", "config")),
    isActive: () => !!(
      fs.existsSync(path.join(os.homedir(), ".gemini", "antigravity-cli")) ||
      process.env.TERM_PROGRAM === "antigravity"
    ),
    configPath: () => path.join(os.homedir(), ".gemini", "config", "mcp_config.json"),
    serverKey: () => "brocogni",
    write(block) {
      const cp = this.configPath();
      if (!cp) return false;
      const dir = path.dirname(cp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let config: any = {};
      if (fs.existsSync(cp)) {
        try { config = JSON.parse(fs.readFileSync(cp, "utf8")); }
        catch { /* will overwrite */ }
      }
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers[this.serverKey()] = block;
      fs.writeFileSync(cp, JSON.stringify(config, null, 2), "utf8");
      return true;
    },
    extraInstructions: () => null,
  },
  {
    id: "cursor",
    name: "Cursor",
    detect: () => fs.existsSync(path.join(os.homedir(), ".cursor")),
    isActive: () => !!process.env.CURSOR_TRACE_ID,
    configPath: () => path.join(os.homedir(), ".cursor", "mcp.json"),
    serverKey: () => "brocogni",
    write(block) {
      const cp = this.configPath();
      if (!cp) return false;
      const dir = path.dirname(cp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let config: any = {};
      if (fs.existsSync(cp)) {
        try { config = JSON.parse(fs.readFileSync(cp, "utf8")); }
        catch { /* will overwrite */ }
      }
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers[this.serverKey()] = block;
      fs.writeFileSync(cp, JSON.stringify(config, null, 2), "utf8");
      return true;
    },
    extraInstructions: () => null,
  },
  {
    id: "windsurf",
    name: "Windsurf",
    detect: () => fs.existsSync(path.join(os.homedir(), ".codeium", "windsurf")),
    isActive: () => !!(
      process.env.TERM_PROGRAM === "windsurf" ||
      process.env.WS_AGENT
    ),
    configPath: () => path.join(os.homedir(), ".codeium", "windsurf", "mcp_config.json"),
    serverKey: () => "brocogni",
    write(block) {
      const cp = this.configPath();
      if (!cp) return false;
      const dir = path.dirname(cp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let config: any = {};
      if (fs.existsSync(cp)) {
        try { config = JSON.parse(fs.readFileSync(cp, "utf8")); }
        catch { /* will overwrite */ }
      }
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers[this.serverKey()] = block;
      fs.writeFileSync(cp, JSON.stringify(config, null, 2), "utf8");
      return true;
    },
    extraInstructions: () => null,
  },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    detect: () => {
      if (process.platform === "darwin") {
        return fs.existsSync(path.join(os.homedir(), "Library", "Application Support", "Claude"));
      }
      if (process.platform === "win32") {
        const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
        return fs.existsSync(path.join(appData, "Claude"));
      }
      return false;
    },
    isActive: () => false,
    configPath: () => {
      if (process.platform === "darwin") {
        return path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
      }
      if (process.platform === "win32") {
        const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
        return path.join(appData, "Claude", "claude_desktop_config.json");
      }
      return null;
    },
    serverKey: () => "brocogni",
    write(block) {
      const cp = this.configPath();
      if (!cp) return false;
      const dir = path.dirname(cp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let config: any = {};
      if (fs.existsSync(cp)) {
        try { config = JSON.parse(fs.readFileSync(cp, "utf8")); }
        catch { /* will overwrite */ }
      }
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers[this.serverKey()] = block;
      fs.writeFileSync(cp, JSON.stringify(config, null, 2), "utf8");
      return true;
    },
    extraInstructions: () => "Restart Claude Desktop to pick up the new server.",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    detect: () => {
      const home = os.homedir();
      return fs.existsSync(path.join(home, ".claude")) ||
        fs.existsSync(path.join(home, ".claude", "settings.json"));
    },
    isActive: () => !!process.env.CLAUDE_CODE,
    configPath: () => null,
    serverKey: () => "brocogni",
    write() { return false; },
    extraInstructions: () => "Run: claude mcp add brocogni -- npx -y browser-cognition-mcp",
  },
  {
    id: "opencode",
    name: "OpenCode",
    detect: () => {
      // Check local project files or global config directory
      const localPaths = [".opencode.json", "opencode.json", "../.opencode.json", "../opencode.json"];
      if (localPaths.some(p => fs.existsSync(p))) return true;
      return fs.existsSync(path.join(os.homedir(), ".config", "opencode"));
    },
    isActive: () => !!process.env.OPENCODE_AGENT,
    configPath: () => null,
    serverKey: () => "brocogni",
    write() { return false; },
    extraInstructions: () => "Add to your project's opencode.json:\n  {\n    \"mcp\": {\n      \"brocogni\": {\n        \"type\": \"local\",\n        \"command\": [\"npx\", \"-y\", \"browser-cognition-mcp\"]\n      }\n    }\n  }",
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    detect: () => fs.existsSync(path.join(os.homedir(), ".hermes")),
    isActive: () => process.env.PATH?.split(path.delimiter).some((p) =>
      fs.existsSync(path.join(p, "hermes"))
    ) ?? false,
    configPath: () => path.join(os.homedir(), ".hermes", "config.yaml"),
    serverKey: () => "brocogni",
    write(block) {
      const cp = this.configPath();
      if (!cp) return false;
      const dir = path.dirname(cp);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      let existing = "";
      if (fs.existsSync(cp)) {
        existing = fs.readFileSync(cp, "utf8");
      }
      const yaml = serializeYaml(block as ServerBlock);
      if (existing.includes("mcp_servers:")) {
        if (existing.includes("  brocogni:")) {
          const lines = existing.split("\n");
          let start = -1;
          let end = -1;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trimStart().startsWith("  brocogni:")) {
              start = i;
              end = i + 1;
              while (end < lines.length && lines[end].startsWith("    ")) end++;
              break;
            }
          }
          if (start >= 0) {
            const blockLines = yaml.split("\n").filter((l) => l.trim()).map((l) => l.startsWith("  ") ? l : "  " + l);
            lines.splice(start, end - start, ...blockLines);
            fs.writeFileSync(cp, lines.join("\n") + "\n", "utf8");
            return true;
          }
        }
        const blockLines = yaml.split("\n").filter((l) => l.trim()).map((l) => l.startsWith("  ") ? l : "  " + l);
        const insertAt = existing.lastIndexOf("\n") + 1;
        const before = existing.slice(0, insertAt);
        const after = existing.slice(insertAt);
        fs.writeFileSync(cp, before + blockLines.join("\n") + "\n" + after, "utf8");
      } else {
        fs.writeFileSync(cp, existing + (existing.endsWith("\n") ? "" : "\n") + yaml, "utf8");
      }
      return true;
    },
    extraInstructions: () => "Restart Hermes or run `/reload-mcp` to pick up the new server.",
  },
];

function detectClients(): { client: ClientDef; detected: boolean; active: boolean }[] {
  return CLIENTS.map((client) => ({
    client,
    detected: client.detect(),
    active: client.isActive(),
  }));
}

export async function runSetup() {
  const isLocalDev = process.argv.includes("--local");
  const isDryRun = process.argv.includes("--dry-run");

  const serverBlock: ServerBlock = isLocalDev
    ? { command: "node", args: [path.resolve("./dist/src/runtime/mcp.js")] }
    : { command: "npx", args: ["-y", "browser-cognition-mcp"] };

  const results = detectClients();
  const detected = results.filter((r) => r.detected);

  // Dynamically import @clack/prompts (only loaded during install)
  const p = await import("@clack/prompts");

  p.intro("Brocogni Setup");

  if (detected.length === 0) {
    p.note(
      "No supported MCP clients found on your system.",
      "Nothing to configure"
    );
    p.outro(
      "You can still use Brocogni by manually adding it to your MCP client config.\n" +
      "Docs: https://github.com/hrshx3o5o6/brocogni"
    );
    return;
  }

  // Try to detect which environment we're running in
  const activeId = detected.find((r) => r.active)?.client.id;

  const selected = await p.multiselect({
    message: "Which MCP clients should Brocogni connect to?",
    options: detected.map((r) => ({
      value: r.client.id,
      label: r.client.name,
      hint: r.client.id === activeId
        ? "active"
        : r.client.configPath() ? "detected" : "detected (manual setup)",
    })),
    required: false,
    initialValues: detected
      .filter((r) => r.detected)
      .map((r) => r.client.id),
  });

  if (p.isCancel(selected)) {
    p.cancel("Setup cancelled.");
    return;
  }

  if (selected.length === 0) {
    p.outro("No changes made.");
    return;
  }

  if (isDryRun) {
    p.note(
      selected
        .map((id: string) => {
          const client = CLIENTS.find((c) => c.id === id)!;
          const extra = client.extraInstructions();
          if (client.configPath()) {
            return `${client.name} → ${client.configPath()}`;
          }
          return `${client.name} → ${extra}`;
        })
        .join("\n"),
      "Would configure"
    );
    p.outro("Dry run complete. No files were written.");
    return;
  }

  const s = p.spinner();
  s.start("Configuring...");

  let ok: string[] = [];
  let manual: string[] = [];

  for (const id of selected) {
    const client = CLIENTS.find((c) => c.id === id)!;
    if (client.configPath()) {
      const wrote = client.write(serverBlock);
      if (wrote) ok.push(client.name);
      else manual.push(client.name);
    } else {
      manual.push(client.name);
    }
  }

  s.stop("Done!");

  if (ok.length) {
    p.log.success(`Configured: ${ok.join(", ")}`);
  }
  if (manual.length) {
    p.log.info(`Manual setup needed for: ${manual.join(", ")}`);
    for (const id of selected) {
      const client = CLIENTS.find((c) => c.id === id)!;
      const extra = client.extraInstructions();
      if (extra && !client.configPath()) {
        p.note(extra, client.name);
      }
    }
  }

  p.outro(
    "Make sure Playwright browsers are installed:\n" +
    "  npx playwright install chromium\n" +
    (activeId === "claude-desktop" ? "\nThen restart Claude Desktop." : "")
  );
}
