import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { ProvedorMaquinas } from '@talhio/deere';
import { CONFIG, type Config } from '../../core/config.js';
import { diaLocal } from '../../shared/dia.js';
import { AreaOperacoesRepository } from './area-operacoes.repository.js';
import { AtividadeDeereRepository } from './atividade-deere.repository.js';
import { PROVEDOR_MAQUINAS } from './deere.tokens.js';

/** De quanto em quanto tempo o mês atual e o anterior são relidos. */
const INTERVALO_MS = 6 * 60 * 60_000;
/** Primeira rodada depois das outras leituras da subida (telas e consumo), para não competir com elas. */
const ATRASO_INICIAL_MS = 4 * 60_000;
/** Quantos meses para trás a primeira rodada cobre, contando o atual. */
export const MESES_DE_AREA = 13;
/** Pausa entre um mês e o outro: cada mês consulta as áreas de várias operações na Deere. */
const PAUSA_ENTRE_MESES_MS = 500;

/** Primeiro e último dia (AAAA-MM-DD) de cada um dos últimos `quantos` meses, do mais antigo ao atual (que termina em `hoje`). */
export function mesesAte(hoje: string, quantos: number): { mes: string; de: string; ate: string }[] {
  const lista: { mes: string; de: string; ate: string }[] = [];
  for (let n = quantos - 1; n >= 0; n--) {
    const primeiro = new Date(`${hoje.slice(0, 7)}-01T12:00:00Z`);
    primeiro.setUTCMonth(primeiro.getUTCMonth() - n);
    const ultimo = new Date(primeiro);
    ultimo.setUTCMonth(ultimo.getUTCMonth() + 1, 0);
    const de = primeiro.toISOString().slice(0, 10);
    const fim = ultimo.toISOString().slice(0, 10);
    lista.push({ mes: de.slice(0, 7), de, ate: fim > hoje ? hoje : fim });
  }
  return lista;
}

/**
 * Guarda no banco a área trabalhada por máquina e dia, lida das operações de campo da John Deere (Field Operations),
 * um mês de cada vez: do dia 1 ao último dia. Na subida cobre os últimos 13 meses (mês que já está guardado e já
 * fechou não é relido); depois, a cada 6 h, relê o mês atual e o anterior, que ainda podem mudar. É o que faz o
 * relatório e o assistente terem área de meses antigos. Nunca derruba a API: erro de um mês é registrado e segue.
 */
@Injectable()
export class AreaOperacoesService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('AreaOperacoes');
  private relogio: NodeJS.Timeout | null = null;
  private inicio: NodeJS.Timeout | null = null;
  private rodando = false;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    @Inject(AtividadeDeereRepository) private readonly fazendas: AtividadeDeereRepository,
    @Inject(AreaOperacoesRepository) private readonly repo: AreaOperacoesRepository,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.deereProvedor !== 'deere' || !this.provedor.areaDasOperacoes) return;
    this.inicio = setTimeout(() => {
      void this.rodar(MESES_DE_AREA);
      this.relogio = setInterval(() => void this.rodar(2), INTERVALO_MS);
      this.relogio.unref();
    }, ATRASO_INICIAL_MS);
    this.inicio.unref();
  }

  onApplicationShutdown(): void {
    if (this.inicio) clearTimeout(this.inicio);
    if (this.relogio) clearInterval(this.relogio);
  }

  /** Uma rodada de todas as fazendas, cobrindo os últimos `meses` meses. */
  async rodar(meses: number, agora: Date = new Date()): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    try {
      for (const orgId of await this.fazendas.fazendasProntas()) await this.fazenda(orgId, meses, agora);
    } catch (e) {
      this.log.warn(`Rodada falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.rodando = false;
    }
  }

  /** Lê e grava um mês (ou qualquer período) de uma fazenda. Devolve quantos dias de máquina ficaram gravados. */
  async lerPeriodo(orgId: string, de: string, ate: string): Promise<number> {
    const dias = (await this.provedor.areaDasOperacoes?.(orgId, de, ate)) ?? [];
    return this.repo.trocarPeriodo(orgId, de, ate, dias);
  }

  private async fazenda(orgId: string, meses: number, agora: Date): Promise<void> {
    const hoje = diaLocal(agora);
    const lista = mesesAte(hoje, meses);
    const jaGuardados = await this.repo.mesesGuardados(orgId).catch(() => new Set<string>());
    // O mês atual e o anterior sempre são relidos (operação pode terminar ou ser corrigida); os outros, só se faltam.
    const reler = new Set(lista.slice(-2).map((m) => m.mes));
    let gravados = 0;
    let lidos = 0;
    let falhas = 0;
    for (const { mes, de, ate } of lista) {
      if (jaGuardados.has(mes) && !reler.has(mes)) continue;
      try {
        gravados += await this.lerPeriodo(orgId, de, ate);
        lidos++;
      } catch (e) {
        falhas++;
        this.log.warn(`Fazenda ${orgId}, ${mes}: ${e instanceof Error ? e.message : String(e)}`);
      }
      await esperar(PAUSA_ENTRE_MESES_MS);
    }
    this.log.log(`Fazenda ${orgId}: área das operações de campo, ${lidos} mês(es) lidos (${lista[0]!.mes} a ${lista.at(-1)!.mes}): ${gravados} dia(s) de máquina gravados, ${falhas} falha(s)`);
  }
}

const esperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
