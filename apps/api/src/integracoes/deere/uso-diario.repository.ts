import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte } from 'drizzle-orm';
import type { ArmazemDeUso, UsoDoDiaGuardado } from '@talhio/deere';
import type { Banco } from '../../banco/banco.js';
import { BANCO } from '../../banco/banco.module.js';
import { usoDiario } from '../../banco/schema.js';

/** Fechamento diário de cada máquina (lido do caminho dela). Toda consulta filtra por orgId. */
@Injectable()
export class UsoDiarioRepository implements ArmazemDeUso {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  /**
   * Uma consulta por fazenda traz os últimos 120 dias e fica 15 s na memória: o relatório de um mês faz centenas
   * de leituras e todas saem daqui. Gravar joga o que estava guardado fora.
   */
  private readonly recentes = new Map<string, { ate: number; dados: Promise<Map<string, UsoDoDiaGuardado>> }>();

  private recentesDe(orgId: string): Promise<Map<string, UsoDoDiaGuardado>> {
    const guardado = this.recentes.get(orgId);
    if (guardado && guardado.ate > Date.now()) return guardado.dados;
    const corte = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
    const dados = this.db
      .select()
      .from(usoDiario)
      .where(and(eq(usoDiario.orgId, orgId), gte(usoDiario.dia, corte)))
      .then(
        (linhas) =>
          new Map(
            linhas.map((l) => [
              `${l.maquinaId}|${l.dia}`,
              { trabalhandoH: l.trabalhandoH, ociosoH: l.ociosoH, transporteH: l.transporteH, areaHa: l.areaHa, areaForaHa: l.areaForaHa, paradas: l.paradas, porTalhao: l.porTalhao, pontos: l.pontos, combustivelL: l.combustivelL },
            ]),
          ),
      )
      .catch((e) => {
        this.recentes.delete(orgId);
        throw e;
      });
    this.recentes.set(orgId, { ate: Date.now() + 15_000, dados });
    return dados;
  }

  async buscar(orgId: string, maquinaId: string, dia: string): Promise<UsoDoDiaGuardado | null> {
    return (await this.recentesDe(orgId)).get(`${maquinaId}|${dia}`) ?? null;
  }

  async fechados(orgId: string): Promise<Set<string>> {
    return new Set((await this.recentesDe(orgId)).keys());
  }

  async guardar(orgId: string, maquinaId: string, dia: string, uso: UsoDoDiaGuardado): Promise<void> {
    await this.db
      .insert(usoDiario)
      .values({ orgId, maquinaId, dia, ...uso })
      .onConflictDoUpdate({ target: [usoDiario.orgId, usoDiario.maquinaId, usoDiario.dia], set: { ...uso, fechadoEm: new Date() } });
    this.recentes.delete(orgId);
  }

  /** Trocou de organização na Deere, ou os talhões mudaram: os fechamentos são refeitos na próxima busca. */
  async limpar(orgId: string): Promise<void> {
    this.recentes.delete(orgId);
    await this.db.delete(usoDiario).where(eq(usoDiario.orgId, orgId));
  }
}
