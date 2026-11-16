import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Turno } from '@talhio/shared';
import { and, eq, gte, inArray, lt, ne } from 'drizzle-orm';
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

  /**
   * A última escala gravada de cada máquina ANTES de `dia`, olhando até `desde`: os turnos do dia mais recente em que
   * ela foi escalada. É de onde sai a sugestão do dia (fim de semana e dia parado no meio não apagam o costume).
   */
  async ultimaAntes(orgId: string, dia: string, desde: string): Promise<EscalaGravada[]> {
    const linhas = await this.db
      .select({ dia: escalas.dia, maquinaId: escalas.maquinaId, operador: escalas.operador, tarefa: escalas.tarefa, talhaoId: escalas.talhaoId, turno: escalas.turno, enviadaEm: escalas.enviadaEm })
      .from(escalas)
      .where(and(eq(escalas.orgId, orgId), lt(escalas.dia, dia), gte(escalas.dia, desde)));
    const ultimoDia = new Map<string, string>();
    for (const l of linhas) if (l.dia > (ultimoDia.get(l.maquinaId) ?? '')) ultimoDia.set(l.maquinaId, l.dia);
    return linhas.filter((l) => l.dia === ultimoDia.get(l.maquinaId)).map(({ dia: _dia, ...resto }) => resto);
  }

  /**
   * Grava ou troca a escala da máquina naquele turno do dia. Mudou, deixa de constar como enviada.
   * "Dia todo" e turno separado não convivem na mesma máquina: gravar um tira o outro. `substitui` é o turno que a
   * linha tinha antes de ser editada (some, se for diferente do novo).
   */
  async definir(orgId: string, dia: string, maquinaId: string, dados: DadosDaEscala, substitui?: Turno): Promise<void> {
    const daMaquina = and(eq(escalas.orgId, orgId), eq(escalas.dia, dia), eq(escalas.maquinaId, maquinaId));
    await this.db.transaction(async (tx) => {
      if (substitui && substitui !== dados.turno) await tx.delete(escalas).where(and(daMaquina, eq(escalas.turno, substitui)));
      await tx.delete(escalas).where(and(daMaquina, dados.turno === 'dia-todo' ? ne(escalas.turno, 'dia-todo') : eq(escalas.turno, 'dia-todo')));
      await tx
        .insert(escalas)
        .values({ id: randomUUID(), orgId, dia, maquinaId, ...dados })
        .onConflictDoUpdate({ target: [escalas.orgId, escalas.dia, escalas.maquinaId, escalas.turno], set: { ...dados, enviadaEm: null } });
    });
  }

  /** Tira a linha de um turno ou, sem `turno`, todas as linhas da máquina no dia. */
  async tirar(orgId: string, dia: string, maquinaId: string, turno?: Turno): Promise<void> {
    const daMaquina = and(eq(escalas.orgId, orgId), eq(escalas.dia, dia), eq(escalas.maquinaId, maquinaId));
    await this.db.delete(escalas).where(turno ? and(daMaquina, eq(escalas.turno, turno)) : daMaquina);
  }

  /** Marca como enviada a escala do dia inteiro, ou só a das máquinas indicadas. */
  async marcarEnviada(orgId: string, dia: string, quando: Date, maquinaIds?: string[]): Promise<void> {
    const doDia = and(eq(escalas.orgId, orgId), eq(escalas.dia, dia));
    await this.db.update(escalas).set({ enviadaEm: quando }).where(maquinaIds ? and(doDia, inArray(escalas.maquinaId, maquinaIds)) : doDia);
  }
}
