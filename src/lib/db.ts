// Prisma client singleton.
// Reads local .env values only when deployment/runtime configuration has not already supplied them.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

// Never overwrite deployment-provided values and never treat blank placeholders as credentials.
try {
  const envPath = join(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined && value) process.env[key] = value;
  }
} catch {
  // .env file not found — rely on shell env (e.g. Vercel sets env vars directly)
}

// Final fallback: if DATABASE_URL is still not postgres (sandbox may overwrite .env),
// use the Supabase Postgres URL directly — use port 6543 (PgBouncer pooler) to avoid
// "max clients reached" errors on Supabase free tier.
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgresql://')) {
  // Port 5432 = direct (max 15 conns, no pooling — causes "max clients reached")
  // Port 6543 = PgBouncer transaction-mode pooler (handles prepared statements + pooling)
  throw new Error('DATABASE_URL must be configured through deployment secret management');
}

// If using the direct connection (port 5432) to Supabase, switch to the pooler (port 6543)
// to avoid "max clients reached" and "prepared statement does not exist" errors.
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase.com')) {
  let url = process.env.DATABASE_URL;
  // Switch from port 5432 to 6543 (PgBouncer transaction-mode pooler)
  if (url.includes(':5432')) {
    url = url.replace(':5432', ':6543');
  }
  // Add pgbouncer=true if not already present (tells Prisma to use simple queries)
  if (!url.includes('pgbouncer=')) {
    const sep = url.includes('?') ? '&' : '?';
    url = url + sep + 'pgbouncer=true';
  }
  // Remove any connection_limit params — PgBouncer handles pooling
  url = url.replace(/&connection_limit=\d+/g, '').replace(/\?connection_limit=\d+&/, '?').replace(/&connection_limit=\d+/, '');
  process.env.DATABASE_URL = url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
