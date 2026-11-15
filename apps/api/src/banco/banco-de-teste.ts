import { abrirBanco, type Banco } from './banco.js';
import { organizacoes } from './schema.js';

/** Banco vazio em memória, já com as tabelas e a organização de teste. Um por teste. */
export async function criarBancoDeTeste(orgId = 'org-demo'): Promise<Banco> {
  const { db } = await abrirBanco({ url: null, pasta: null });
  await db.insert(organizacoes).values({ id: orgId, nome: 'Fazenda de teste' });
  return db;
}
