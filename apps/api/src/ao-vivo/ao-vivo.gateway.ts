import type { Server as ServidorHttp } from 'node:http';
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { FECHAMENTO_NAO_AUTENTICADO, QuadroDoAppSchema, type QuadroDoServidor } from '@talhio/shared';
import { WebSocketServer, type WebSocket } from 'ws';
import { AssistenteService } from '../assistente/assistente.service.js';
import { TokenService, type DadosDoToken } from '../auth/token.service.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';

export const CAMINHO_AO_VIVO = '/v1/ao-vivo';

const PRAZO_PARA_AUTENTICAR_MS = 5_000;
/** De quanto em quanto tempo o servidor confere as máquinas de quem está com o app aberto. */
const INTERVALO_MS = 2_000;
const BATIDA_MS = 25_000;
/** Perguntas à IA por minuto, por pessoa (cada uma é uma chamada paga). Igual ao limite do POST. */
const PERGUNTAS_POR_MINUTO = 15;

interface Cliente {
  socket: WebSocket;
  dados: DadosDoToken | null;
  vivo: boolean;
  pergunta: boolean;
  perguntas: number[];
  /** Os quadros de um cliente são tratados um de cada vez, na ordem em que chegaram (o login vale para o quadro seguinte). */
  fila: Promise<void>;
}

/**
 * Canal ao vivo do app. Faz duas coisas:
 * - empurra a lista de máquinas quando posição, status ou medições mudam (só enquanto alguém da fazenda está conectado,
 *   então a John Deere não é consultada à toa);
 * - transmite a resposta do assistente aos poucos.
 * Segurança: o token vai no primeiro quadro (não na URL, que fica em log); sem ele em 5 s o canal é fechado, e
 * tudo é da organização do token. Quadros grandes (>16 kB) derrubam a conexão.
 */
