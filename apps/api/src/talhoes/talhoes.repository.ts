import { Inject, Injectable } from '@nestjs/common';
import type { Talhao } from '@talhio/shared';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { talhoes } from '../banco/schema.js';

/** Talhões criados no app. Sempre filtrados pela organização. */
@Injectable()
export class TalhoesRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  async listar(orgId: string): Promise<Talhao[]> {
    const linhas = await this.db.select().from(talhoes).where(eq(talhoes.orgId, orgId)).orderBy(asc(talhoes.criadoEm));
    // Operação e andamento vêm da telemetria; talhão criado no app ainda não tem.
    return linhas.map((t) => ({ id: t.id, nome: t.nome, cultura: t.cultura, areaHa: t.areaHa, contorno: t.contorno, operacao: null, percentualFeito: null }));
  }

  /** Talhões do app que também existem na John Deere: id no Talhio -> id lá. */
  async naDeere(orgId: string): Promise<Map<string, string>> {
    const linhas = await this.db.select({ id: talhoes.id, deereId: talhoes.deereId }).from(talhoes).where(and(eq(talhoes.orgId, orgId), isNotNull(talhoes.deereId)));
    return new Map(linhas.flatMap((l) => (l.deereId ? [[l.id, l.deereId] as const] : [])));
  }

  async ligarADeere(orgId: string, id: string, deereId: string): Promise<void> {
    await this.db.update(talhoes).set({ deereId }).where(and(eq(talhoes.orgId, orgId), eq(talhoes.id, id)));
  }

  /** Os ids de todos os talhões criados no app (com ou sem cópia na Deere). */
  async ids(orgId: string): Promise<Set<string>> {
    return new Set((await this.db.select({ id: talhoes.id }).from(talhoes).where(eq(talhoes.orgId, orgId))).map((l) => l.id));
  }

  async salvar(orgId: string, talhao: Talhao): Promise<void> {
    await this.db.insert(talhoes).values({ id: talhao.id, orgId, nome: talhao.nome, cultura: talhao.cultura, areaHa: talhao.areaHa, contorno: talhao.contorno });
  }
}
