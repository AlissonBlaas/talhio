import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { BadGatewayException, BadRequestException, ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConexaoDeere, InicioDaConexao, OrganizacaoDeere } from '@talhio/shared';
import { CONFIG, type Config, type DeereAcesso } from '../../core/config.js';
import { ConexaoDeereRepository, type ConexaoGuardada } from './conexao-deere.repository.js';
import { cifrar, decifrar } from '../../shared/cripto.js';
import { DEERE_HTTP, type Http } from './deere.http.js';

const VALIDADE_DO_ESTADO_MS = 10 * 60 * 1000;
/** Renova um pouco antes de vencer, para a chamada não falhar no meio do caminho. */
const MARGEM_DO_TOKEN_MS = 60 * 1000;
const ACEITA = 'application/vnd.deere.axiom.v3+json';

type Endpoints = { authorization_endpoint: string; token_endpoint: string };
type RespostaDeToken = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
type OrgDaDeere = { id: string; name?: string; links?: { rel: string; uri: string }[] };

/**
 * O que pedimos para a John Deere avisar: export pronto (horas, área e combustível), operação de campo nova ou mudada,
 * e mudanças em talhões, contornos e linhas (para o mapa não ficar com desenho velho).
 */
export const EVENTOS_DO_AVISO = ['operationsExport', 'fieldOperation', 'field', 'boundary', 'guidanceLine'] as const;

type Assinatura = { id?: string; eventTypeId?: string; status?: string; targetEndpoint?: { uri?: string }; filters?: { key?: string; values?: string[] }[]; links?: { rel?: string; uri?: string }[] };

/** A lista de assinaturas vem como `{ values: [...] }` ou direto como lista. */
const assinaturasDe = (corpo: unknown): Assinatura[] => (Array.isArray(corpo) ? (corpo as Assinatura[]) : ((corpo as { values?: Assinatura[] } | null)?.values ?? []));
const idDaAssinatura = (a: Assinatura): string | null => a.id ?? a.links?.find((l) => l.rel === 'self')?.uri?.split('/').filter(Boolean).pop() ?? null;
/** Mesma assinatura que criaríamos: export, nosso endereço, ativa e cobrindo todas as organizações em uso. */
function ehONossoAviso(a: Assinatura, uri: string, orgs: string[]): boolean {
  const dasOrgs = a.filters?.find((f) => f.key === 'orgId')?.values ?? [];
  return a.eventTypeId === 'operationsExport' && a.targetEndpoint?.uri === uri && (a.status ?? 'Active').toLowerCase() === 'active' && orgs.every((o) => dasOrgs.includes(o));
}

const ruim = (mensagem: string) => new BadGatewayException({ codigo: 'DEERE_INDISPONIVEL', mensagem });

/** Ids em uso: a principal e as extras. */
const idsDe = (c: ConexaoGuardada): string[] => [c.deereOrgId, ...c.deereOrgExtras.split(',')].filter((x): x is string => !!x);

@Injectable()
export class ConexaoDeereService {
  private readonly log = new Logger('ConexaoDeere');
  private endpoints: Endpoints | null = null;
  /** Uma renovação por vez por fazenda: o refresh token da Deere pode ser de uso único. */
  private readonly renovando = new Map<string, Promise<string>>();

  constructor(
    @Inject(ConexaoDeereRepository) private readonly repo: ConexaoDeereRepository,
    @Inject(CONFIG) private readonly config: Config,
    @Inject(DEERE_HTTP) private readonly http: Http,
  ) {}

  private get deere(): DeereAcesso {
    if (!this.config.deere) throw new BadRequestException({ codigo: 'DEERE_DESLIGADA', mensagem: 'A ligação com a John Deere não está ativa neste servidor.' });
    return this.config.deere;
  }

  async estado(orgId: string): Promise<ConexaoDeere> {
    if (this.config.deereProvedor === 'fake') return { modo: 'demonstracao', estado: 'pronto', organizacaoNome: null, organizacaoIds: [], conectadoEm: null };
    const c = await this.repo.buscar(orgId);
    if (!c) return { modo: 'deere', estado: 'desconectado', organizacaoNome: null, organizacaoIds: [], conectadoEm: null };
    const estado = !c.deereOrgId ? 'escolher-organizacao' : c.precisaLiberar ? 'liberar-acesso' : 'pronto';
    return { modo: 'deere', estado, organizacaoNome: c.deereOrgNome, organizacaoIds: idsDe(c), conectadoEm: c.conectadoEm.toISOString() };
  }

