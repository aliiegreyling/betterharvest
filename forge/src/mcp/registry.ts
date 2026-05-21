import fs from "node:fs";
import path from "node:path";
import { McpHealth, McpServerConfig, ProjectContext } from "../types.js";

interface McpConfigFile {
  servers?: Array<Partial<McpServerConfig>>;
}

export function discoverMcpServers(ctx: ProjectContext): McpServerConfig[] {
  const servers = new Map<string, McpServerConfig>();

  const serenaLauncher = path.join(ctx.projectRoot, ".serena", "serena.sh");
  if (ctx.hasSerena && fs.existsSync(serenaLauncher)) {
    servers.set("serena", {
      name: "serena",
      type: "stdio",
      command: ".serena/serena.sh",
      args: ["start-mcp-server", "--project-from-cwd", "--context=forge"],
      enabled: true,
      source: "auto:.serena/project.yml",
      risk: "medium",
    });
  }

  for (const configPath of configPaths(ctx.projectRoot)) {
    if (!fs.existsSync(configPath)) continue;
    for (const server of readConfig(configPath)) {
      servers.set(server.name, server);
    }
  }

  return [...servers.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function checkMcpHealth(ctx: ProjectContext, server: McpServerConfig): McpHealth {
  if (!server.enabled) {
    return { name: server.name, ok: false, source: server.source, message: "disabled" };
  }

  if (server.type === "http") {
    return {
      name: server.name,
      ok: Boolean(server.url),
      source: server.source,
      message: server.url ? `configured at ${server.url}` : "missing url",
    };
  }

  if (!server.command) {
    return { name: server.name, ok: false, source: server.source, message: "missing command" };
  }

  const commandPath = server.command.startsWith(".")
    ? path.join(ctx.projectRoot, server.command)
    : server.command;
  const ok = server.command.includes("/") || server.command.startsWith(".")
    ? fs.existsSync(commandPath)
    : true;

  return {
    name: server.name,
    ok,
    source: server.source,
    message: ok ? `stdio command configured: ${server.command}` : `command not found: ${server.command}`,
  };
}

function configPaths(projectRoot: string): string[] {
  return [
    path.join(projectRoot, "forge.mcp.json"),
    path.join(projectRoot, ".forge", "mcp.json"),
    path.join(projectRoot, ".mcp.json"),
  ];
}

function readConfig(configPath: string): McpServerConfig[] {
  const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as McpConfigFile;
  return (parsed.servers ?? [])
    .filter((s): s is Partial<McpServerConfig> & { name: string } => typeof s.name === "string")
    .map((s) => ({
      name: s.name,
      type: s.type ?? (s.url ? "http" : "stdio"),
      command: s.command,
      args: s.args ?? [],
      url: s.url,
      enabled: s.enabled ?? true,
      source: path.relative(process.cwd(), configPath) || configPath,
      risk: s.risk ?? "medium",
    }));
}
