import { SessaoSchema } from '@talhio/shared';
import { Platform } from 'react-native';

import { sessao } from './sessao';

const PADRAO = Platform.OS === 'android' ? 'http://10.0.2.2:3333/v1' : 'http://localhost:3333/v1';
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? PADRAO;

/** Endereço do canal ao vivo (WebSocket): o mesmo servidor da API, com ws:// ou wss://. */
export const URL_DO_CANAL = `${BASE_URL.replace(/^http/, 'ws')}/ao-vivo`;

// Fora do desenvolvimento, só HTTPS: token e dados da fazenda nunca trafegam em texto aberto.
if (!__DEV__ && !BASE_URL.startsWith('https://')) {
  throw new Error('EXPO_PUBLIC_API_URL precisa ser um endereço https:// no app publicado.');
}

/** Erro da API já traduzido: `codigo` estável para lógica, `mensagem` para a tela. */
export class ApiErro extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ApiErro';
  }
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'DELETE';

type Opcoes = {
  /** Rotas de login: não mandam token nem tentam renovar a sessão. */
  semLogin?: boolean;
};

async function chamar(metodo: Metodo, caminho: string, corpo: unknown, token: string | null): Promise<{ resposta: Response; dados: unknown }> {
  const headers: Record<string, string> = {};
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const resposta = await fetch(`${BASE_URL}${caminho}`, { method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
    return { resposta, dados: await resposta.json().catch(() => null) };
  } catch {
    throw new ApiErro(0, 'SEM_CONEXAO', 'Não foi possível falar com o servidor. Confira a internet.');
  }
}

let renovando: Promise<boolean> | null = null;

/**
 * Troca o token de renovação por uma sessão nova. Várias chamadas que falham ao mesmo tempo
 * esperam a MESMA renovação: o token de renovação é de uso único.
 */
function renovarSessao(): Promise<boolean> {
  renovando ??= (async () => {
    const tokenRenovacao = sessao.tokenRenovacao();
    if (!tokenRenovacao) return false;
    const { resposta, dados } = await chamar('POST', '/auth/renovar', { tokenRenovacao }, null);
    const nova = resposta.ok ? SessaoSchema.safeParse(dados) : null;
    if (!nova?.success) {
      // Sessão vencida ou revogada: volta para a tela de login.
      if (resposta.status === 401) await sessao.limpar();
      return false;
    }
    await sessao.definir(nova.data);
    return true;
  })().finally(() => {
    renovando = null;
  });
  return renovando;
}

async function requisitar(metodo: Metodo, caminho: string, corpo?: unknown, opcoes: Opcoes = {}): Promise<unknown> {
  let { resposta, dados } = await chamar(metodo, caminho, corpo, opcoes.semLogin ? null : sessao.tokenAcesso());

  // Token de acesso vencido: renova uma vez e repete a chamada.
  if (resposta.status === 401 && !opcoes.semLogin && (await renovarSessao())) {
    ({ resposta, dados } = await chamar(metodo, caminho, corpo, sessao.tokenAcesso()));
  }

  if (!resposta.ok) {
    const erro = (dados ?? {}) as { codigo?: string; mensagem?: string; message?: string };
    const codigo = erro.codigo ?? (resposta.status === 429 ? 'MUITAS_TENTATIVAS' : 'ERRO_DESCONHECIDO');
    const texto = erro.mensagem ?? (typeof erro.message === 'string' ? erro.message.replace(/^ThrottlerException:\s*/, '') : null);
    throw new ApiErro(resposta.status, codigo, texto ?? 'Algo deu errado. Tente de novo.');
  }
  return dados;
}

/** Baixa um arquivo (ex.: PDF) com o token da sessão. Devolve os bytes. */
async function baixarArquivo(caminho: string): Promise<Uint8Array> {
  const buscar = async (token: string | null) => {
    try {
      return await fetch(`${BASE_URL}${caminho}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch {
      throw new ApiErro(0, 'SEM_CONEXAO', 'Não foi possível falar com o servidor. Confira a internet.');
    }
  };
  let resposta = await buscar(sessao.tokenAcesso());
  if (resposta.status === 401 && (await renovarSessao())) resposta = await buscar(sessao.tokenAcesso());
  if (!resposta.ok) {
    const erro = (await resposta.json().catch(() => ({}))) as { codigo?: string; mensagem?: string };
    throw new ApiErro(resposta.status, erro.codigo ?? 'ERRO_DESCONHECIDO', erro.mensagem ?? 'Não foi possível gerar o arquivo. Tente de novo.');
  }
  return new Uint8Array(await resposta.arrayBuffer());
}

/** Único ponto de saída para o backend. As features usam isto dentro de `api/`. */
export const apiClient = {
  get: (caminho: string) => requisitar('GET', caminho),
  post: (caminho: string, corpo: unknown, opcoes?: Opcoes) => requisitar('POST', caminho, corpo, opcoes),
  put: (caminho: string, corpo: unknown) => requisitar('PUT', caminho, corpo),
  apagar: (caminho: string) => requisitar('DELETE', caminho),
  baixar: baixarArquivo,
};
