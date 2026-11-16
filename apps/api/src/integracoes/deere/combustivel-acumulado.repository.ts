import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { ArmazemDeCombustivel, TemposDaLeitura } from '@talhio/deere';
import type { Banco } from '../../banco/banco.js';
import { BANCO } from '../../banco/banco.module.js';
import { combustivelAcumulado, combustivelImportado } from '../../banco/schema.js';

type DadosRecentes = { ultimas: Map<string, number>; horas: Map<string, number>; tempos: Map<string, TemposDaLeitura>; primeiras: Map<string, { litros: number; em: Date; horasMotor: number | null }> };

/** Leituras do combustível acumulado do motor, uma por máquina e dia. Toda consulta filtra por orgId. */
@Injectable()
export class CombustivelAcumuladoRepository implements ArmazemDeCombustivel {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  /** Uma consulta por fazenda traz 120 dias e fica 15 s na memória: o relatório de um mês faz centenas de leituras. */
  private readonly recentes = new Map<string, { ate: number; dados: Promise<DadosRecentes> }>();

  private recentesDe(orgId: string): Promise<DadosRecentes> {
    const guardado = this.recentes.get(orgId);
    if (guardado && guardado.ate > Date.now()) return guardado.dados;
    const corte = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
    const dados = this.db
      .select({
        serie: combustivelAcumulado.serie,
        dia: combustivelAcumulado.dia,
        litros: combustivelAcumulado.litros,
        primeiraLitros: combustivelAcumulado.primeiraLitros,
        primeiraEm: combustivelAcumulado.primeiraEm,
        horasMotor: combustivelAcumulado.horasMotor,
        primeiraHorasMotor: combustivelAcumulado.primeiraHorasMotor,
        litrosEm: combustivelAcumulado.litrosEm,
        horasEm: combustivelAcumulado.horasEm,
        primeiraLitrosEm: combustivelAcumulado.primeiraLitrosEm,
        primeiraHorasEm: combustivelAcumulado.primeiraHorasEm,
      })
      .from(combustivelAcumulado)
      .where(and(eq(combustivelAcumulado.orgId, orgId), gte(combustivelAcumulado.dia, corte)))
      .then((linhas) => ({
        ultimas: new Map(linhas.map((l) => [`${l.serie}|${l.dia}`, l.litros])),
        tempos: new Map(linhas.map((l) => [`${l.serie}|${l.dia}`, { litrosEm: l.litrosEm, horasEm: l.horasEm, primeiraLitrosEm: l.primeiraLitrosEm, primeiraHorasEm: l.primeiraHorasEm }])),
        horas: new Map(linhas.flatMap((l) => (l.horasMotor !== null ? [[`${l.serie}|${l.dia}`, l.horasMotor] as const] : []))),
        primeiras: new Map(linhas.flatMap((l) => (l.primeiraLitros !== null && l.primeiraEm !== null ? [[`${l.serie}|${l.dia}`, { litros: l.primeiraLitros, em: l.primeiraEm, horasMotor: l.primeiraHorasMotor }] as const] : []))),
      }));
    this.recentes.set(orgId, { ate: Date.now() + 15_000, dados });
    return dados;
  }

  async buscar(orgId: string, serie: string, dia: string): Promise<number | null> {
    return (await this.recentesDe(orgId)).ultimas.get(`${serie}|${dia}`) ?? null;
  }

  /** Consumo importado do Operations Center. Uma consulta por fazenda, 60 s na memória (o relatório lê dia a dia). */
  private readonly importados = new Map<string, { ate: number; dados: Promise<Map<string, { litros: number; horasMotor: number | null; horasOcioso: number | null }>> }>();

  async importado(orgId: string, maquinaId: string, dia: string): Promise<{ litros: number; horasMotor: number | null; horasOcioso: number | null } | null> {
    let guardado = this.importados.get(orgId);
    if (!guardado || guardado.ate <= Date.now()) {
      const dados = this.db
        .select({ maquinaId: combustivelImportado.maquinaId, dia: combustivelImportado.dia, litros: combustivelImportado.litros, horasMotor: combustivelImportado.horasMotor, horasOcioso: combustivelImportado.horasOcioso })
        .from(combustivelImportado)
        .where(eq(combustivelImportado.orgId, orgId))
        .then((linhas) => new Map(linhas.map((l) => [`${l.maquinaId}|${l.dia}`, { litros: l.litros, horasMotor: l.horasMotor, horasOcioso: l.horasOcioso }])));
      guardado = { ate: Date.now() + 60_000, dados };
      this.importados.set(orgId, guardado);
    }
    return (await guardado.dados).get(`${maquinaId}|${dia}`) ?? null;
  }

