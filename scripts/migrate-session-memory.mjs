/**
 * Migrate SessionMemory -> MemoryNode
 *
 * Usage: node scripts/migrate-session-memory.mjs
 *
 * Prerequisites: DATABASE_URL env var must be set (or uses default).
 */

import pg from "pg";
const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/pharma_alpha";

const pool = new Pool({ connectionString: DATABASE_URL });

async function migrate() {
  const client = await pool.connect();

  try {
    const { rows: sessionRows } = await client.query(
      'SELECT id, "userId", category, key, value, "createdAt", "updatedAt" FROM "SessionMemory" ORDER BY "createdAt" ASC'
    );

    console.log(`Found ${sessionRows.length} SessionMemory rows to migrate.`);

    if (sessionRows.length === 0) {
      console.log("Nothing to migrate.");
      return;
    }

    let migrated = 0;
    for (const row of sessionRows) {
      const subject = row.key;
      const predicate = row.category === "entity" ? "股票代码" : "分析结论";
      const obj = row.value;

      try {
        await client.query(
          `INSERT INTO "MemoryNode" (id, "userId", category, subject, predicate, object, confidence, source, "accessCount", "lastAccessAt", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, 1.0, NULL, 0, NOW(), $6, $7)
           ON CONFLICT DO NOTHING`,
          [row.userId, row.category, subject, predicate, obj, row.createdAt, row.updatedAt]
        );
        migrated++;
      } catch (err) {
        console.warn(`Failed to migrate row ${row.id}: ${err.message}`);
      }
    }

    const { rows: countRows } = await client.query(
      'SELECT COUNT(*) as count FROM "MemoryNode"'
    );
    const memoryNodeCount = parseInt(countRows[0].count, 10);

    console.log(`Migration complete: ${migrated}/${sessionRows.length} rows migrated.`);
    console.log(`MemoryNode total count: ${memoryNodeCount}`);

    if (memoryNodeCount < sessionRows.length) {
      console.warn(
        "WARNING: MemoryNode count is less than SessionMemory count. Some rows may have been skipped due to conflicts."
      );
    } else {
      console.log("Validation passed: MemoryNode count >= SessionMemory count.");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
