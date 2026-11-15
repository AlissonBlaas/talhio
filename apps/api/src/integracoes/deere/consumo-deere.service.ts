import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { ProvedorMaquinas } from '@talhio/deere';
import { CONFIG, type Config } from '../../core/config.js';
import { diaLocal } from '../../shared/dia.js';
import { AtividadeDeereRepository } from './atividade-deere.repository.js';
import { ConsumoDeereRepository } from './consumo-deere.repository.js';
import { PROVEDOR_MAQUINAS } from './deere.tokens.js';

const INTERVALO_MS = 60 * 60_000;
/** Primeira rodada um pouco depois de subir, para não competir com o aquecimento das telas. */
const ATRASO_INICIAL_MS = 90_000;
/** Pausa entre máquinas: a Deere pede para espalhar as chamadas (429 se vier tudo junto). */
const PAUSA_ENTRE_MAQUINAS_MS = 500;
/** Janela de cada rodada: ontem, anteontem e hoje (hoje ainda acumula). */
const DIAS_DA_RODADA = 3;
const DIA_MS = 86_400_000;

/**
 * Mantém no banco o consumo de combustível e as horas de motor por máquina e dia, lidos da API Machine Measurements
 * da John Deere (o mesmo número do Analisador da Máquina). Roda a cada hora e relê os últimos dias, porque a máquina
 * reporta em blocos e o dia só fecha depois. Com `MEDICOES_PREENCHER_DESDE`, na subida preenche também o passado, em
 * pedaços de 30 dias. Nunca derruba a API: erro de uma máquina é registrado e a rodada segue.
 */
@Injectable()
export class ConsumoDeereService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('ConsumoDeere');
  private relogio: NodeJS.Timeout | null = null;
  private inicio: NodeJS.Timeout | null = null;
  private rodando = false;
  private avisouSemAcesso = false;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    private readonly fazendas: AtividadeDeereRepository,
    private readonly repo: ConsumoDeereRepository,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.deereProvedor !== 'deere' || !this.config.deereMedicoes || !this.provedor.consumoDiario) return;
    this.inicio = setTimeout(() => {
      void this.rodar(this.config.medicoesPreencherDesde);
      this.relogio = setInterval(() => void this.rodar(null), INTERVALO_MS);
      this.relogio.unref();
    }, ATRASO_INICIAL_MS);
    this.inicio.unref();
  }

  onApplicationShutdown(): void {
    if (this.inicio) clearTimeout(this.inicio);
    if (this.relogio) clearInterval(this.relogio);
  }

  /** Uma rodada de todas as fazendas. `preencherDesde`: também busca o passado a partir desse dia. */
  async rodar(preencherDesde: string | null, agora: Date = new Date()): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    try {
      for (const orgId of await this.fazendas.fazendasProntas()) await this.fazenda(orgId, preencherDesde, agora);
    } catch (e) {
      this.log.warn(`Rodada falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.rodando = false;
    }
  }

  private async fazenda(orgId: string, preencherDesde: string | null, agora: Date): Promise<void> {
    const hoje = diaLocal(agora);
    const recente = this.diaDeslocado(hoje, -(DIAS_DA_RODADA - 1));
    let maquinas;
    try {
      maquinas = await this.provedor.listarMaquinas(orgId);
    } catch (e) {
      this.log.warn(`Fazenda ${orgId}: não deu para listar as máquinas (${e instanceof Error ? e.message : String(e)})`);
      return;
    }
    let gravados = 0;
    let falhas = 0;
    for (const maquina of maquinas) {
      try {
        // Passado em pedaços de 30 dias, do mais antigo para o mais novo, e por último a janela recente.
        const janelas: [string, string][] = [];
        if (preencherDesde && preencherDesde < recente) {
          for (let ini = preencherDesde; ini < recente; ) {
            const fimDaJanela = this.diaDeslocado(ini, 29);
            const fim = fimDaJanela < this.diaDeslocado(recente, -1) ? fimDaJanela : this.diaDeslocado(recente, -1);
            janelas.push([ini, fim]);
            ini = this.diaDeslocado(fim, 1);
          }
        }
        janelas.push([recente, hoje]);
        for (const [ini, fim] of janelas) {
          const dias = (await this.provedor.consumoDiario?.(orgId, maquina.id, ini, fim)) ?? [];
          gravados += await this.repo.guardar(orgId, maquina.id, dias);
          await esperar(PAUSA_ENTRE_MAQUINAS_MS);
        }
      } catch (e) {
        falhas++;
        const sem = e instanceof Error && /acesso|403|401/i.test(e.message);
        if (sem && !this.avisouSemAcesso) {
          this.avisouSemAcesso = true;
          this.log.warn(`Fazenda ${orgId}: a John Deere negou as medições da máquina ${maquina.nome} (${e instanceof Error ? e.message : String(e)}). Confira se a API Machine Measurements foi liberada para o app.`);
        } else if (!sem) {
          this.log.warn(`Fazenda ${orgId}, ${maquina.nome}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    this.log.log(`Fazenda ${orgId}: consumo diário de ${maquinas.length} máquina(s): ${gravados} dia(s) gravados, ${falhas} falha(s)${preencherDesde ? ` (passado desde ${preencherDesde})` : ''}`);
  }

  private diaDeslocado(dia: string, dias: number): string {
    return new Date(Date.parse(`${dia}T12:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);
  }
}

const esperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));
