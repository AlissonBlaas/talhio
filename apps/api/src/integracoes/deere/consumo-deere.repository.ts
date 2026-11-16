import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { ConsumoDoDia } from '@talhio/deere';
import type { Banco } from '../../banco/banco.js';
import { BANCO } from '../../banco/banco.module.js';
import { combustivelImportado } from '../../banco/schema.js';

/**
 * Grava o consumo diário vindo da API Machine Measurements em `combustivel_importado` (a mesma tabela dos CSVs: o
 * relatório lê dali primeiro). O dia mais novo troca o anterior; a API é a fonte mais completa e substitui o CSV.
 * Toda gravação leva o orgId.
 */
@Injectable()
export class ConsumoDeereRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  async guardar(orgId: string, maquinaId: string, dias: ConsumoDoDia[]): Promise<number> {
    if (dias.length === 0) return 0;
    await this.db
      .insert(combustivelImportado)
      .values(
        dias.map((d) => ({
          orgId,
          maquinaId,
          dia: d.dia,
          litros: d.litros,
          horasMotor: d.horasMotor,
          litrosTrabalhando: d.litrosTrabalhando,
          litrosOcioso: d.litrosOcioso,
          litrosTransporte: d.litrosTransporte,
          horasTrabalhando: d.horasTrabalhando,
          horasOcioso: d.horasOcioso,
          horasTransporte: d.horasTransporte,
          fonte: 'api',
        })),
      )
      .onConflictDoUpdate({
        target: [combustivelImportado.orgId, combustivelImportado.maquinaId, combustivelImportado.dia],
        set: {
          litros: sql`excluded.litros`,
          horasMotor: sql`excluded.horas_motor`,
          litrosTrabalhando: sql`excluded.litros_trabalhando`,
          litrosOcioso: sql`excluded.litros_ocioso`,
          litrosTransporte: sql`excluded.litros_transporte`,
          horasTrabalhando: sql`excluded.horas_trabalhando`,
          horasOcioso: sql`excluded.horas_ocioso`,
          horasTransporte: sql`excluded.horas_transporte`,
          fonte: sql`'api'`,
          importadoEm: sql`now()`,
        },
      });
    return dias.length;
  }

  /** O dia mais antigo guardado de cada máquina da fazenda (AAAA-MM-DD). Máquina sem nada guardado não aparece. */
  async maisAntigoPorMaquina(orgId: string): Promise<Map<string, string>> {
    const linhas = await this.db
      .select({ maquinaId: combustivelImportado.maquinaId, dia: sql<string>`min(${combustivelImportado.dia})` })
      .from(combustivelImportado)
      .where(eq(combustivelImportado.orgId, orgId))
      .groupBy(combustivelImportado.maquinaId);
    return new Map(linhas.map((l) => [l.maquinaId, l.dia]));
  }

  /**
   * Consumo e horas de motor somados por mês e por máquina, de `desde` (AAAA-MM-DD) em diante, do mês mais antigo
   * para o mais novo. É a soma dos dias guardados: mês sem nenhuma leitura não aparece.
   */
  async porMes(orgId: string, desde: string): Promise<ConsumoDoMes[]> {
    const mes = sql<string>`substr(${combustivelImportado.dia}, 1, 7)`;
    const soma = (coluna: unknown) => sql<number>`coalesce(sum(${coluna}), 0)`.mapWith(Number);
    return this.db
      .select({
        mes,
        maquinaId: combustivelImportado.maquinaId,
        dias: sql<number>`count(*)`.mapWith(Number),
        litros: soma(combustivelImportado.litros),
        horasMotor: soma(combustivelImportado.horasMotor),
        litrosTrabalhando: soma(combustivelImportado.litrosTrabalhando),
        litrosOcioso: soma(combustivelImportado.litrosOcioso),
        litrosTransporte: soma(combustivelImportado.litrosTransporte),
        horasTrabalhando: soma(combustivelImportado.horasTrabalhando),
        horasOcioso: soma(combustivelImportado.horasOcioso),
        horasTransporte: soma(combustivelImportado.horasTransporte),
      })
      .from(combustivelImportado)
      .where(and(eq(combustivelImportado.orgId, orgId), gte(combustivelImportado.dia, desde)))
      .groupBy(mes, combustivelImportado.maquinaId)
      .orderBy(mes, combustivelImportado.maquinaId);
  }
}

/** Soma de um mês de uma máquina em `combustivel_importado`. */
export interface ConsumoDoMes {
  /** AAAA-MM. */
  mes: string;
  maquinaId: string;
  /** Quantos dias do mês têm leitura. */
  dias: number;
  litros: number;
  horasMotor: number;
  litrosTrabalhando: number;
  litrosOcioso: number;
  litrosTransporte: number;
  horasTrabalhando: number;
  horasOcioso: number;
  horasTransporte: number;
}
