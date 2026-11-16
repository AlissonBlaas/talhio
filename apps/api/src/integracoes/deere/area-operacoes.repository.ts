import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { AreaDoDia, ArmazemDeArea } from '@talhio/deere';
import type { Banco } from '../../banco/banco.js';
import { BANCO } from '../../banco/banco.module.js';
import { areaDasOperacoes } from '../../banco/schema.js';

/**
 * Área por máquina e dia lida das operações de campo da John Deere, guardada mês a mês. O relatório lê daqui a área
 * dos dias passados que não têm outra fonte. Toda consulta filtra por orgId.
 */
@Injectable()
export class AreaOperacoesRepository implements ArmazemDeArea {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  /** Uma consulta por fazenda traz tudo e fica 60 s na memória: o relatório de um mês lê dia a dia. Gravar limpa. */
  private readonly guardados = new Map<string, { ate: number; dados: Promise<Map<string, { areaHa: number; horas: number }>> }>();

  async buscar(orgId: string, maquinaId: string, dia: string): Promise<{ areaHa: number; horas: number } | null> {
    let guardado = this.guardados.get(orgId);
    if (!guardado || guardado.ate <= Date.now()) {
      const dados = this.db
        .select({ maquinaId: areaDasOperacoes.maquinaId, dia: areaDasOperacoes.dia, areaHa: areaDasOperacoes.areaHa, horas: areaDasOperacoes.horas })
        .from(areaDasOperacoes)
        .where(eq(areaDasOperacoes.orgId, orgId))
        .then((linhas) => new Map(linhas.map((l) => [`${l.maquinaId}|${l.dia}`, { areaHa: l.areaHa, horas: l.horas }])));
      guardado = { ate: Date.now() + 60_000, dados };
      this.guardados.set(orgId, guardado);
      dados.catch(() => this.guardados.delete(orgId));
    }
    return (await guardado.dados).get(`${maquinaId}|${dia}`) ?? null;
  }

  /**
   * Troca o que estava guardado de `de` a `ate` (o mês inteiro) pelo que a Deere informa agora: operação apagada ou
   * corrigida lá deixa de contar aqui. Devolve quantos dias de máquina ficaram gravados.
   */
  async trocarPeriodo(orgId: string, de: string, ate: string, dias: AreaDoDia[]): Promise<number> {
    const doPeriodo = dias.filter((d) => d.dia >= de && d.dia <= ate);
    await this.db.transaction(async (tx) => {
      await tx.delete(areaDasOperacoes).where(and(eq(areaDasOperacoes.orgId, orgId), gte(areaDasOperacoes.dia, de), lte(areaDasOperacoes.dia, ate)));
      if (doPeriodo.length > 0) {
        await tx
          .insert(areaDasOperacoes)
          .values(doPeriodo.map((d) => ({ orgId, maquinaId: d.maquinaId, dia: d.dia, areaHa: d.areaHa, horas: d.horas })))
          .onConflictDoUpdate({ target: [areaDasOperacoes.orgId, areaDasOperacoes.maquinaId, areaDasOperacoes.dia], set: { areaHa: sql`excluded.area_ha`, horas: sql`excluded.horas`, lidoEm: sql`now()` } });
      }
    });
    this.guardados.delete(orgId);
    return doPeriodo.length;
  }

  /** Meses (AAAA-MM) que já têm algum dia guardado. */
  async mesesGuardados(orgId: string): Promise<Set<string>> {
    const mes = sql<string>`substr(${areaDasOperacoes.dia}, 1, 7)`;
    const linhas = await this.db.select({ mes }).from(areaDasOperacoes).where(eq(areaDasOperacoes.orgId, orgId)).groupBy(mes);
    return new Set(linhas.map((l) => l.mes));
  }
}
