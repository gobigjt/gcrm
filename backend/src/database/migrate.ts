/**
 * EzCRM — Database Migration Runner
 *
 * Usage:
 *   npm run migrate              — apply all pending migrations
 *   npm run migrate:status       — show status of every migration
 *   npm run migrate:fresh        — DROP all tables then re-run every migration  ⚠️  destructive
 */

import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Client } from 'pg';

// ─── helpers ────────────────────────────────────────────────

const MIGRATIONS_DIR = join(__dirname, 'migrations');
const TRACKING_TABLE = 'schema_migrations';

const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const dim    = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function connect(): Promise<Client> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

async function ensureTrackingTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getMigrationFiles(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files.filter(f => f.endsWith('.sql')).sort();
}

async function getApplied(client: Client): Promise<Set<string>> {
  const { rows } = await client.query(`SELECT name FROM ${TRACKING_TABLE} ORDER BY name`);
  return new Set(rows.map((r: any) => r.name));
}

// ─── commands ───────────────────────────────────────────────

async function runMigrate(): Promise<void> {
  const client = await connect();
  console.log(bold('\n  EzCRM — Migration Runner\n'));

  try {
    await ensureTrackingTable(client);
    const files   = await getMigrationFiles();
    const applied = await getApplied(client);

    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log(green('  ✓ All migrations already applied. Nothing to do.\n'));
      return;
    }

    console.log(`  ${pending.length} pending migration${pending.length > 1 ? 's' : ''}:\n`);

    let count = 0;
    for (const file of pending) {
      process.stdout.write(`  ▶  ${file} ... `);
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`, [file],
        );
        await client.query('COMMIT');
        console.log(green('✓ applied'));
        count++;
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.log(red('✗ FAILED'));
        console.error(red(`\n  Error: ${err.message}\n`));
        throw err;
      }
    }

    console.log(green(`\n  ✓ ${count} migration${count > 1 ? 's' : ''} applied successfully.\n`));

  } finally {
    await client.end();
  }
}

async function runStatus(): Promise<void> {
  const client = await connect();
  console.log(bold('\n  EzCRM — Migration Status\n'));

  try {
    await ensureTrackingTable(client);
    const files   = await getMigrationFiles();
    const applied = await getApplied(client);

    const { rows } = await client.query(
      `SELECT name, applied_at FROM ${TRACKING_TABLE} ORDER BY name`,
    );
    const appliedMap = new Map(rows.map((r: any) => [r.name, r.applied_at]));

    console.log(`  ${'Migration'.padEnd(50)} ${'Status'.padEnd(12)} Applied At`);
    console.log(`  ${'-'.repeat(85)}`);

    for (const file of files) {
      const isApplied = applied.has(file);
      const at        = appliedMap.get(file);
      const status    = isApplied ? green('✓ applied') : yellow('⏳ pending');
      const date      = at ? dim(new Date(at).toISOString().replace('T', ' ').slice(0, 19)) : dim('—');
      console.log(`  ${file.padEnd(50)} ${status.padEnd(22)} ${date}`);
    }

    const pendingCount = files.filter(f => !applied.has(f)).length;
    console.log(`\n  ${files.length} total · ${green(String(files.length - pendingCount) + ' applied')} · ${yellow(String(pendingCount) + ' pending')}\n`);

  } finally {
    await client.end();
  }
}

async function runFresh(): Promise<void> {
  const client = await connect();
  console.log(bold('\n  EzCRM — Fresh Migration (⚠️  drops all data)\n'));

  try {
    // Drop everything including tracking table
    console.log(yellow('  Dropping all tables...\n'));
    await client.query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (
          SELECT tablename FROM pg_tables
          WHERE schemaname = 'public'
        ) LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);
    console.log(green('  ✓ All tables dropped.\n'));
  } finally {
    await client.end();
  }

  // Re-run all migrations from scratch
  await runMigrate();
}

// ─── entry point ────────────────────────────────────────────

const command = process.argv[2] ?? 'up';

const commands: Record<string, () => Promise<void>> = {
  up:     runMigrate,
  status: runStatus,
  fresh:  runFresh,
};

if (!commands[command]) {
  console.error(red(`\n  Unknown command: "${command}"`));
  console.error(dim('  Available: up | status | fresh\n'));
  process.exit(1);
}

commands[command]().catch(err => {
  console.error(red(`\n  Migration failed: ${err.message}\n`));
  process.exit(1);
});
