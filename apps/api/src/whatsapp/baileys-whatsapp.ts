import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import makeWASocket, { BufferJSON, DisconnectReason, fetchLatestBaileysVersion, initAuthCreds, makeCacheableSignalKeyStore, proto, type AuthenticationCreds, type SignalDataTypeMap, type WASocket } from '@whiskeysockets/baileys';
import type { GrupoWhatsapp } from '@talhio/shared';
import { CONFIG, type Config } from '../core/config.js';
import { cifrar, decifrar } from '../shared/cripto.js';
import { ARMAZEM_WHATSAPP, type ArmazemWhatsapp } from './armazem-whatsapp.js';
import { WhatsappRepository } from './whatsapp.repository.js';
import type { AnexoWhatsapp, EstadoDaConexao, ProvedorWhatsapp } from './whatsapp.tokens.js';

type Situacao = 'abrindo' | 'pareando' | 'conectado' | 'substituida';

interface Sessao {
  socket: WASocket;
  situacao: Situacao;
  numero: string | null;
  tentativas: number;
  /** Religação agendada depois de uma queda. */
  religar?: NodeJS.Timeout;
}

interface Pareamento {
  telefone: string;
  pedido: boolean;
  resolver: (codigo: string) => void;
  rejeitar: (erro: Error) => void;
}

/** Versão do WhatsApp Web usada se não der para buscar a mais recente. */
const VERSAO_PADRAO: [number, number, number] = [2, 3000, 1023561727];
const PRAZO_DO_CODIGO_MS = 30_000;
const PRAZO_PARA_ENVIAR_MS = 15_000;
/** Pausa entre mensagens da mesma fazenda: mandar rajada é o que faz o WhatsApp banir o número. */
const PAUSA_ENTRE_MENSAGENS_MS = [1_500, 3_500] as const;

const silencio = { level: 'silent', trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {}, child() { return silencio; } };

