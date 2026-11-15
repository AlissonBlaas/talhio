/** Erro da John Deere com um código estável para a API traduzir em resposta. */
export class DeereErro extends Error {
  constructor(
    readonly codigo: 'DEERE_LIMITE' | 'DEERE_TERMOS' | 'DEERE_SEM_ACESSO' | 'DEERE_NAO_ENCONTRADO' | 'DEERE_ERRO',
    mensagem: string,
    readonly status: number,
    /** Rota que falhou (sem endereço-base nem parâmetros), para achar o problema nos logs. */
    readonly rota?: string,
    /** Texto que a Deere mandou junto de um 401/403 (diz a licença e os escopos que faltam). Só para o log, nunca vai ao app. */
    readonly detalhe?: string,
  ) {
    super(mensagem);
    this.name = 'DeereErro';
  }
}

export const ACEITA_JSON = 'application/vnd.deere.axiom.v3+json';

export interface ClienteDeereConfig {
  baseUrl: string;
  /** Token de acesso válido da fazenda (a renovação fica no backend). */
  obterToken: (orgId: string) => Promise<string>;
  http?: typeof fetch;
  /** Espera entre tentativas; os testes trocam por uma versão instantânea. */
  esperar?: (ms: number) => Promise<void>;
  /** Recebe uma linha por chamada à John Deere (rota, resposta, tempo, quantos itens). Nunca leva token nem dado da fazenda. */
  registrar?: (linha: string) => void;
}

type Pagina<T> = { values?: T; links?: { rel: string; uri: string }[] };

const TENTATIVAS = 3;
/** No máximo estas consultas à John Deere ao mesmo tempo (as demais esperam na fila): evita 429 e não trava o servidor. */
const SIMULTANEAS_NA_DEERE = 6;
/** Uma consulta que não responde nesse tempo é cortada, para não deixar a tela esperando. */
const PRAZO_MS = 20_000;
const PAGINAS_MAX = 50;

/** GET na API da John Deere: token da fazenda, paginação pelo link `nextPage` e nova tentativa em 429/503. */
export class ClienteDeere {
  private readonly http: typeof fetch;
  private ativas = 0;
  private readonly fila: (() => void)[] = [];
  /** Consultas de leitura idênticas em andamento: quem pede a mesma coisa junto recebe a mesma resposta. */
  private readonly emAndamento = new Map<string, Promise<unknown>>();
  private readonly esperar: (ms: number) => Promise<void>;

