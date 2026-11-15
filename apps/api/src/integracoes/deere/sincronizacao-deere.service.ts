import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import type { ProvedorMaquinas } from '@talhio/deere';
import { CONFIG, type Config } from '../../core/config.js';
import { AtividadeDeereRepository } from './atividade-deere.repository.js';
import { ConexaoDeereService } from './conexao-deere.service.js';
import { PROVEDOR_MAQUINAS } from './deere.tokens.js';

const INTERVALO_MS = 2 * 60_000;

/**
 * Mantém no banco o que a Deere demora para entregar (export ponto a ponto), para o app já abrir com tudo pronto.
 * Roda ao subir o servidor e a cada 2 minutos (e na hora, quando a Deere avisa pelo webhook), só quando o provedor real está ligado. Nunca derruba a API:
 * erro de uma fazenda é registrado e a rodada segue para a próxima.
 */
/** Teto do que um aviso (rota aberta) consegue provocar: uma rodada a cada 30 s, uma limpeza do mapa a cada 5 min. */
const RODADA_POR_AVISO_MS = 30_000;
const LIMPEZA_POR_AVISO_MS = 5 * 60_000;

@Injectable()
export class SincronizacaoDeereService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('SincronizacaoDeere');
  private relogio: NodeJS.Timeout | null = null;
  private rodando = false;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
    private readonly repo: AtividadeDeereRepository,
    @Inject(ConexaoDeereService) private readonly conexao: ConexaoDeereService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.deereProvedor !== 'deere' || !this.provedor.sincronizar) return;
    void this.rodar();
    this.relogio = setInterval(() => void this.rodar(), INTERVALO_MS);
    this.relogio.unref();
  }

  onApplicationShutdown(): void {
    if (this.relogio) clearInterval(this.relogio);
  }

  /** Organização trocada: apaga o que veio da anterior e já começa a ler a nova. */
  async recomecar(orgId: string): Promise<void> {
    await this.repo.limpar(orgId);
    this.provedor.esquecer?.(orgId);
    // Organizações novas: os avisos da John Deere são conferidos de novo para elas.
    this.avisosConferidos.delete(orgId);
    this.agora(orgId);
  }

  /** Uma fazenda agora (ex.: logo depois de conectar). Não espera terminar. */
  agora(orgId: string): void {
    void this.sincronizar(orgId);
  }

  /**
   * A John Deere avisou que há dado novo. `mapaMudou`: talhão, contorno ou linha mudaram, então o mapa guardado é
   * jogado fora antes de ler.
   *
   * A rota do aviso é ABERTA (qualquer um na internet consegue chamá-la), então o aviso não pode custar caro: no
   * máximo uma rodada a cada 30 s e uma limpeza do mapa a cada 5 min, por mais avisos que cheguem. Sem esse teto,
   * um estranho chamando a rota em sequência esvaziaria o que está guardado de TODAS as fazendas e faria o servidor
   * gastar o limite de consultas da John Deere, deixando o app lento para todo mundo.
   */
  async avisado(mapaMudou: boolean, agora = Date.now()): Promise<void> {
    if (mapaMudou && agora - this.ultimaLimpezaPorAviso >= LIMPEZA_POR_AVISO_MS) {
      this.ultimaLimpezaPorAviso = agora;
      for (const orgId of await this.repo.fazendasProntas().catch(() => [] as string[])) this.provedor.esquecer?.(orgId);
    }
    if (agora - this.ultimaRodadaPorAviso < RODADA_POR_AVISO_MS) return;
    this.ultimaRodadaPorAviso = agora;
    await this.rodar();
  }
  private ultimaRodadaPorAviso = 0;
  private ultimaLimpezaPorAviso = 0;

  async rodar(): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    try {
      for (const orgId of await this.repo.fazendasProntas()) await this.sincronizar(orgId);
    } catch (e) {
      this.log.warn(`Rodada falhou: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.rodando = false;
    }
  }

  /** Quando conferir de novo os avisos de cada fazenda. Ligado com sucesso: não confere mais até o servidor reiniciar. */
  private readonly avisosConferidos = new Map<string, number>();

  /**
   * Liga na John Deere os avisos de dado novo (operação de campo, talhão, contorno, linha de guia, export pronto)
   * assim que a fazenda está conectada, sem ninguém apertar botão. `ativarAviso` confere a lista antes e nunca
   * cria duplicado. Se a Deere recusar (ex.: API de Webhook não aprovada), tenta de novo em 1 h; o app funciona
   * do mesmo jeito, só lê a cada 2 min em vez de na hora.
   */
  private async garantirAvisos(orgId: string, agora = Date.now()): Promise<void> {
    if ((this.avisosConferidos.get(orgId) ?? 0) > agora) return;
    try {
      const r = await this.conexao.ativarAviso(orgId);
      this.avisosConferidos.set(orgId, Number.POSITIVE_INFINITY);
      const mudou = r.avisos.filter((a) => a.situacao !== 'ja-ligado');
      this.log.log(`Fazenda ${orgId}: avisos da John Deere conferidos (${r.avisos.map((a) => `${a.evento}: ${a.situacao}`).join(', ')})${mudou.length ? '' : ', nada a mudar'}`);
    } catch (e) {
      this.avisosConferidos.set(orgId, agora + 3_600_000);
      this.log.warn(`Fazenda ${orgId}: não deu para ligar os avisos da John Deere agora (${e instanceof Error ? e.message : String(e)}). Nova tentativa em 1 h.`);
    }
  }

  async sincronizar(orgId: string): Promise<void> {
    try {
      await this.garantirAvisos(orgId);
      // Primeiro o que as telas pedem ao abrir (rápido); depois os exports (lentos).
      await this.provedor.aquecer?.(orgId).catch((e: unknown) => this.log.warn(`Fazenda ${orgId} (aquecer): ${e instanceof Error ? e.message : String(e)}`));
      const r = await this.provedor.sincronizar?.(orgId);
      if (r) this.log.log(`Fazenda ${orgId}: ${r.lidas} lidas, ${r.esperando} esperando, ${r.falhas} falhas`);
      // Por último, um pedaço da busca do passado (caminho dos dias anteriores): poucos por rodada, até fechar tudo.
      const passado = await this.provedor.recuperarPassado?.(orgId);
      if (passado && (passado.fechados || passado.faltam)) this.log.log(`Fazenda ${orgId}: busca do passado fechou ${passado.fechados} dia(s) de máquina, faltam ${passado.faltam}`);
    } catch (e) {
      this.log.warn(`Fazenda ${orgId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
