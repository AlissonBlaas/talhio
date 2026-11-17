import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { ArmazemAtividade, DiaDeMaquina } from '@talhio/deere';
import type { Banco } from '../../banco/banco.js';
import { BANCO } from '../../banco/banco.module.js';
import { atividadeDeere, conexoesDeere, exportacoesDeere } from '../../banco/schema.js';
import { DemonstracaoService } from '../../demonstracao/demonstracao.service.js';

/** Guarda o que foi lido dos exports da Deere. Toda consulta filtra por orgId. */
@Injectable()
export class AtividadeDeereRepository implements ArmazemAtividade {
  constructor(
    @Inject(BANCO) private readonly db: Banco,
    @Optional() @Inject(DemonstracaoService) private readonly demonstracao?: DemonstracaoService,
  ) {}

  async versoes(orgId: string): Promise<Map<string, string>> {
    const linhas = await this.db.select().from(exportacoesDeere).where(eq(exportacoesDeere.orgId, orgId));
    return new Map(linhas.map((l) => [l.operacaoId, l.versao]));
  }

  async guardar(orgId: string, operacaoId: string, versao: string, dias: DiaDeMaquina[]): Promise<void> {
    this.recentes.delete(orgId);
    await this.db.transaction(async (tx) => {
      await tx.delete(atividadeDeere).where(and(eq(atividadeDeere.orgId, orgId), eq(atividadeDeere.operacaoId, operacaoId)));
      if (dias.length) await tx.insert(atividadeDeere).values(dias.map((d) => ({ orgId, operacaoId, ...d })));
      await tx
        .insert(exportacoesDeere)
        .values({ orgId, operacaoId, versao })
        .onConflictDoUpdate({ target: [exportacoesDeere.orgId, exportacoesDeere.operacaoId], set: { versao, lidoEm: new Date() } });
    });
    this.recentes.delete(orgId);
  }

  /**
   * Uma consulta por fazenda traz os últimos 120 dias de todas as máquinas, somados por máquina e dia, e fica
   * 15 s na memória. Um relatório de mês faz centenas de leituras: todas saem daqui, sem ir ao banco de novo.
   * Pedidos juntos dividem a mesma consulta; gravar ou limpar joga o que estava guardado fora.
   */
  private readonly recentes = new Map<string, { ate: number; dados: Promise<Map<string, DiaDeMaquina>> }>();

  private recentesDe(orgId: string): Promise<Map<string, DiaDeMaquina>> {
    const guardado = this.recentes.get(orgId);
    if (guardado && guardado.ate > Date.now()) return guardado.dados;
    const corte = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);
    const dados = this.db
      .select({
        maquinaId: atividadeDeere.maquinaId,
        dia: atividadeDeere.dia,
        horas: sql<number>`sum(${atividadeDeere.horas})`,
        areaHa: sql<number>`sum(${atividadeDeere.areaHa})`,
        combustivelL: sql<number>`sum(${atividadeDeere.combustivelL})`,
        paradoMin: sql<number>`sum(${atividadeDeere.paradoMin})`,
      })
      .from(atividadeDeere)
      .where(and(eq(atividadeDeere.orgId, orgId), gte(atividadeDeere.dia, corte)))
      .groupBy(atividadeDeere.maquinaId, atividadeDeere.dia)
      .then((linhas) => new Map(linhas.map((r) => [`${r.maquinaId}|${r.dia}`, { maquinaId: r.maquinaId, dia: r.dia, horas: Number(r.horas), areaHa: Number(r.areaHa), combustivelL: Number(r.combustivelL), paradoMin: Number(r.paradoMin) }])))
      .catch((e) => {
        this.recentes.delete(orgId);
        throw e;
      });
    this.recentes.set(orgId, { ate: Date.now() + 15_000, dados });
    return dados;
  }

  async buscar(orgId: string, maquinaId: string, dia: string): Promise<DiaDeMaquina | null> {
    return (await this.recentesDe(orgId)).get(`${maquinaId}|${dia}`) ?? null;
  }

  /** Trocou de organização na Deere: o que foi lido da anterior não vale mais. */
  async limpar(orgId: string): Promise<void> {
    this.recentes.delete(orgId);
    await this.db.transaction(async (tx) => {
      await tx.delete(atividadeDeere).where(eq(atividadeDeere.orgId, orgId));
      await tx.delete(exportacoesDeere).where(eq(exportacoesDeere.orgId, orgId));
    });
  }

  /** Fazendas com a Deere pronta para uso (organização escolhida e acesso liberado). */
  async fazendasProntas(): Promise<string[]> {
    const linhas = await this.db
      .select({ orgId: conexoesDeere.orgId })
      .from(conexoesDeere)
      .where(and(isNotNull(conexoesDeere.deereOrgId), eq(conexoesDeere.precisaLiberar, false)));
    // A fazenda de demonstração nunca entra nas rodadas de segundo plano (sincronização, consumo, área, alertas).
    return linhas.map((l) => l.orgId).filter((orgId) => !this.demonstracao?.ehDemo(orgId));
  }
}
