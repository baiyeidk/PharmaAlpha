import fs from "fs";
import path from "path";
import YAML from "yaml";
import { prisma } from "@/lib/db";
import type { AgentMeta } from "./types";

const AGENTS_DIR = path.resolve(/* turbopackIgnore: true */ process.cwd(), "agents");

/**
 * Scan the agents/ directory for config.yaml files and return agent metadata.
 */
export function scanFileSystemAgents(): AgentMeta[] {
  const agents: AgentMeta[] = [];

  if (!fs.existsSync(AGENTS_DIR)) return agents;

  const entries = fs.readdirSync(AGENTS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "base") continue;

    const configPath = path.join(AGENTS_DIR, entry.name, "config.yaml");
    if (!fs.existsSync(configPath)) continue;

    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      const config = YAML.parse(raw);

      agents.push({
        name: config.name || entry.name,
        displayName: config.display_name || config.name || entry.name,
        description: config.description || "",
        entryPoint: config.entry_point || `${entry.name}/agent.py`,
        version: config.version,
        capabilities: config.capabilities || [],
      });
    } catch {
      console.warn(`Failed to parse config for agent: ${entry.name}`);
    }
  }

  return agents;
}

/**
 * Sync filesystem agents into the database.
 * Creates new records, updates existing ones, preserves manual DB entries.
 */
export async function syncAgentsToDatabase(): Promise<void> {
  const fsAgents = scanFileSystemAgents();

  for (const agent of fsAgents) {
    await prisma.agent.upsert({
      where: { name: agent.name },
      update: {
        displayName: agent.displayName,
        description: agent.description,
        entryPoint: agent.entryPoint,
        config: {
          version: agent.version,
          capabilities: agent.capabilities,
        },
      },
      create: {
        name: agent.name,
        displayName: agent.displayName,
        description: agent.description,
        entryPoint: agent.entryPoint,
        config: {
          version: agent.version,
          capabilities: agent.capabilities,
        },
      },
    });
  }
}

/**
 * Get all enabled agents from the database.
 */
export async function getAgents() {
  return prisma.agent.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get a single agent by ID.
 */
export async function getAgentById(id: string) {
  return prisma.agent.findUnique({ where: { id } });
}

/**
 * Get a single agent by name.
 */
export async function getAgentByName(name: string) {
  return prisma.agent.findUnique({ where: { name } });
}
