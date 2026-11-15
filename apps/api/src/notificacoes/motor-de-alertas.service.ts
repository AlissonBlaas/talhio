import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { ProvedorMaquinas } from '@talhio/deere';
import type { Maquina, Severidade } from '@talhio/shared';
import { CONFIG, type Config } from '../core/config.js';
import { AtividadeDeereRepository } from '../integracoes/deere/atividade-deere.repository.js';
import { PROVEDOR_MAQUINAS } from '../integracoes/deere/deere.tokens.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { NotificacoesRepository } from './notificacoes.repository.js';
import { NotificacoesService } from './notificacoes.service.js';

const MIN = 60_000;
const INTERVALO_MS = 2 * MIN;
/** A cada quantas rodadas também se consultam as falhas na Deere (uma chamada por máquina). */
const RODADAS_POR_CONSULTA_DE_FALHAS = 3;
/** Parada há tanto tempo, tendo trabalhado logo antes, vira alerta. Parada na garagem não é alerta. */
export const PARADA_MIN = 20;
/** Sem sinal há tanto tempo, em máquina que estava ativa há pouco. */
export const SEM_SINAL_MIN = 20;
/** Máquina vista ativa há mais que isso e sem sinal já não é novidade. */
const ATIVA_ATE_MS = 6 * 60 * MIN;
/** Combustível abaixo disto avisa; só volta a poder avisar depois de passar do outro limite (abasteceu). */
export const COMBUSTIVEL_BAIXO = 20;
export const COMBUSTIVEL_REARMA = 30;
/** O mesmo problema não avisa de novo antes disto, mesmo que tenha acabado e voltado. */
const INTERVALO_ENTRE_AVISOS_MS = 2 * 60 * MIN;
/** Falha registrada há mais que isso não vira aviso (evita despejar o passado ao ligar). */
const JANELA_DAS_FALHAS_MS = 6 * 60 * MIN;
const PAUSA_ENTRE_MAQUINAS_MS = 400;