/** Quatro últimos dígitos: o log nunca guarda o número inteiro. */
const mascara = (telefone: string) => `…${telefone.slice(-4)}`;
const codigoDoErro = (erro: unknown): number | undefined => (erro as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Único arquivo que conhece o Baileys (WhatsApp Web, sem a API oficial da Meta). Uma conexão por fazenda, mantida
 * neste processo: por isso a API roda em UMA cópia (duas cópias disputariam a mesma conexão). Credenciais e chaves
 * ficam no Postgres, cifradas, e a conexão volta sozinha quando a API reinicia.
 */
@Injectable()
export class BaileysWhatsapp implements ProvedorWhatsapp, OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('WhatsApp');
  private readonly sessoes = new Map<string, Sessao>();
  /** Evita abrir dois sockets para a mesma fazenda ao mesmo tempo (o WhatsApp derruba os dois com "conflict"). */
  private readonly abrindo = new Map<string, Promise<void>>();
  /** Fila de envio por fazenda, para espaçar as mensagens. */
  private readonly filas = new Map<string, Promise<unknown>>();
  private versao: [number, number, number] | null = null;
  private encerrando = false;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(WhatsappRepository) private readonly repo: WhatsappRepository,
    @Inject(ARMAZEM_WHATSAPP) private readonly armazem: ArmazemWhatsapp,
  ) {}

  private get chave(): string {
    if (!this.config.whatsappCriptoChave) throw new Error('WHATSAPP_CRIPTO_CHAVE não definida');
    return this.config.whatsappCriptoChave;
  }

  onModuleInit(): void {
    // Não segura a subida da API: cada fazenda volta no seu tempo.
    void this.restaurar().catch((e) => this.log.error(`restaurar: ${e instanceof Error ? e.message : e}`));
  }

  onModuleDestroy(): void {
    // Fecha sem sair do aparelho: as credenciais seguem valendo para a próxima subida.
    this.encerrando = true;
    for (const s of this.sessoes.values()) {
      if (s.religar) clearTimeout(s.religar);
      s.socket.end(undefined);
    }
    this.sessoes.clear();
    void this.armazem.fechar();
  }

  private async restaurar(): Promise<void> {
    const fazendas = await this.repo.pareadas();
    const LOTE = 3;
    for (let i = 0; i < fazendas.length; i += LOTE) {
      await Promise.all(fazendas.slice(i, i + LOTE).map((orgId) => this.abrir(orgId, null).catch((e) => this.log.error(`restaurar ${orgId}: ${e instanceof Error ? e.message : e}`))));
    }
    if (fazendas.length) this.log.log(`${fazendas.length} conexão(ões) do WhatsApp religada(s)`);
  }

  // ---- Credenciais e chaves no banco, cifradas ----

  private async estadoDeAutenticacao(orgId: string) {
    const guardadas = await this.armazem.lerCredenciais(orgId);
    let creds: AuthenticationCreds;
    try {
      creds = guardadas ? (JSON.parse(decifrar(guardadas, this.chave), BufferJSON.reviver) as AuthenticationCreds) : initAuthCreds();
    } catch {
      // Chave trocada ou dado corrompido: não dá para usar. Recomeça do zero (a pessoa pede um código novo).
      this.log.error(`credenciais ilegíveis (${orgId}): recomeçando do zero`);
      await this.esquecer(orgId);
      creds = initAuthCreds();
    }
    const state = {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(tipo: T, ids: string[]) => {
          const guardado = await this.armazem.lerChaves(orgId, tipo, ids);
          const saida: { [id: string]: SignalDataTypeMap[T] } = {};
          for (const [id, cifrado] of guardado) {
            try {
              let valor = JSON.parse(decifrar(cifrado, this.chave), BufferJSON.reviver);
              if (tipo === 'app-state-sync-key' && valor) valor = proto.Message.AppStateSyncKeyData.fromObject(valor);
              saida[id] = valor;
            } catch {
              // Uma chave ilegível vira "não existe": o WhatsApp pede de novo.
            }
          }
          return saida;
        },
        set: async (dados: { [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null } }) => {
          for (const [tipo, valores] of Object.entries(dados)) {
            const mapa = new Map<string, string | null>(Object.entries(valores ?? {}).map(([id, v]) => [id, v ? cifrar(JSON.stringify(v, BufferJSON.replacer), this.chave) : null]));
            await this.armazem.gravarChaves(orgId, tipo, mapa);
          }
        },
      },
    };
    const salvar = () => this.armazem.gravarCredenciais(orgId, cifrar(JSON.stringify(state.creds, BufferJSON.replacer), this.chave));
    return { state, salvar };
  }

  // ---- Conexão ----

  private async versaoDoWhatsapp(): Promise<[number, number, number]> {
    if (this.versao) return this.versao;
    try {
      const { version } = await fetchLatestBaileysVersion();
      this.versao = version;
    } catch {
      this.versao = VERSAO_PADRAO;
    }
    return this.versao;
  }

  /** Abre (ou reabre) o socket da fazenda. Uma abertura por vez por fazenda. */
  private abrir(orgId: string, pareamento: Pareamento | null): Promise<void> {
    const andamento = this.abrindo.get(orgId);
    if (andamento) return andamento;
    const p = this.criarSocket(orgId, pareamento).finally(() => this.abrindo.delete(orgId));
    this.abrindo.set(orgId, p);
    return p;
  }

  private async criarSocket(orgId: string, pareamento: Pareamento | null): Promise<void> {
    if (this.encerrando) return;
    this.fecharSocket(orgId);
    const { state, salvar } = await this.estadoDeAutenticacao(orgId);
    const socket = makeWASocket({
      version: await this.versaoDoWhatsapp(),
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, silencio as never) },
      printQRInTerminal: false,
      logger: silencio as never,
      // O pareamento por código só é aceito para um navegador conhecido.
      browser: ['Ubuntu', 'Chrome', '22.04.4'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      shouldSyncHistoryMessage: () => false,
    });
    const sessao: Sessao = { socket, situacao: pareamento ? 'pareando' : 'abrindo', numero: null, tentativas: this.sessoes.get(orgId)?.tentativas ?? 0 };
    this.sessoes.set(orgId, sessao);
    socket.ev.on('creds.update', () => void salvar().catch((e) => this.log.error(`salvar credenciais: ${e instanceof Error ? e.message : e}`)));

    socket.ev.on('connection.update', (u) => {
      void this.aoMudarConexao(orgId, socket, sessao, pareamento, state.creds, u).catch((e) => this.log.error(`conexão (${orgId}): ${e instanceof Error ? e.message : e}`));
    });
  }

  private async aoMudarConexao(
    orgId: string,
    socket: WASocket,
    sessao: Sessao,
    pareamento: Pareamento | null,
    creds: AuthenticationCreds,
    u: { connection?: string; lastDisconnect?: { error?: Error }; qr?: string },
  ): Promise<void> {
    // Evento de um socket que já foi trocado por outro: ignora.
    if (this.sessoes.get(orgId)?.socket !== socket) return;

    if (u.qr) {
      if (pareamento && !pareamento.pedido) {
        pareamento.pedido = true;
        try {
          const codigo = await socket.requestPairingCode(pareamento.telefone);
          this.log.log(`código de pareamento gerado (${mascara(pareamento.telefone)})`);
          pareamento.resolver(codigo);
        } catch (e) {
          pareamento.rejeitar(e instanceof Error ? e : new Error(String(e)));
        }
      } else if (!pareamento && creds.me) {
        // Pedindo QR com credenciais antigas: o WhatsApp não reconhece mais este aparelho.
        this.log.warn(`conexão não reconhecida pelo WhatsApp (${orgId}): precisa de um código novo`);
        await this.descartar(orgId);
      }
      return;
    }

    if (u.connection === 'open') {
      const numero = (socket.user?.id ?? '').split(':')[0]?.split('@')[0] ?? '';
      sessao.situacao = 'conectado';
      sessao.numero = numero;
      sessao.tentativas = 0;
      await this.repo.marcarConectado(orgId, numero);
      this.log.log(`conectado (${mascara(numero)})`);
      return;
    }

    if (u.connection === 'close') {
      const motivo = codigoDoErro(u.lastDisconnect?.error);
      this.log.log(`caiu (motivo ${motivo ?? '?'}, pareado ${creds.me ? 'sim' : 'não'})`);
      if (motivo === DisconnectReason.loggedOut) return void (await this.descartar(orgId));
      // Outra cópia da API (ou outro aparelho) tomou a conexão. Não apaga nada: quem a tomou segue com ela.
      if (motivo === DisconnectReason.connectionReplaced) {
        sessao.situacao = 'substituida';
        return;
      }
      // Depois de aceitar o código o WhatsApp pede para reabrir a conexão: faz parte do pareamento.
      if (motivo === DisconnectReason.restartRequired) return void (await this.abrir(orgId, null));
      if (!creds.me) {
        // Caiu antes de a pessoa digitar o código (ou o código venceu).
        pareamento?.rejeitar(new Error('A conexão foi encerrada antes de gerar o código'));
        this.sessoes.delete(orgId);
        return;
      }
      // Queda de rede ou reinício do WhatsApp: religa com espera crescente.
      sessao.situacao = 'abrindo';
      sessao.tentativas += 1;
      const espera = Math.min(60_000, 2_000 * 2 ** Math.min(sessao.tentativas, 5));
      sessao.religar = setTimeout(() => void this.abrir(orgId, null).catch((e) => this.log.error(`religar: ${e instanceof Error ? e.message : e}`)), espera);
    }
  }

  private fecharSocket(orgId: string): void {
    const s = this.sessoes.get(orgId);
    if (!s) return;
    if (s.religar) clearTimeout(s.religar);
    this.sessoes.delete(orgId);
    try {
      s.socket.end(undefined);
    } catch {
      // já estava fechado
    }
  }

  /** Esquece a fazenda: fecha o socket e apaga credenciais e chaves. */
  private async descartar(orgId: string): Promise<void> {
    this.fecharSocket(orgId);
    await this.esquecer(orgId);
  }

  private async esquecer(orgId: string): Promise<void> {
    await Promise.all([this.armazem.apagarTudo(orgId), this.repo.apagar(orgId)]);
  }

  // ---- O que o resto da API usa ----

  async pedirCodigo(orgId: string, telefone: string): Promise<string> {
    // Recomeça do zero: credenciais e chaves antigas atrapalham um pareamento novo.
    await this.descartar(orgId);
    return new Promise<string>((resolve, reject) => {
      const prazo = setTimeout(() => {
        this.fecharSocket(orgId);
        reject(new Error('Tempo esgotado ao gerar o código'));
      }, PRAZO_DO_CODIGO_MS);
      const pareamento: Pareamento = {
        telefone,
        pedido: false,
        resolver: (c) => (clearTimeout(prazo), resolve(c)),
        rejeitar: (e) => (clearTimeout(prazo), this.fecharSocket(orgId), reject(e)),
      };
      this.abrir(orgId, pareamento).catch(pareamento.rejeitar);
    });
  }

  async estado(orgId: string): Promise<EstadoDaConexao> {
    const s = this.sessoes.get(orgId);
    if (s?.situacao === 'conectado') {
      const linha = await this.repo.buscar(orgId);
      return { estado: 'conectado', numero: s.numero, conectadoEm: linha?.conectadoEm?.toISOString() ?? null };
    }
    if (s?.situacao === 'pareando') return { estado: 'aguardando-codigo', numero: null, conectadoEm: null };
    if (s?.situacao === 'abrindo') return { estado: 'reconectando', numero: null, conectadoEm: null };
    return { estado: 'desconectado', numero: null, conectadoEm: null };
  }

  async enviarTexto(orgId: string, telefone: string, texto: string): Promise<void> {
    // Uma de cada vez por fazenda, com pausa entre elas.
    const anterior = this.filas.get(orgId) ?? Promise.resolve();
    const minha = anterior.catch(() => undefined).then(async () => {
      await this.enviarAgora(orgId, telefone, texto);
      await esperar(PAUSA_ENTRE_MENSAGENS_MS[0] + Math.random() * (PAUSA_ENTRE_MENSAGENS_MS[1] - PAUSA_ENTRE_MENSAGENS_MS[0]));
    });
    this.filas.set(orgId, minha);
    return minha;
  }

  private async conectada(orgId: string): Promise<Sessao> {
    const limite = Date.now() + PRAZO_PARA_ENVIAR_MS;
    for (;;) {
      const s = this.sessoes.get(orgId);
      if (s?.situacao === 'conectado') return s;
      if (!s || s.situacao === 'substituida' || s.situacao === 'pareando' || Date.now() > limite) throw new Error('WhatsApp não conectado');
      await esperar(500);
    }
  }

  private async enviarAgora(orgId: string, telefone: string, texto: string): Promise<void> {
    const { socket } = await this.conectada(orgId);
    // Número do Brasil: o WhatsApp aceita com ou sem o 9 extra; pergunta qual existe.
    for (const candidato of candidatos(telefone)) {
      const [achado] = (await socket.onWhatsApp(`${candidato}@s.whatsapp.net`).catch(() => undefined)) ?? [];
      if (achado?.exists) {
        await socket.sendMessage(achado.jid, { text: texto });
        return;
      }
    }
    throw new Error(`O número ${mascara(telefone)} não está no WhatsApp`);
  }

  async listarGrupos(orgId: string): Promise<GrupoWhatsapp[]> {
    const { socket } = await this.conectada(orgId);
    const todos = await socket.groupFetchAllParticipating();
    return Object.values(todos)
      .filter((g) => g.id.endsWith('@g.us'))
      .map((g) => ({ id: g.id, nome: g.subject, participantes: g.participants.length }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  async enviarNoGrupo(orgId: string, grupoId: string, texto: string, anexo?: AnexoWhatsapp): Promise<void> {
    const anterior = this.filas.get(orgId) ?? Promise.resolve();
    const minha = anterior.catch(() => undefined).then(async () => {
      const { socket } = await this.conectada(orgId);
      await socket.sendMessage(grupoId, anexo ? { document: Buffer.from(anexo.arquivo), mimetype: anexo.tipo, fileName: anexo.nome, caption: texto } : { text: texto });
      await esperar(PAUSA_ENTRE_MENSAGENS_MS[0] + Math.random() * (PAUSA_ENTRE_MENSAGENS_MS[1] - PAUSA_ENTRE_MENSAGENS_MS[0]));
    });
    this.filas.set(orgId, minha);
    return minha;
  }

  async desconectar(orgId: string): Promise<void> {
    const s = this.sessoes.get(orgId);
    if (s) await s.socket.logout().catch(() => undefined); // sai do "aparelhos conectados" do celular
    await this.descartar(orgId);
  }
}

/** Com e sem o 9 depois do DDD (celular do Brasil), na ordem em que vale tentar. */
export function candidatos(telefone: string): string[] {
  const m = /^55(\d{2})(9?)(\d{8})$/.exec(telefone);
  if (!m) return [telefone];
  const [, ddd, nove, resto] = m;
  return nove ? [telefone, `55${ddd}${resto}`] : [telefone, `55${ddd}9${resto}`];
}