  constructor(private readonly cfg: ClienteDeereConfig) {
    const base = cfg.http ?? fetch;
    // Toda chamada passa pela fila (limite de concorrência) e tem prazo.
    this.http = (async (url, init) => {
      await this.entrar();
      try {
        return await base(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(PRAZO_MS) });
      } finally {
        this.sair();
      }
    }) as typeof fetch;
    this.esperar = cfg.esperar ?? ((ms) => new Promise((ok) => setTimeout(ok, ms)));
  }

  /** Um recurso só. `caminho` começa com "/" (ex.: "/organizations/1/fields/2"). */
  async obter<T>(orgId: string, caminho: string): Promise<T> {
    return this.pedir<T>(orgId, caminho.startsWith('http') ? caminho : `${this.cfg.baseUrl}${caminho}`);
  }

  /** Como `obter`, pedindo à Deere a lista inteira numa resposta só (sem paginar). Usado nas medições da máquina. */
  async obterCompleto<T>(orgId: string, caminho: string): Promise<T> {
    return this.pedir<T>(orgId, caminho.startsWith('http') ? caminho : `${this.cfg.baseUrl}${caminho}`, undefined, false, ACEITA_JSON, { 'x-deere-no-paging': 'true' });
  }

  /** Todos os itens de uma lista, seguindo as páginas. */
  async listar<T>(orgId: string, caminho: string, aceita?: string): Promise<T[]> {
    const itens: T[] = [];
    let proxima: string | null = caminho.startsWith('http') ? caminho : `${this.cfg.baseUrl}${caminho}`;
    for (let i = 0; proxima && i < PAGINAS_MAX; i++) {
      const pagina: Pagina<T | T[]> = await this.pedir<Pagina<T | T[]>>(orgId, proxima, undefined, false, aceita);
      // Algumas APIs devolvem `values` como lista, outras como um objeto só.
      const valores = pagina.values === undefined ? [] : Array.isArray(pagina.values) ? pagina.values : [pagina.values];
      itens.push(...(valores as T[]));
      proxima = pagina.links?.find((l) => l.rel === 'nextPage')?.uri ?? null;
    }
    return itens;
  }

  /**
   * POST de um recurso novo. A Deere responde 201 com o endereço do recurso no cabeçalho `Location`; devolve o id
   * (último trecho) ou, se não houver, o `id` do corpo. `base` troca a raiz (o export fica em /isg, não em /platform).
   */
  async criar(orgId: string, caminho: string, corpo: unknown, opcoes: { base?: string; cabecalhos?: Record<string, string> } = {}): Promise<string | null> {
    const resposta = await this.pedir<Response>(orgId, `${opcoes.base ?? this.cfg.baseUrl}${caminho}`, { method: 'POST', corpo, cabecalhos: opcoes.cabecalhos }, true);
    const local = resposta.headers.get('Location');
    if (local) return local.split('/').filter(Boolean).pop() ?? null;
    const texto = await resposta.text().catch(() => '');
    try {
      const id = (JSON.parse(texto) as { id?: unknown }).id;
      return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
    } catch {
      return null;
    }
  }

  /** GET que devolve o corpo como texto (a API ISO 15143-3 responde em XML). */
  async texto(orgId: string, url: string, aceita: string): Promise<string> {
    return (await this.pedir<Response>(orgId, url, undefined, true, aceita)).text();
  }

  /** Baixa um arquivo de endereço assinado (sem token: o endereço já carrega a permissão). */
  async baixar(url: string): Promise<Uint8Array> {
    const inicio = Date.now();
    const resposta = await this.http(url);
    this.cfg.registrar?.(`GET arquivo do export -> ${resposta.status} em ${Date.now() - inicio} ms`);
    if (!resposta.ok) throw new DeereErro('DEERE_ERRO', `Não consegui baixar o arquivo da John Deere (${resposta.status}).`, resposta.status);
    return new Uint8Array(await resposta.arrayBuffer());
  }

  private entrar(): Promise<void> {
    if (this.ativas < SIMULTANEAS_NA_DEERE) {
      this.ativas++;
      return Promise.resolve();
    }
    return new Promise((ok) => this.fila.push(ok));
  }

  private sair(): void {
    const proximo = this.fila.shift();
    if (proximo) proximo(); // a vaga passa direto para o próximo da fila
    else this.ativas--;
  }

  private pedir<T>(orgId: string, url: string, envio?: { method: string; corpo: unknown; cabecalhos?: Record<string, string> }, bruto = false, aceita: string = ACEITA_JSON, extras?: Record<string, string>): Promise<T> {
    if (envio || bruto) return this.executar<T>(orgId, url, envio, bruto, aceita, extras);
    const chave = `${orgId}|${aceita}|${url}`;
    const igual = this.emAndamento.get(chave) as Promise<T> | undefined;
    if (igual) return igual;
    const nova = this.executar<T>(orgId, url, envio, bruto, aceita, extras).finally(() => this.emAndamento.delete(chave));
    this.emAndamento.set(chave, nova);
    return nova;
  }

  private async executar<T>(orgId: string, url: string, envio?: { method: string; corpo: unknown; cabecalhos?: Record<string, string> }, bruto = false, aceita: string = ACEITA_JSON, extras?: Record<string, string>): Promise<T> {
    const rota = url.replace(this.cfg.baseUrl, '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    // Para o log: caminho com os parâmetros (datas, filtros), sem o endereço do servidor.
    const alvo = `${envio?.method ?? 'GET'} ${url.replace(/^https?:\/\/[^/]+/, '')}`;
    for (let tentativa = 1; ; tentativa++) {
      const inicio = Date.now();
      let resposta: Response;
      try {
        resposta = await this.http(url, {
          method: envio?.method ?? 'GET',
          headers: {
            Authorization: `Bearer ${await this.cfg.obterToken(orgId)}`,
            Accept: aceita,
            ...extras,
            ...(envio ? { 'Content-Type': ACEITA_JSON, ...envio.cabecalhos } : {}),
          },
          ...(envio ? { body: JSON.stringify(envio.corpo) } : {}),
        });
      } catch (erro) {
        this.cfg.registrar?.(`${alvo} -> SEM RESPOSTA em ${Date.now() - inicio} ms (${erro instanceof Error ? erro.name : 'erro'})`);
        throw erro;
      }
      const ms = Date.now() - inicio;
      if (resposta.ok) {
        if (bruto) {
          this.cfg.registrar?.(`${alvo} -> ${resposta.status} em ${ms} ms`);
          return resposta as unknown as T;
        }
        const corpo = (await resposta.json()) as T;
        if (this.cfg.registrar) {
          const valores = (corpo as { values?: unknown } | null)?.values;
          const itens = Array.isArray(valores) ? valores : valores ? [valores] : [];
          const primeiro = itens[0];
          this.cfg.registrar(`${alvo} -> ${resposta.status} em ${ms} ms, ${itens.length} item(ns)${primeiro && typeof primeiro === 'object' ? `, campos: ${Object.keys(primeiro).join(',')}` : ''}`);
        }
        return corpo;
      }
      this.cfg.registrar?.(`${alvo} -> ${resposta.status} em ${ms} ms${tentativa > 1 ? ` (tentativa ${tentativa})` : ''}`);

      const repetivel = resposta.status === 429 || resposta.status === 503;
      if (repetivel && tentativa < TENTATIVAS) {
        const segundos = Number(resposta.headers.get('Retry-After'));
        await this.esperar((Number.isFinite(segundos) && segundos > 0 ? Math.min(segundos, 8) : tentativa * 2) * 1000);
        continue;
      }
      if (resposta.status === 429 || resposta.status === 503) throw new DeereErro('DEERE_LIMITE', 'A John Deere está limitando as consultas. Tente de novo em instantes.', resposta.status, rota);
      if (resposta.status === 403 && resposta.headers.get('X-Deere-Terms-Location')) {
        throw new DeereErro('DEERE_TERMOS', 'O dono da organização precisa aceitar os novos termos da John Deere.', 403, rota);
      }
      if (resposta.status === 401 || resposta.status === 403) {
        const detalhe = (await resposta.text().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 400) || undefined;
        throw new DeereErro('DEERE_SEM_ACESSO', 'A John Deere negou o acesso. Confira a conexão em Config.', resposta.status, rota, detalhe);
      }
      if (resposta.status === 404) throw new DeereErro('DEERE_NAO_ENCONTRADO', 'A John Deere não encontrou esse dado.', 404, rota);
      throw new DeereErro('DEERE_ERRO', `A John Deere respondeu ${resposta.status}.`, resposta.status, rota);
    }
  }
}