const hora = (data: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(data);
const esperar = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/**
 * Olha as máquinas de cada fazenda de tempos em tempos e transforma o que merece atenção em notificação (aba do app
 * e push): máquina parada ou sem sinal depois de trabalhar, combustível baixo e falhas que a máquina registra
 * (códigos de diagnóstico da John Deere, só severidade alta e média). Cada problema avisa uma vez e só volta a avisar
 * depois de acabar. Nunca derruba a API: erro de uma fazenda ou máquina é registrado e a rodada segue.
 */
@Injectable()
export class MotorDeAlertasService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Alertas');
  private relogio: NodeJS.Timeout | null = null;
  private inicio: NodeJS.Timeout | null = null;
  private rodando = false;
  private rodadas = 0;
  /** Quando cada máquina foi vista trabalhando e ativa (em memória: ao reiniciar, recomeça a observar). */
  private readonly vistas = new Map<string, { trabalhando: number; ativa: number }>();
  private readonly falhasJaAvisadas = new Set<string>();

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    @Inject(MaquinasService) private readonly maquinas: MaquinasService,
    @Inject(AtividadeDeereRepository) private readonly fazendas: AtividadeDeereRepository,
    @Inject(NotificacoesRepository) private readonly notificacoes: NotificacoesRepository,
    @Inject(NotificacoesService) private readonly servico: NotificacoesService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.deereProvedor !== 'deere' || !this.config.pushAlertas) return;
    // Primeira rodada depois do aquecimento das telas, para o servidor já ter as máquinas em memória.
    this.inicio = setTimeout(() => {
      void this.rodar();
      this.relogio = setInterval(() => void this.rodar(), INTERVALO_MS);
      this.relogio.unref();
    }, 2 * MIN);
    this.inicio.unref();
  }

  onApplicationShutdown(): void {
    if (this.inicio) clearTimeout(this.inicio);
    if (this.relogio) clearInterval(this.relogio);
  }

  async rodar(agora: Date = new Date()): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    const consultaFalhas = this.rodadas++ % RODADAS_POR_CONSULTA_DE_FALHAS === 0;
    try {
      for (const orgId of await this.fazendas.fazendasProntas()) {
        try {
          const lista = await this.maquinas.listar(orgId, agora);
          await this.verificarMaquinas(orgId, lista, agora);
          if (consultaFalhas) await this.verificarFalhas(orgId, lista, agora);
        } catch (e) {
          this.log.warn(`Fazenda ${orgId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } finally {
      this.rodando = false;
    }
  }

  /** Parada, sem sinal e combustível baixo: abre o alerta quando a condição aparece e fecha quando acaba. */
  async verificarMaquinas(orgId: string, lista: Maquina[], agora: Date): Promise<void> {
    const t = agora.getTime();
    for (const m of lista) {
      const v = this.vistas.get(`${orgId}/${m.id}`) ?? { trabalhando: 0, ativa: 0 };
      if (m.status === 'trabalhando') v.trabalhando = t;
      if (m.status === 'trabalhando' || m.status === 'parada') v.ativa = t;
      this.vistas.set(`${orgId}/${m.id}`, v);
    }
    const abertas = new Map<string, string>();
    for (const tipo of ['maquina-parada', 'sem-sinal', 'combustivel-baixo'] as const) for (const a of await this.notificacoes.abertas(orgId, tipo)) abertas.set(a.chave, a.id);

    for (const m of lista) {
      const v = this.vistas.get(`${orgId}/${m.id}`)!;
      const paradaDesde = m.paradaDesde ? Date.parse(m.paradaDesde) : NaN;
      const parada = m.status === 'parada' && Number.isFinite(paradaDesde) && t - paradaDesde >= PARADA_MIN * MIN && v.trabalhando > 0 && v.trabalhando >= paradaDesde - 30 * MIN;
      const ultimoSinal = Date.parse(m.ultimoSinal);
      const semSinal = m.status === 'sem-sinal' && v.ativa > 0 && t - v.ativa <= ATIVA_ATE_MS && Number.isFinite(ultimoSinal) && t - ultimoSinal >= SEM_SINAL_MIN * MIN;
      const pct = m.combustivelPct;
      const baixo = m.telemetriaAtiva && m.status !== 'sem-sinal' && !m.combustivelSuspeito && pct !== null && pct < COMBUSTIVEL_BAIXO;
      // Combustível só "acaba" quando passa do limite de rearme (ou some a leitura): evita avisar de novo a cada 1% de oscilação.
      const tanqueSegue = pct !== null && pct < COMBUSTIVEL_REARMA && m.status !== 'sem-sinal';

      await this.tratar(orgId, abertas, agora, {
        tipo: 'maquina-parada',
        m,
        quando: parada,
        continua: m.status === 'parada',
        severidade: 'media',
        titulo: `${m.nome} parada`,
        texto: `Parada há ${Math.max(PARADA_MIN, Math.round((t - paradaDesde) / MIN))} min${m.talhaoNome ? ` no ${m.talhaoNome.toLowerCase()}` : ''}, desde ${Number.isFinite(paradaDesde) ? hora(new Date(paradaDesde)) : '—'}.`,
      });
      await this.tratar(orgId, abertas, agora, {
        tipo: 'sem-sinal',
        m,
        quando: semSinal,
        continua: m.status === 'sem-sinal',
        severidade: 'media',
        titulo: `${m.nome} sem sinal`,
        texto: `Sem sinal desde ${Number.isFinite(ultimoSinal) ? hora(new Date(ultimoSinal)) : '—'}. Os dados voltam quando a máquina pegar internet.`,
      });
      await this.tratar(orgId, abertas, agora, {
        tipo: 'combustivel-baixo',
        m,
        quando: baixo,
        continua: tanqueSegue,
        severidade: pct !== null && pct < 10 ? 'alta' : 'media',
        titulo: `Combustível baixo: ${m.nome}`,
        texto: `${m.nome} está com ${Math.round(pct ?? 0)}% de combustível.`,
      });
    }
  }

  private async tratar(
    orgId: string,
    abertas: Map<string, string>,
    agora: Date,
    p: { tipo: 'maquina-parada' | 'sem-sinal' | 'combustivel-baixo'; m: Maquina; quando: boolean; continua: boolean; severidade: Severidade; titulo: string; texto: string },
  ): Promise<void> {
    const chave = `${p.tipo}:${p.m.id}`;
    const aberta = abertas.get(chave);
    if (aberta) {
      if (!p.continua) await this.notificacoes.resolver(orgId, aberta, agora);
      return;
    }
    if (!p.quando) return;
    const ultima = await this.notificacoes.ultimaDaChave(orgId, chave);
    if (ultima && agora.getTime() - ultima.criadaEm.getTime() < INTERVALO_ENTRE_AVISOS_MS) return;
    await this.servico.emitir(orgId, { id: `${chave}:${agora.getTime()}`, chave, tipo: p.tipo, severidade: p.severidade, maquinaId: p.m.id, maquinaNome: p.m.nome, titulo: p.titulo, texto: p.texto, criadaEm: agora });
  }

  /** Falhas que a máquina registra (DTC): só severidade alta e média, ainda não reconhecidas, das últimas 6 h. */
  async verificarFalhas(orgId: string, lista: Maquina[], agora: Date): Promise<void> {
    const ler = this.provedor.alertasDaMaquina?.bind(this.provedor);
    if (!ler) return;
    for (const m of lista) {
      if (!m.telemetriaAtiva) continue;
      try {
        const alertas = await ler(orgId, m.id, new Date(agora.getTime() - JANELA_DAS_FALHAS_MS), agora);
        for (const a of alertas) {
          if ((a.severidade !== 'alta' && a.severidade !== 'media') || a.reconhecido) continue;
          const id = `falha-maquina:${m.id}:${a.id}`;
          if (this.falhasJaAvisadas.has(id)) continue;
          this.falhasJaAvisadas.add(id);
          await this.servico.emitir(orgId, {
            id,
            chave: `falha-maquina:${m.id}`,
            tipo: 'falha-maquina',
            severidade: a.severidade,
            maquinaId: m.id,
            maquinaNome: m.nome,
            titulo: a.severidade === 'alta' ? `Falha grave: ${m.nome}` : `Falha na ${m.nome}`,
            texto: a.descricao.length > 180 ? `${a.descricao.slice(0, 177)}…` : a.descricao,
            criadaEm: new Date(a.quando),
          });
        }
      } catch (e) {
        // 403 = a Deere não liberou os alertas para o app; um aviso no log basta, a rodada segue.
        if (!this.falhasJaAvisadas.has(`erro:${m.id}`)) {
          this.falhasJaAvisadas.add(`erro:${m.id}`);
          this.log.warn(`Alertas de falha de ${m.nome}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await esperar(PAUSA_ENTRE_MAQUINAS_MS);
    }
  }
}