@Injectable()
export class AoVivoGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('AoVivo');
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  private readonly clientes = new Set<Cliente>();
  /** O último que cada fazenda recebeu: só reenvia se mudou. */
  private readonly ultimo = new Map<string, string>();
  private relogio: NodeJS.Timeout | null = null;
  private batida: NodeJS.Timeout | null = null;
  private rodando = false;

  constructor(
    @Inject(HttpAdapterHost) private readonly host: HttpAdapterHost,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(MaquinasService) private readonly maquinas: MaquinasService,
    @Inject(AssistenteService) private readonly assistente: AssistenteService,
  ) {}

  onApplicationBootstrap(): void {
    const servidor = this.host.httpAdapter?.getHttpServer() as ServidorHttp | undefined;
    if (!servidor) return;
    servidor.on('upgrade', (requisicao, socket, cabeca) => {
      const caminho = (requisicao.url ?? '').split('?')[0];
      if (caminho !== CAMINHO_AO_VIVO) return; // outros usos do servidor seguem o caminho deles
      this.wss.handleUpgrade(requisicao, socket, cabeca, (ws) => this.aceitar(ws));
    });
    this.relogio = setInterval(() => void this.rodada(), INTERVALO_MS);
    this.batida = setInterval(() => this.conferirVivos(), BATIDA_MS);
    this.relogio.unref();
    this.batida.unref();
  }

  onApplicationShutdown(): void {
    if (this.relogio) clearInterval(this.relogio);
    if (this.batida) clearInterval(this.batida);
    for (const c of this.clientes) c.socket.close(1001);
    this.wss.close();
  }

  /** Quantas pessoas estão conectadas (testes e diagnóstico). */
  get conectados(): number {
    return this.clientes.size;
  }

  private aceitar(socket: WebSocket): void {
    const cliente: Cliente = { socket, dados: null, vivo: true, pergunta: false, perguntas: [], fila: Promise.resolve() };
    this.clientes.add(cliente);
    this.log.log(`App conectou ao canal (${this.clientes.size} conectado(s))`);
    const prazo = setTimeout(() => {
      if (!cliente.dados) socket.close(FECHAMENTO_NAO_AUTENTICADO, 'Sem login');
    }, PRAZO_PARA_AUTENTICAR_MS);
    prazo.unref();

    socket.on('pong', () => (cliente.vivo = true));
    socket.on('message', (bruto) => {
      const texto = bruto.toString();
      cliente.fila = cliente.fila.then(() => this.receber(cliente, texto)).catch(() => socket.close(1011, 'Erro'));
    });
    socket.on('error', () => socket.terminate());
    socket.on('close', () => {
      clearTimeout(prazo);
      this.clientes.delete(cliente);
      this.log.log(`App saiu do canal${cliente.dados ? ` (fazenda ${cliente.dados.orgId})` : ' sem ter feito login'} (${this.clientes.size} conectado(s))`);
    });
  }

  private async receber(cliente: Cliente, bruto: string): Promise<void> {
    let quadro;
    try {
      quadro = QuadroDoAppSchema.safeParse(JSON.parse(bruto));
    } catch {
      return cliente.socket.close(1003, 'Quadro inválido');
    }
    if (!quadro.success) return cliente.socket.close(1003, 'Quadro inválido');
    const q = quadro.data;

    if (q.tipo === 'auth') {
      const dados = await this.tokens.ler(q.token);
      if (!dados) {
        this.log.warn('Canal: token recusado');
        return cliente.socket.close(FECHAMENTO_NAO_AUTENTICADO, 'Token inválido');
      }
      cliente.dados = dados;
      this.log.log(`Canal: login aceito (fazenda ${dados.orgId})`);
      this.enviar(cliente, { tipo: 'pronto' });
      // Entrega o estado atual na hora, sem esperar a próxima rodada.
      this.ultimo.delete(dados.orgId);
      void this.rodada();
      return;
    }

    if (!cliente.dados) return cliente.socket.close(FECHAMENTO_NAO_AUTENTICADO, 'Faça login primeiro');
    await this.perguntar(cliente, cliente.dados, q.id, q.pergunta);
  }

  private async perguntar(cliente: Cliente, dados: DadosDoToken, id: string, pergunta: { conversaId: string | null; texto: string }): Promise<void> {
    const agora = Date.now();
    cliente.perguntas = cliente.perguntas.filter((t) => agora - t < 60_000);
    if (cliente.pergunta) return this.enviar(cliente, { tipo: 'chat.erro', id, codigo: 'RESPOSTA_EM_ANDAMENTO', mensagem: 'Espere a resposta atual terminar.' });
    if (cliente.perguntas.length >= PERGUNTAS_POR_MINUTO) return this.enviar(cliente, { tipo: 'chat.erro', id, codigo: 'MUITAS_PERGUNTAS', mensagem: 'Muitas perguntas seguidas. Tente de novo em um minuto.' });
    cliente.perguntas.push(agora);
    cliente.pergunta = true;
    const inicioDaPergunta = Date.now();
    this.log.log(`Chat: pergunta recebida (${pergunta.texto.length} caracteres)`);
    try {
      const resposta = await this.assistente.responderEmFluxo({ orgId: dados.orgId, usuarioId: dados.usuarioId }, pergunta.conversaId, pergunta.texto, (texto) =>
        this.enviar(cliente, { tipo: 'chat.trecho', id, texto }),
      );
      this.enviar(cliente, { tipo: 'chat.fim', id, resposta });
      this.log.log(`Chat: respondido em ${Date.now() - inicioDaPergunta} ms`);
    } catch (erro) {
      this.log.warn(`Chat: falhou em ${Date.now() - inicioDaPergunta} ms: ${erro instanceof Error ? erro.message : String(erro)}`);
      const corpo = (erro as { getResponse?: () => unknown }).getResponse?.() as { codigo?: string; mensagem?: string } | undefined;
      this.enviar(cliente, { tipo: 'chat.erro', id, codigo: corpo?.codigo ?? 'ERRO', mensagem: corpo?.mensagem ?? 'O assistente não respondeu agora. Tente de novo em instantes.' });
    } finally {
      cliente.pergunta = false;
    }
  }

  /** Uma passada: para cada fazenda com gente conectada, lê as máquinas e envia se algo mudou. */
  async rodada(): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    try {
      const fazendas = new Set<string>();
      for (const c of this.clientes) if (c.dados) fazendas.add(c.dados.orgId);
      for (const orgId of [...this.ultimo.keys()]) if (!fazendas.has(orgId)) this.ultimo.delete(orgId); // ninguém mais: esquece
      await Promise.all(
        [...fazendas].map(async (orgId) => {
          try {
            const inicio = Date.now();
            const maquinas = await this.maquinas.listar(orgId);
            const assinatura = JSON.stringify(maquinas);
            if (this.ultimo.get(orgId) === assinatura) return;
            this.ultimo.set(orgId, assinatura);
            // O que o app vai receber, uma linha por máquina (sem coordenada nem número de série).
            const idade = (iso: string) => `${Math.round((Date.now() - Date.parse(iso)) / 60_000)} min`;
            this.log.log(
              `Fazenda ${orgId}: ${maquinas.length} máquina(s) lidas em ${Date.now() - inicio} ms, enviando ao app:\n` +
                maquinas
                  .map((m) => `  ${m.nome}: ${m.status}, sinal há ${idade(m.ultimoSinal)}, posição ${m.posicao ? 'sim' : 'NÃO'}, talhão ${m.talhaoNome ?? '-'}, velocidade ${m.velocidadeKmH ?? '-'}, motor ${m.motorLigado ? 'ligado' : 'desligado'}, tanque ${m.combustivelPct ?? '-'}, horímetro ${m.horimetro ?? '-'}, horas hoje ${m.horasHoje}, área hoje ${m.areaHojeHa}`)
                  .join('\n'),
            );
            for (const c of this.clientes) if (c.dados?.orgId === orgId) this.enviar(c, { tipo: 'maquinas', maquinas });
          } catch (erro) {
            this.log.warn(`Fazenda ${orgId}: ${erro instanceof Error ? erro.message : String(erro)}`);
          }
        }),
      );
    } finally {
      this.rodando = false;
    }
  }

  /** Quem não responde à batida é derrubado (celular que saiu da rede sem avisar). */
  private conferirVivos(): void {
    for (const c of this.clientes) {
      if (!c.vivo) {
        c.socket.terminate();
        continue;
      }
      c.vivo = false;
      c.socket.ping();
    }
  }

  private enviar(cliente: Cliente, quadro: QuadroDoServidor): void {
    if (cliente.socket.readyState === cliente.socket.OPEN) cliente.socket.send(JSON.stringify(quadro));
  }
}