  /** Endereço de login da Deere. O `state` assinado liga a volta do navegador a esta fazenda. */
  async iniciar(orgId: string, agora = Date.now()): Promise<InicioDaConexao> {
    const d = this.deere;
    const { authorization_endpoint } = await this.descobrir();
    const url = new URL(authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: d.clientId,
      redirect_uri: d.redirectUri,
      scope: d.escopos,
      state: this.assinarEstado(orgId, agora),
    }).toString();
    return { url: url.toString() };
  }

  /**
   * Volta do navegador (rota aberta): NÃO conclui nada. Só devolve o código e o `state` ao app, que conclui logado
   * (`concluir`). Se a troca fosse feita aqui, bastaria o `state`: alguém poderia gerar o link da própria fazenda,
   * mandá-lo a outra pessoa e, quando ela autorizasse na John Deere, a conta DELA ficaria ligada à fazenda de quem
   * mandou o link.
   */
  voltaDoNavegador(entrada: { code?: string; state?: string; error?: string }): string {
    const para = (campos: Record<string, string>) => `${this.deere.appRetorno}?${new URLSearchParams(campos)}`;
    if (entrada.error) return para({ erro: entrada.error === 'access_denied' ? 'negado' : 'falhou' });
    if (!entrada.code || !entrada.state || entrada.code.length > 4000 || entrada.state.length > 1000) return para({ erro: 'sessao-invalida' });
    return para({ codigo: entrada.code, estado: entrada.state });
  }

  /**
   * Conclui a conexão: confere que o `state` é válido E que foi gerado por esta mesma fazenda (a da sessão de quem
   * chama), troca o código por tokens e guarda cifrados.
   */
  async concluir(orgId: string, entrada: { codigo: string; estado: string }, agora = Date.now()): Promise<ConexaoDeere> {
    const d = this.deere;
    const donoDoEstado = this.lerEstado(entrada.estado, agora);
    if (!donoDoEstado) throw new BadRequestException({ codigo: 'DEERE_SESSAO_INVALIDA', mensagem: 'O tempo para entrar na John Deere acabou. Tente de novo.' });
    if (donoDoEstado !== orgId) {
      // Pedido de conexão gerado por outra fazenda: nada é guardado, nem para uma nem para outra.
      this.log.warn(`Conexão recusada: o pedido foi gerado pela fazenda ${donoDoEstado} e concluído pela ${orgId}`);
      throw new ForbiddenException({ codigo: 'DEERE_PEDIDO_DE_OUTRA_FAZENDA', mensagem: 'Esse pedido de conexão não foi feito por esta fazenda. Comece de novo em Config.' });
    }
    let tokens: RespostaDeToken;
    try {
      tokens = await this.pedirToken({ grant_type: 'authorization_code', code: entrada.codigo, redirect_uri: d.redirectUri });
    } catch {
      throw new BadGatewayException({ codigo: 'DEERE_NAO_CONFIRMOU', mensagem: 'A John Deere não confirmou o acesso. Tente de novo em instantes.' });
    }
    await this.repo.guardarTokens(orgId, this.paraGuardar(tokens, null, agora));
    return this.estado(orgId);
  }

  async organizacoes(orgId: string): Promise<OrganizacaoDeere[]> {
    const resposta = await this.chamar<OrgDaDeere[] | { values?: OrgDaDeere[] }>(orgId, '/organizations');
    const lista = Array.isArray(resposta) ? resposta : (resposta.values ?? []);
    return lista.map((o) => {
      // A Deere pede que o endereço de volta (redirect_uri) vá junto no link de liberação.
      const bruto = o.links?.find((l) => l.rel === 'connections')?.uri ?? null;
      const liberar = bruto ? `${bruto}${bruto.includes('?') ? '&' : '?'}redirect_uri=${encodeURIComponent(this.deere.appRetorno)}` : null;
      return { id: String(o.id), nome: o.name ?? `Organização ${o.id}`, precisaLiberar: liberar !== null, urlLiberar: liberar };
    });
  }

  /** Escolhe uma ou mais organizações. A primeira é a principal (onde o Talhio escreve); as outras só são lidas. */
  async escolher(orgId: string, ids: string[]): Promise<ConexaoDeere> {
    const todas = await this.organizacoes(orgId);
    const unicos = [...new Set(ids)];
    const escolhidas = unicos.map((id) => todas.find((o) => o.id === id));
    if (escolhidas.some((o) => !o)) throw new BadRequestException({ codigo: 'ORGANIZACAO_INVALIDA', mensagem: 'Essa organização não está na sua conta John Deere.' });
    const lista = escolhidas as OrganizacaoDeere[];
    const [principal, ...outras] = lista;
    await this.repo.escolherOrganizacao(orgId, principal!.id, lista.map((o) => o.nome).join(' + '), outras.map((o) => o.id), lista.some((o) => o.precisaLiberar));
    return this.estado(orgId);
  }

  /** Depois de liberar o acesso no site da Deere: confere de novo e, se estiver liberado, libera o app. */
  async conferirLiberacao(orgId: string): Promise<ConexaoDeere> {
    const c = await this.repo.buscar(orgId);
    if (c?.deereOrgId && c.precisaLiberar) {
      const todas = await this.organizacoes(orgId);
      const escolhidas = idsDe(c).map((id) => todas.find((o) => o.id === id));
      if (escolhidas.every((o) => o && !o.precisaLiberar)) await this.repo.marcarLiberada(orgId);
    }
    return this.estado(orgId);
  }

  /** Id da organização do Operations Center escolhida pela fazenda. */
  async organizacaoDaDeere(orgId: string): Promise<string> {
    const c = await this.repo.buscar(orgId);
    if (!c) throw new BadRequestException({ codigo: 'DEERE_NAO_CONECTADA', mensagem: 'Conecte a conta John Deere da fazenda primeiro.' });
    if (!c.deereOrgId) throw new BadRequestException({ codigo: 'DEERE_SEM_ORGANIZACAO', mensagem: 'Escolha a organização da fazenda na John Deere (Config).' });
    if (c.precisaLiberar) throw new BadRequestException({ codigo: 'DEERE_ACESSO_NAO_LIBERADO', mensagem: 'Falta liberar o Talhio na organização, no site da John Deere (Config).' });
    return c.deereOrgId;
  }

  /** Todas as organizações em uso (a principal primeiro). */
  async organizacoesDaDeere(orgId: string): Promise<string[]> {
    const principal = await this.organizacaoDaDeere(orgId);
    const c = await this.repo.buscar(orgId);
    return [principal, ...(c ? idsDe(c).slice(1) : [])];
  }

  async desconectar(orgId: string): Promise<void> {
    await this.repo.apagar(orgId);
  }

  /** Token de acesso válido para a fazenda; renova sozinho quando está perto de vencer. */
  async obterToken(orgId: string, agora = Date.now()): Promise<string> {
    const d = this.deere;
    const c = await this.repo.buscar(orgId);
    if (!c) throw new BadRequestException({ codigo: 'DEERE_NAO_CONECTADA', mensagem: 'Conecte a conta John Deere da fazenda primeiro.' });
    if (c.expiraEm.getTime() - agora > MARGEM_DO_TOKEN_MS) return decifrar(c.acessoCifrado, d.criptoChave);

    const andamento = this.renovando.get(orgId);
    if (andamento) return andamento;
    const nova = this.renovar(orgId, c, agora).finally(() => this.renovando.delete(orgId));
    this.renovando.set(orgId, nova);
    return nova;
  }

  private async renovar(orgId: string, c: ConexaoGuardada, agora: number): Promise<string> {
    const d = this.deere;
    try {
      const tokens = await this.pedirToken({ grant_type: 'refresh_token', refresh_token: decifrar(c.renovacaoCifrada, d.criptoChave), redirect_uri: d.redirectUri, scope: d.escopos });
      await this.repo.guardarTokens(orgId, this.paraGuardar(tokens, c, agora));
      return tokens.access_token;
    } catch {
      throw new BadGatewayException({ codigo: 'DEERE_SESSAO_VENCIDA', mensagem: 'A conexão com a John Deere venceu. Conecte de novo em Config.' });
    }
  }

  /**
   * Para o administrador entender por que não aparece nada: consulta cada parte na Deere e diz o status e quantos
   * itens vieram. Nunca devolve token nem dados da fazenda, só contagens.
   */
  async diagnosticar(orgId: string): Promise<{ passo: string; status: number | string; total: number | null; nota?: string }[]> {
    const c = await this.repo.buscar(orgId);
    const saida: { passo: string; status: number | string; total: number | null; nota?: string }[] = [];
    if (!c) return [{ passo: 'conexão', status: 'desconectado', total: null, nota: 'Conecte a conta John Deere.' }];
    const token = await this.obterToken(orgId);
    const consultar = async (passo: string, url: string, aceita = ACEITA, descrever = false) => {
      try {
        const r = await this.http(url, { headers: { Authorization: `Bearer ${token}`, Accept: aceita } });
        let total: number | null = null;
        let nota: string | undefined;
        if (r.ok) {
          const j = (await r.json()) as { total?: number; values?: unknown } | unknown[];
          if (descrever && !Array.isArray(j)) {
            const primeiro = (Array.isArray(j.values) ? j.values[0] : j.values) as Record<string, any> | undefined;
            if (primeiro) nota = `tipo: ${primeiro.type?.name ?? '?'} · isg: ${primeiro.isgType?.name ?? '?'} · marca: ${primeiro.make?.name ?? '?'} · modelo: ${primeiro.model?.name ?? '?'} · telemetria: ${String(primeiro.telematicsCapable)} · papel: ${primeiro.organizationRole?.type ?? '?'} · arquivado: ${String(primeiro.archived)}`;
          }
          total = Array.isArray(j) ? j.length : typeof j.total === 'number' ? j.total : Array.isArray(j.values) ? j.values.length : j.values ? 1 : 0;
        } else if (r.status === 403) nota = 'Acesso negado: confira escopos e se a organização foi liberada para o Talhio.';
        else if (r.status === 404) nota = 'A Deere não reconhece esse caminho para essa organização.';
        saida.push({ passo, status: r.status, total, ...(nota ? { nota } : {}) });
      } catch {
        saida.push({ passo, status: 'sem resposta', total: null });
      }
    };
    saida.push({ passo: 'organizações escolhidas', status: c.deereOrgId ? 'ok' : 'nenhuma', total: idsDe(c).length, nota: c.deereOrgId ? `${c.deereOrgNome ?? ''} (${idsDe(c).join(', ')})${c.precisaLiberar ? ': falta liberar o acesso' : ''}` : undefined });
    await consultar('organizações', `${this.deere.baseUrl}/organizations`);
    const varias = idsDe(c).length > 1;
    for (const org of idsDe(c)) {
      const em = varias ? ` [${org}]` : '';
      await consultar(`talhões${em}`, `${this.deere.baseUrl}/organizations/${org}/fields?itemLimit=10`);
      // Talhão só aparece no mapa se tiver contorno ativo: confere os primeiros e mostra o que a Deere devolve.
      try {
        const cab = { headers: { Authorization: `Bearer ${token}`, Accept: ACEITA } };
        const r = await this.http(`${this.deere.baseUrl}/organizations/${org}/fields?itemLimit=5`, cab);
        const campos = r.ok ? (((await r.json()) as { values?: Record<string, unknown>[] }).values ?? []) : [];
        let comContorno = 0;
        const notas: string[] = [];
        for (const campo of campos) {
          const b = await this.http(`${this.deere.baseUrl}/organizations/${org}/fields/${String(campo.id)}/boundaries`, cab);
          const corpo = b.ok ? ((await b.json()) as { values?: Record<string, unknown>[] }) : null;
          const lista = corpo?.values ?? [];
          if (lista.some((x) => x.active !== false)) comContorno++;
          if (notas.length < 2) {
            const primeiro = lista[0];
            notas.push(`"${String(campo.name ?? campo.id)}": HTTP ${b.status}, ${lista.length} contorno(s)${primeiro ? `, campos: ${Object.keys(primeiro).join(',')}` : ''}; talhão tem: ${Object.keys(campo).join(',')}; links: ${(Array.isArray(campo.links) ? (campo.links as { rel?: string }[]).map((l) => l.rel).join(',') : '-')}`);
          }
        }
        const emb = await this.http(`${this.deere.baseUrl}/organizations/${org}/fields?embed=boundaries&itemLimit=5`, cab);
        const embCampos = emb.ok ? (((await emb.json()) as { values?: { boundaries?: unknown[] }[] }).values ?? []) : [];
        const embComContorno = embCampos.filter((c) => Array.isArray(c.boundaries) && c.boundaries.length > 0).length;
        notas.push(`com embed=boundaries: HTTP ${emb.status}, ${embComContorno} de ${embCampos.length} trazem contorno`);
        const orgB = await this.http(`${this.deere.baseUrl}/organizations/${org}/boundaries?itemLimit=5`, cab);
        type ContornoBruto = { name?: string; active?: boolean; archived?: boolean; multipolygons?: { rings?: { points?: unknown[] }[] }[]; links?: { rel?: string; uri?: string }[] };
        const orgBLista = orgB.ok ? (((await orgB.json()) as { values?: ContornoBruto[] }).values ?? []) : [];
        notas.push(`contornos da organização: HTTP ${orgB.status}, ${orgBLista.length}`);
        // Cada contorno: tem pontos? de qual talhão é? esse talhão está na lista de talhões (não arquivado)?
        const todosCampos = await this.http(`${this.deere.baseUrl}/organizations/${org}/fields?itemLimit=100`, cab);
        const idsDosCampos = new Map((todosCampos.ok ? (((await todosCampos.json()) as { values?: { id?: unknown; name?: string; archived?: boolean }[] }).values ?? []) : []).map((c) => [String(c.id).toLowerCase(), c]));
        for (const b of orgBLista) {
          const pontos = (b.multipolygons ?? []).reduce((n, p) => n + (p.rings ?? []).reduce((m, r) => m + (r.points?.length ?? 0), 0), 0);
          const campoId = b.links?.find((l) => l.rel === 'field')?.uri?.trim().split('/').pop()?.split('?')[0]?.toLowerCase();
          const campo = campoId ? idsDosCampos.get(campoId) : undefined;
          notas.push(`contorno "${b.name ?? '?'}": ${pontos} pontos, ativo ${String(b.active)}, arquivado ${String(b.archived)}, talhão ${campo ? `"${campo.name ?? '?'}"${campo.archived ? ' (arquivado)' : ''}` : campoId ? 'fora da lista de talhões' : 'sem link de talhão'}`);
        }
        const orgT = await this.http(`${this.deere.baseUrl}/organizations/${org}/boundaries?recordFilter=all&itemLimit=5`, cab);
        const orgTLista = orgT.ok ? (((await orgT.json()) as { values?: unknown[] }).values ?? []) : [];
        notas.push(`contando arquivados e inativos: HTTP ${orgT.status}, ${orgTLista.length}`);
        saida.push({ passo: `contornos (dos 5 primeiros talhões)${em}`, status: r.status, total: comContorno, nota: campos.length ? `${comContorno} de ${campos.length} têm contorno. ${notas.join(' | ')}` : undefined });
      } catch {
        saida.push({ passo: `contornos (dos 5 primeiros talhões)${em}`, status: 'sem resposta', total: null });
      }
      await consultar(`máquinas${em}`, `${this.deere.equipamentosUrl}/equipment?organizationIds=${org}&categories=Machine&archived=false&itemLimit=10`, 'application/json');
      await consultar(`implementos${em}`, `${this.deere.equipamentosUrl}/equipment?organizationIds=${org}&categories=Implement&archived=false&itemLimit=10`, 'application/json');
      await consultar(`todos os equipamentos (sem filtro)${em}`, `${this.deere.equipamentosUrl}/equipment?organizationIds=${org}&itemLimit=10`, 'application/json', true);
      saida.push(...(await this.diagnosticarMaquinas(org, token, em)));
    }
    saida.push(await this.conferirAviso(orgId, token));
    // Quais avisos a John Deere oferece para este aplicativo (a lista dela, não a nossa suposição).
    try {
      const r = await this.http(`${this.deere.baseUrl}/eventTypes?itemLimit=100`, { headers: { Authorization: `Bearer ${token}`, Accept: ACEITA } });
      const corpo = r.ok ? ((await r.json()) as { values?: { id?: string; name?: string; eventTypeId?: string }[] } | { id?: string; name?: string; eventTypeId?: string }[]) : null;
      const tipos = (Array.isArray(corpo) ? corpo : (corpo?.values ?? [])).map((t) => t.id ?? t.eventTypeId ?? t.name ?? '?');
      saida.push({ passo: 'tipos de aviso que a Deere oferece', status: r.status, total: r.ok ? tipos.length : null, nota: r.ok ? tipos.join(', ') || 'lista vazia' : (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200) });
    } catch {
      saida.push({ passo: 'tipos de aviso que a Deere oferece', status: 'sem resposta', total: null });
    }
    return saida;
  }

  /**
   * Dado ao vivo de cada máquina, uma linha por máquina: o que a Deere respondeu em cada leitura e de quando é o
   * último dado. Sem coordenadas nem número de série; só status, idade do dado e se o valor veio.
   */
  private async diagnosticarMaquinas(org: string, token: string, em: string): Promise<{ passo: string; status: number | string; total: number | null; nota?: string }[]> {
    const cab = { headers: { Authorization: `Bearer ${token}`, Accept: ACEITA } };
    try {
      const r = await this.http(`${this.deere.equipamentosUrl}/equipment?organizationIds=${org}&categories=Machine&archived=false&itemLimit=10`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      if (!r.ok) return [];
      const corpo = (await r.json()) as { values?: unknown };
      const maquinas = (Array.isArray(corpo.values) ? corpo.values : corpo.values ? [corpo.values] : []) as { name?: string; principalId?: number | string; id?: number | string; telematicsCapable?: boolean }[];
      const agora = Date.now();
      const idade = (t?: string) => {
        const ms = t ? agora - Date.parse(t) : NaN;
        if (!Number.isFinite(ms)) return 'sem data';
        const min = Math.round(ms / 60_000);
        return min < 60 ? `há ${min} min` : min < 2880 ? `há ${Math.round(min / 60)} h` : `há ${Math.round(min / 1440)} dias`;
      };
      const ler = async (caminho: string) => {
        try {
          const x = await this.http(`${this.deere.baseUrl}${caminho}`, cab);
          const j = x.ok ? ((await x.json()) as { values?: Record<string, any>[] }) : null;
          return { status: x.status as number | string, lista: j?.values ?? [] };
        } catch {
          return { status: 'sem resposta' as number | string, lista: [] as Record<string, any>[] };
        }
      };
      const inicioDoDia = new Date(agora - 24 * 3_600_000).toISOString();
      return await Promise.all(
        maquinas.map(async (m) => {
          const id = encodeURIComponent(String(m.principalId ?? m.id));
          const [rastro, periodica, horas, aparelho, ligado] = await Promise.all([
            ler(`/machines/${id}/breadcrumbs?lastKnown=true`),
            ler(`/machines/${id}/locationHistory?lastKnown=true`),
            ler(`/machines/${id}/engineHours?lastKnown=true`),
            ler(`/machines/${id}/deviceStateReports?lastKnown=true`),
            ler(`/machines/${id}/hoursOfOperation?startDate=${inicioDoDia}&endDate=${new Date(agora).toISOString()}`),
          ]);
          const p = rastro.lista.at(-1);
          const l = periodica.lista.at(-1);
          const h = horas.lista.at(-1);
          const a = aparelho.lista.at(-1);
          const partes = [
            `rastro (velocidade, tanque): HTTP ${rastro.status}${p ? `, ${idade(p.eventTimestamp ?? p.gpsFixTimestamp ?? p.createTimestamp)}, velocidade ${p.speed == null ? 'não veio' : 'veio'}, tanque ${p.fuelLevel == null ? 'não veio' : 'veio'}, campos: ${Object.keys(p).join(',')}` : ', vazio'}`,
            `posição periódica: HTTP ${periodica.status}${l ? `, ${idade(l.eventTimestamp ?? l.gpsFixTimestamp ?? l.createTimestamp)}` : ', vazio'}`,
            `horímetro: HTTP ${horas.status}${h ? `, ${idade(h.reportTime ?? h.eventTimestamp)}, campos: ${Object.keys(h).join(',')}` : ', vazio'}`,
            `aparelho (motor, sinal): HTTP ${aparelho.status}${a ? `, ${idade(a.time ?? a.eventTimestamp)}, campos: ${Object.keys(a).join(',')}` : ', vazio'}`,
            `motor ligado nas últimas 24 h: HTTP ${ligado.status}, ${ligado.lista.length} trecho(s)`,
          ];
          return { passo: `máquina "${m.name ?? id}"${em}`, status: m.telematicsCapable === false ? 'sem telemetria' : rastro.status, total: rastro.lista.length + periodica.lista.length, nota: partes.join(' | ') };
        }),
      );
    } catch {
      return [{ passo: `dados das máquinas${em}`, status: 'sem resposta', total: null }];
    }
  }

  /**
   * Liga o aviso da John Deere para exports prontos (assinatura `operationsExport` apontando para `POST /deere/webhook`).
   * Só cria se ainda não existe uma igual: confere a lista antes, e se não consegue conferir, não cria (para não duplicar).
   * É uma configuração que fica na conta da Deere: só roda quando o administrador pede.
   */
  async ativarAviso(orgId: string): Promise<{ ativo: true; novo: boolean; id: string | null; status: string | null; avisos: { evento: string; situacao: 'criado' | 'ja-ligado' | 'reativado' | 'recusado'; detalhe: string | null }[] }> {
    const uri = this.enderecoDoAviso();
    if (!uri) throw new BadRequestException({ codigo: 'AVISO_SEM_ENDERECO', mensagem: 'O servidor precisa de um endereço público em https para receber o aviso da John Deere.' });
    const orgs = await this.organizacoesDaDeere(orgId);
    const cabecalhos = { Authorization: `Bearer ${await this.obterToken(orgId)}`, Accept: ACEITA };
    const endereco = `${this.deere.baseUrl}/eventSubscriptions`;
    const textoDe = async (r: Response) => (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);

    const lista = await this.http(`${endereco}?itemLimit=100`, { headers: cabecalhos });
    if (!lista.ok) {
      const motivo = lista.status === 403 || lista.status === 401 ? ' O aplicativo precisa da API "Operations Center - Webhook" aprovada no portal de desenvolvedor.' : '';
      const texto = await textoDe(lista);
      throw new BadGatewayException({ codigo: 'AVISO_NAO_ATIVADO', mensagem: `A John Deere não aceitou listar os avisos (resposta ${lista.status}).${motivo}${texto ? ` Ela disse: ${texto}` : ''}` });
    }
    const existentes = assinaturasDe(await lista.json());

    const avisos: { evento: string; situacao: 'criado' | 'ja-ligado' | 'reativado' | 'recusado'; detalhe: string | null }[] = [];
    let principal: { id: string | null; status: string | null; novo: boolean } | null = null;
    for (const evento of EVENTOS_DO_AVISO) {
      // O filtro por aplicativo (`clientId`) só existe no aviso de export; nos outros a Deere já entrega só o que é do aplicativo.
      const filtros = [{ key: 'orgId', values: orgs }, ...(evento === 'operationsExport' ? [{ key: 'clientId', values: [this.deere.clientId] }] : [])];
      const corpo = { eventTypeId: evento, targetEndpoint: { targetType: 'https', uri }, filters: filtros, status: 'Active', displayName: `Talhio ${evento}` };
      const mesma = existentes.find((a) => a.eventTypeId === evento && a.targetEndpoint?.uri === uri && (a.status ?? '').toLowerCase() !== 'terminated' && orgs.every((o) => (a.filters?.find((f) => f.key === 'orgId')?.values ?? []).includes(o)));
      let resultado: { situacao: 'criado' | 'ja-ligado' | 'reativado' | 'recusado'; detalhe: string | null; id: string | null; status: string | null };
      if (mesma && (mesma.status ?? 'Active').toLowerCase() === 'active') {
        resultado = { situacao: 'ja-ligado', detalhe: null, id: idDaAssinatura(mesma), status: mesma.status ?? null };
      } else if (mesma && idDaAssinatura(mesma)) {
        // Venceu (a Deere suspende o aviso quando não consegue entregar): liga de novo, sem criar outro.
        const r = await this.http(`${endereco}/${idDaAssinatura(mesma)}`, { method: 'PUT', headers: { ...cabecalhos, 'Content-Type': ACEITA }, body: JSON.stringify(corpo) });
        resultado = r.ok ? { situacao: 'reativado', detalhe: null, id: idDaAssinatura(mesma), status: 'Active' } : { situacao: 'recusado', detalhe: `resposta ${r.status}. ${await textoDe(r)}`, id: idDaAssinatura(mesma), status: mesma.status ?? null };
      } else {
        const r = await this.http(endereco, { method: 'POST', headers: { ...cabecalhos, 'Content-Type': ACEITA }, body: JSON.stringify(corpo) });
        if (r.ok) {
          const devolvida = (await r.json().catch(() => ({}))) as Assinatura;
          resultado = { situacao: 'criado', detalhe: null, id: idDaAssinatura(devolvida) ?? r.headers.get('Location')?.split('/').filter(Boolean).pop() ?? null, status: devolvida.status ?? null };
        } else {
          resultado = { situacao: 'recusado', detalhe: `resposta ${r.status}. ${await textoDe(r)}`, id: null, status: null };
        }
      }
      avisos.push({ evento, situacao: resultado.situacao, detalhe: resultado.detalhe });
      if (evento === 'operationsExport') principal = { id: resultado.id, status: resultado.status, novo: resultado.situacao === 'criado' };
    }
    if (avisos.every((a) => a.situacao === 'recusado')) {
      throw new BadGatewayException({ codigo: 'AVISO_NAO_ATIVADO', mensagem: `A John Deere recusou todos os avisos. ${avisos.map((a) => `${a.evento}: ${a.detalhe ?? ''}`).join(' | ')}` });
    }
    return { ativo: true, novo: principal?.novo ?? false, id: principal?.id ?? null, status: principal?.status ?? null, avisos };
  }

  /** Onde a Deere deve avisar: o mesmo endereço público da volta do login, trocando `/callback` por `/webhook`. Nulo se não for https. */
  private enderecoDoAviso(): string | null {
    const uri = this.deere.redirectUri.replace(/\/callback\/?$/, '/webhook');
    return uri.startsWith('https://') && uri.endsWith('/webhook') ? uri : null;
  }

  /** Situação do aviso na John Deere, para o diagnóstico: quantas assinaturas existem e se a nossa está ativa. */
  private async conferirAviso(orgId: string, token: string): Promise<{ passo: string; status: number | string; total: number | null; nota?: string }> {
    const passo = 'aviso de export (webhook)';
    const uri = this.enderecoDoAviso();
    if (!uri) return { passo, status: 'sem endereço https', total: null };
    try {
      const r = await this.http(`${this.deere.baseUrl}/eventSubscriptions?itemLimit=100`, { headers: { Authorization: `Bearer ${token}`, Accept: ACEITA } });
      if (!r.ok) return { passo, status: r.status, total: null, nota: `A John Deere não deixou listar as assinaturas. Ela disse: ${(await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300) || '(sem texto)'}` };
      const todas = assinaturasDe(await r.json());
      const nossas = todas.filter((a) => a.targetEndpoint?.uri === uri);
      return {
        passo,
        status: r.status,
        total: nossas.filter((a) => (a.status ?? '').toLowerCase() === 'active').length,
        nota: nossas.length
          ? `para ${uri}: ${nossas.map((a) => `${a.eventTypeId ?? '?'} ${a.status ?? '?'}`).join(', ')}. Faltam: ${EVENTOS_DO_AVISO.filter((e) => !nossas.some((a) => a.eventTypeId === e && (a.status ?? '').toLowerCase() === 'active')).join(', ') || 'nenhum'}`
          : `nenhum aviso ligado para ${uri}. Assinaturas na conta: ${todas.length}`,
      };
    } catch {
      return { passo, status: 'sem resposta', total: null };
    }
  }

  /** GET na API da Deere com o token da fazenda. */
  async chamar<T>(orgId: string, caminho: string): Promise<T> {
    const resposta = await this.http(`${this.deere.baseUrl}${caminho}`, { headers: { Authorization: `Bearer ${await this.obterToken(orgId)}`, Accept: ACEITA } });
    if (resposta.status === 403 && resposta.headers.get('X-Deere-Terms-Location')) {
      throw new BadGatewayException({ codigo: 'DEERE_TERMOS', mensagem: 'O dono da organização precisa aceitar os novos termos da John Deere.' });
    }
    if (!resposta.ok) throw ruim(`A John Deere respondeu ${resposta.status}. Tente de novo em instantes.`);
    return (await resposta.json()) as T;
  }

  private paraGuardar(t: RespostaDeToken, anterior: ConexaoGuardada | null, agora: number) {
    const chave = this.deere.criptoChave;
    return {
      acessoCifrado: cifrar(t.access_token, chave),
      // A Deere pode não mandar refresh token novo: nesse caso vale o que já tínhamos.
      renovacaoCifrada: t.refresh_token ? cifrar(t.refresh_token, chave) : (anterior?.renovacaoCifrada ?? cifrar('', chave)),
      expiraEm: new Date(agora + t.expires_in * 1000),
      escopos: t.scope ?? this.deere.escopos,
    };
  }

  private async pedirToken(campos: Record<string, string>): Promise<RespostaDeToken> {
    const d = this.deere;
    const { token_endpoint } = await this.descobrir();
    const resposta = await this.http(token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      // A documentação da Deere manda as credenciais no corpo do formulário.
      body: new URLSearchParams({ ...campos, client_id: d.clientId, client_secret: d.clientSecret }).toString(),
    });
    if (!resposta.ok) throw ruim('A John Deere recusou o login.');
    const corpo = (await resposta.json()) as Partial<RespostaDeToken>;
    if (!corpo.access_token || typeof corpo.expires_in !== 'number') throw ruim('Resposta inesperada da John Deere.');
    return corpo as RespostaDeToken;
  }

  private async descobrir(): Promise<Endpoints> {
    if (this.endpoints) return this.endpoints;
    const resposta = await this.http(this.deere.wellKnown, { headers: { Accept: 'application/json' } });
    if (!resposta.ok) throw ruim('Não consegui falar com o login da John Deere.');
    const e = (await resposta.json()) as Partial<Endpoints>;
    if (!e.authorization_endpoint || !e.token_endpoint) throw ruim('O login da John Deere respondeu algo inesperado.');
    this.endpoints = { authorization_endpoint: e.authorization_endpoint, token_endpoint: e.token_endpoint };
    return this.endpoints;
  }

  // O state vai e volta pelo navegador: assinado, com validade e um sorteio, para ninguém forjar ou reaproveitar.
  private assinarEstado(orgId: string, agora: number): string {
    const corpo = Buffer.from(JSON.stringify({ o: orgId, e: agora + VALIDADE_DO_ESTADO_MS, n: randomBytes(8).toString('hex') })).toString('base64url');
    return `${corpo}.${this.assinatura(corpo)}`;
  }

  private lerEstado(estado: string, agora: number): string | null {
    const [corpo, assinatura] = estado.split('.');
    if (!corpo || !assinatura) return null;
    const esperada = Buffer.from(this.assinatura(corpo));
    const recebida = Buffer.from(assinatura);
    if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
    try {
      const { o, e } = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as { o?: string; e?: number };
      return typeof o === 'string' && typeof e === 'number' && e > agora ? o : null;
    } catch {
      return null;
    }
  }

  private assinatura(corpo: string): string {
    return createHmac('sha256', this.deere.criptoChave).update(corpo).digest('base64url');
  }
}
