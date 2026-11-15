import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { NovoPlanoSchema } from '@talhio/shared';
import { and, desc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { planos } from '../banco/schema.js';

export type DadosDoPlano = z.output<typeof NovoPlanoSchema>;
export type PlanoGravado = typeof planos.$inferSelect;

/** Planos de trabalho. Sempre filtrados pela organização. */
@Injectable()
export class PlanosRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  listar(orgId: string, limite = 30): Promise<PlanoGravado[]> {
    return this.db.select().from(planos).where(eq(planos.orgId, orgId)).orderBy(desc(planos.criadoEm)).limit(limite);
  }

  /** Só o que o relatório precisa para saber qual operação valia em cada dia: do plano mais novo para o mais antigo. */
  operacoes(orgId: string): Promise<Pick<PlanoGravado, 'operacao' | 'dataInicio' | 'maquinaIds'>[]> {
    return this.db
      .select({ operacao: planos.operacao, dataInicio: planos.dataInicio, maquinaIds: planos.maquinaIds })
      .from(planos)
      .where(eq(planos.orgId, orgId))
      .orderBy(desc(planos.dataInicio), desc(planos.criadoEm))
      .limit(500);
  }

  async buscar(orgId: string, id: string): Promise<PlanoGravado | null> {
    const [plano] = await this.db.select().from(planos).where(and(eq(planos.orgId, orgId), eq(planos.id, id))).limit(1);
    return plano ?? null;
  }

  async salvar(orgId: string, dados: DadosDoPlano): Promise<PlanoGravado> {
    const [gravado] = await this.db.insert(planos).values({ id: randomUUID(), orgId, ...dados }).returning();
    return gravado!;
  }
}
