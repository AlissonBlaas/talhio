import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
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
}
