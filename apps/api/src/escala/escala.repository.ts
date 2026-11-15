import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Turno } from '@talhio/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { escalas } from '../banco/schema.js';

export type EscalaGravada = { maquinaId: string; operador: string; tarefa: string | null; talhaoId: string | null; turno: Turno; enviadaEm: Date | null };
export type DadosDaEscala = Pick<EscalaGravada, 'operador' | 'tarefa' | 'talhaoId' | 'turno'>;

/** Escala gravada. Sempre filtrada pela organização. */
@Injectable()
export class EscalaRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  doDia(orgId: string, dia: string): Promise<EscalaGravada[]> {
    return this.db
      .select({ maquinaId: escalas.maquinaId, operador: escalas.operador, tarefa: escalas.tarefa, talhaoId: escalas.talhaoId, turno: escalas.turno, enviadaEm: escalas.enviadaEm })
      .from(escalas)
      .where(and(eq(escalas.orgId, orgId), eq(escalas.dia, dia)));
  }

  /** Grava ou troca a escala da máquina no dia. Mudou, deixa de constar como enviada. */
  async definir(orgId: string, dia: string, maquinaId: string, dados: DadosDaEscala): Promise<void> {
    await this.db
      .insert(escalas)
      .values({ id: randomUUID(), orgId, dia, maquinaId, ...dados })
      .onConflictDoUpdate({ target: [escalas.orgId, escalas.dia, escalas.maquinaId], set: { ...dados, enviadaEm: null } });
  }

  async tirar(orgId: string, dia: string, maquinaId: string): Promise<void> {
    await this.db.delete(escalas).where(and(eq(escalas.orgId, orgId), eq(escalas.dia, dia), eq(escalas.maquinaId, maquinaId)));
  }

  /** Marca como enviada a escala do dia inteiro, ou só a das máquinas indicadas. */
  async marcarEnviada(orgId: string, dia: string, quando: Date, maquinaIds?: string[]): Promise<void> {
    const doDia = and(eq(escalas.orgId, orgId), eq(escalas.dia, dia));
    await this.db.update(escalas).set({ enviadaEm: quando }).where(maquinaIds ? and(doDia, inArray(escalas.maquinaId, maquinaIds)) : doDia);
  }
}
