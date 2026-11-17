import { Inject, Injectable } from '@nestjs/common';
import type { Talhao } from '@talhio/shared';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { linhas, talhoes } from '../banco/schema.js';

/** Talhões criados no app. Sempre filtrados pela organização. */
@Injectable()
export class TalhoesRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  async listar(orgId: string): Promise<Talhao[]> {
    const gravados = await this.db.select().from(talhoes).where(eq(talhoes.orgId, orgId)).orderBy(asc(talhoes.criadoEm));
    // Operação e andamento vêm da telemetria; talhão criado no app ainda não tem.
    return gravados.map((t) => ({ id: t.id, nome: t.nome, cultura: t.cultura, areaHa: t.areaHa, contorno: t.contorno, operacao: null, percentualFeito: null, doApp: true, naDeere: t.deereId !== null }));
  }

  /** Um talhão criado no app, com o id da cópia na John Deere (nulo = só no Talhio). Nulo se não é desta fazenda. */
  async buscar(orgId: string, id: string): Promise<{ talhao: Talhao; deereId: string | null } | null> {
    const [t] = await this.db.select().from(talhoes).where(and(eq(talhoes.orgId, orgId), eq(talhoes.id, id))).limit(1);
    if (!t) return null;
    return { talhao: { id: t.id, nome: t.nome, cultura: t.cultura, areaHa: t.areaHa, contorno: t.contorno, operacao: null, percentualFeito: null, doApp: true, naDeere: t.deereId !== null }, deereId: t.deereId };
  }

  async atualizar(orgId: string, talhao: Talhao): Promise<void> {
    await this.db.update(talhoes).set({ nome: talhao.nome, cultura: talhao.cultura, areaHa: talhao.areaHa, contorno: talhao.contorno }).where(and(eq(talhoes.orgId, orgId), eq(talhoes.id, talhao.id)));
  }

  /**
   * Apaga o talhão e as linhas AB que são dele (linha de talhão que não existe não serve para nada), de uma vez.
   * As linhas ficam nesta consulta, e não no módulo de linhas, porque o módulo de linhas já depende deste.
   */
  async apagar(orgId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(linhas).where(and(eq(linhas.orgId, orgId), eq(linhas.talhaoId, id)));
      await tx.delete(talhoes).where(and(eq(talhoes.orgId, orgId), eq(talhoes.id, id)));
    });
  }

  /** Talhões do app que também existem na John Deere: id no Talhio -> id lá. */
  async naDeere(orgId: string): Promise<Map<string, string>> {
    const gravados = await this.db.select({ id: talhoes.id, deereId: talhoes.deereId }).from(talhoes).where(and(eq(talhoes.orgId, orgId), isNotNull(talhoes.deereId)));
    return new Map(gravados.flatMap((l) => (l.deereId ? [[l.id, l.deereId] as const] : [])));
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
