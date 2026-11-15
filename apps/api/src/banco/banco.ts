import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migrarPg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migrarPglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';
import * as schema from './schema.js';

/** Conexão com o banco, igual para Postgres de verdade e para o embutido. */
export type Banco = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface BancoAberto {
  db: Banco;
  fechar: () => Promise<void>;
}

export interface OndeFicaOBanco {
  /** Postgres de verdade (produção). Tem prioridade. */
  url: string | null;
  /** Pasta do banco embutido (desenvolvimento). Nulo = só em memória (testes). */
  pasta: string | null;
}

const MIGRACOES = resolve('drizzle');

/**
 * Abre o banco e aplica as migrações pendentes.
 * - Com `DATABASE_URL`: Postgres de verdade.
 * - Sem ela: Postgres embutido (PGlite), gravado numa pasta local. Não precisa instalar nada.
 */
export async function abrirBanco(onde: OndeFicaOBanco): Promise<BancoAberto> {
  if (onde.url) {
    const pool = new pg.Pool({ connectionString: onde.url, max: 10 });
    const db = drizzlePg(pool, { schema });
    await migrarPg(db, { migrationsFolder: MIGRACOES });
    return { db, fechar: () => pool.end() };
  }
  if (onde.pasta) mkdirSync(onde.pasta, { recursive: true });
  const cliente = new PGlite(onde.pasta ?? undefined);
  const db = drizzlePglite(cliente, { schema });
  await migrarPglite(db, { migrationsFolder: MIGRACOES });
  return { db, fechar: () => cliente.close() };
}