  async tempos(orgId: string, serie: string, dia: string): Promise<TemposDaLeitura | null> {
    return (await this.recentesDe(orgId)).tempos.get(`${serie}|${dia}`) ?? null;
  }

  async buscarHoras(orgId: string, serie: string, dia: string): Promise<number | null> {
    return (await this.recentesDe(orgId)).horas.get(`${serie}|${dia}`) ?? null;
  }

  async primeira(orgId: string, serie: string, dia: string): Promise<{ litros: number; em: Date; horasMotor: number | null } | null> {
    return (await this.recentesDe(orgId)).primeiras.get(`${serie}|${dia}`) ?? null;
  }

  /** A leitura mais nova do dia fica no lugar da anterior. O acumulado só cresce: nunca troca por um valor menor. */
  async guardar(orgId: string, dia: string, leituras: { serie: string; litros: number; horasMotor?: number | null; litrosEm?: Date | null; horasEm?: Date | null }[]): Promise<void> {
    if (leituras.length === 0) return;
    await this.db
      .insert(combustivelAcumulado)
      .values(leituras.map((l) => ({ orgId, serie: l.serie, dia, litros: l.litros, primeiraLitros: l.litros, primeiraEm: new Date(), horasMotor: l.horasMotor ?? null, primeiraHorasMotor: l.horasMotor ?? null, litrosEm: l.litrosEm ?? null, horasEm: l.horasEm ?? null, primeiraLitrosEm: l.litrosEm ?? null, primeiraHorasEm: l.horasEm ?? null })))
      .onConflictDoUpdate({
        target: [combustivelAcumulado.orgId, combustivelAcumulado.serie, combustivelAcumulado.dia],
        // A primeira leitura do dia não muda: é a base quando não existe a última de ontem.
        set: {
          litros: sql`greatest(${combustivelAcumulado.litros}, excluded.litros)`,
          lidoEm: new Date(),
          primeiraLitros: sql`coalesce(${combustivelAcumulado.primeiraLitros}, excluded.primeira_litros)`,
          primeiraEm: sql`coalesce(${combustivelAcumulado.primeiraEm}, excluded.primeira_em)`,
          // Horas acumuladas só crescem (o maior vale; nulo é ignorado). As da primeira leitura entram junto com o litro
          // dela, nunca depois: horas de outra hora não combinam com o litro da primeira.
          horasMotor: sql`greatest(${combustivelAcumulado.horasMotor}, excluded.horas_motor)`,
          primeiraHorasMotor: sql`case when ${combustivelAcumulado.primeiraLitros} is null then excluded.primeira_horas_motor else ${combustivelAcumulado.primeiraHorasMotor} end`,
          // A hora do contador acompanha o valor: só avança quando o contador não recuou e a Deere informou a hora.
          litrosEm: sql`case when excluded.litros >= ${combustivelAcumulado.litros} and excluded.litros_em is not null then excluded.litros_em else ${combustivelAcumulado.litrosEm} end`,
          horasEm: sql`case when excluded.horas_motor >= coalesce(${combustivelAcumulado.horasMotor}, 0) and excluded.horas_em is not null then excluded.horas_em else ${combustivelAcumulado.horasEm} end`,
          primeiraLitrosEm: sql`case when ${combustivelAcumulado.primeiraLitros} is null then excluded.primeira_litros_em else ${combustivelAcumulado.primeiraLitrosEm} end`,
          primeiraHorasEm: sql`case when ${combustivelAcumulado.primeiraLitros} is null then excluded.primeira_horas_em else ${combustivelAcumulado.primeiraHorasEm} end`,
        },
      });
    this.recentes.delete(orgId);
  }
}
