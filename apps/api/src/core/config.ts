import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * Pasta padrão com a exportação Gen4 da fazenda, para desenvolvimento. Fica fora do Git (dados
 * reais do cliente). O que é importado pelo app fica no banco, não nesta pasta.
 */
const PASTA_GEN4_PADRAO = '../../dados-fazenda/Gen4';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3333),
  DEERE_PROVEDOR: z.enum(['fake', 'deere']).default('fake'),
  ORG_ID: z.string().min(1).default('org-demo'),
  DEERE_PASTA_GEN4: z.string().min(1).optional(),
  NODE_ENV: z.string().optional(),
  /** Qualquer pessoa pode criar conta e fazenda pelo app. "0" fecha o cadastro (convite manual). */
  CADASTRO_ABERTO: z.enum(['0', '1']).default('1'),
  /**
   * Conta nova fica esperando a nossa aprovação antes de conseguir entrar. Sem valor: ligado em produção, desligado
   * no desenvolvimento (para criar conta e já usar).
   */
  CADASTRO_COM_APROVACAO: z.enum(['0', '1']).optional(),
  /** Chave de quem aprova os cadastros (cabeçalho `x-chave-de-aprovacao`). Sem ela, as rotas de aprovação não existem. */
  APROVACAO_CHAVE: z.string().min(24).optional(),
  /** Aplicativo cadastrado no portal da John Deere (Application ID e Secret). */
  DEERE_CLIENT_ID: z.string().min(1).optional(),
  DEERE_CLIENT_SECRET: z.string().min(1).optional(),
  /** Sandbox por padrão. Produção: https://partnerapi.deere.com/platform */
  DEERE_BASE_URL: z.string().url().default('https://sandboxapi.deere.com/platform'),
  /** A lista de máquinas fica numa API à parte (Equipment). */
  DEERE_EQUIPAMENTOS_URL: z.string().url().default('https://equipmentapi.deere.com/isg'),
  /**
   * API ISO 15143-3 (AEMP 2.0) da John Deere: combustível acumulado por máquina. A documentação só publica o endereço do
   * sandbox (sandboxaemp.deere.com); o de produção NÃO está publicado. Sem este valor o servidor testa os candidatos
   * conhecidos e registra no log qual respondeu.
   */
  DEERE_AEMP_URL: z.string().url().optional(),
  /** Endereço de retorno cadastrado no portal, igual ao cadastrado, letra por letra. */
  DEERE_REDIRECT_URI: z.string().url().optional(),
  /** Onde a Deere publica os endereços de login e de troca de token. */
  DEERE_WELL_KNOWN: z.string().url().default('https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/.well-known/oauth-authorization-server'),
  /** Só o que o Talhio usa. Precisa estar entre as APIs aprovadas no portal. */
  DEERE_ESCOPOS: z.string().default('offline_access ag1 ag2 ag3 eq1 org1 org2 work2'),
  /** Chave que cifra os tokens da Deere no banco (32+ caracteres). Obrigatória com DEERE_PROVEDOR=deere. */
  DEERE_CRIPTO_CHAVE: z.string().min(32, 'DEERE_CRIPTO_CHAVE precisa de pelo menos 32 caracteres').optional(),
  /**
   * "1" liga a ESTIMATIVA dos litros pela queda do nível do tanque quando o motor não informa o combustível. Padrão
   * desligado: o sensor do tanque não bate com o monitor, e combustível que não é exato fica como "sem leitura".
   */
  COMBUSTIVEL_PELO_TANQUE: z.enum(['0', '1']).default('0'),
  /** WhatsApp da fazenda (conexão por código, via Baileys). "fake" não fala com o WhatsApp de verdade. */
  WHATSAPP_PROVEDOR: z.enum(['fake', 'baileys']).default('fake'),
  /** Chave que cifra as credenciais do WhatsApp no banco (32+ caracteres). Obrigatória com WHATSAPP_PROVEDOR=baileys. */
  WHATSAPP_CRIPTO_CHAVE: z.string().min(32, 'WHATSAPP_CRIPTO_CHAVE precisa de pelo menos 32 caracteres').optional(),
  /** Redis das credenciais e chaves do WhatsApp (ex.: redis://host:6379, rediss:// com TLS). Obrigatório com WHATSAPP_PROVEDOR=baileys. */
  REDIS_URL: z.string().regex(/^rediss?:\/\//, 'REDIS_URL precisa começar com redis:// ou rediss://').optional(),
  /** Para onde o navegador volta depois do login na Deere (o app abre por este esquema). */
  APP_RETORNO_DEERE: z.string().min(3).default('talhio://deere'),
  /** Postgres de verdade. Obrigatório em produção; sem ela, usa o banco embutido numa pasta local. */
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'DATABASE_URL precisa começar com postgres://').optional(),
  /** Segredo que assina os tokens de acesso. Obrigatório em produção. */
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa de pelo menos 32 caracteres').optional(),
  ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()).optional(),
  ADMIN_SENHA: z.string().min(10, 'ADMIN_SENHA precisa de pelo menos 10 caracteres').max(200).optional(),
  ADMIN_NOME: z.string().trim().min(1).max(80).default('Administrador'),
  /**
   * E-mail da conta de demonstração (a que o revisor da Apple usa). A fazenda dessa conta passa a ler os dados de
   * exemplo (FakeProvedor) em vez da John Deere, sem WhatsApp e sem nada que escreva fora. A conta tem de existir.
   */
  DEMO_EMAIL: z.string().trim().toLowerCase().pipe(z.email()).optional(),
  /** Origens de navegador liberadas, separadas por vírgula. Vazio = nenhuma (o app nativo não precisa). */
  CORS_ORIGENS: z.string().default(''),
  /** Chave da API da Anthropic. Sem ela, o assistente responde que não foi ligado. */
  ANTHROPIC_API_KEY: z.string().min(20).optional(),
  ANTHROPIC_MODELO: z.string().min(3).default('claude-haiku-5-5'),
  /** "1" quando a API fica atrás de um proxy que informa o IP real (produção). */
  ATRAS_DE_PROXY: z.enum(['0', '1']).default('0'),
  /** Log de cada chamada à John Deere e de cada pedido do app. Ligado por padrão; LOG_DEERE=0 ou LOG_PEDIDOS=0 desliga. */
  LOG_DEERE: z.enum(['0', '1']).default('1'),
  /** Lê o consumo diário da API Machine Measurements da John Deere. Ligado por padrão; DEERE_MEDICOES=0 desliga. */
  DEERE_MEDICOES: z.enum(['0', '1']).default('1'),
  /** Detecta os alertas das máquinas e manda push (aba de notificações do app). Ligado por padrão; PUSH_ALERTAS=0 desliga. */
  PUSH_ALERTAS: z.enum(['0', '1']).default('1'),
  /** Token do Expo para o envio de push (opcional: sem ele o envio funciona, só sem a camada extra de segurança). */
  EXPO_ACCESS_TOKEN: z.string().min(10).optional(),
  /** Preenche o passado a partir desta data (AAAA-MM-DD) na próxima subida do servidor, em pedaços de 30 dias. Tirar depois. */
  MEDICOES_PREENCHER_DESDE: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD').optional(),
  LOG_PEDIDOS: z.enum(['0', '1']).default('1'),
});

/** Onde o banco embutido grava em desenvolvimento. Fora do Git. */
const PASTA_BANCO_PADRAO = '.dados/banco';

const ADMIN_DEV = { email: 'admin@talhio.local', senha: 'talhio-dev-123' };

export interface DeereAcesso {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  equipamentosUrl: string;
  aempUrl?: string;
  redirectUri: string;
  wellKnown: string;
  escopos: string;
  /** Chave de 32 bytes derivada de DEERE_CRIPTO_CHAVE. */
  criptoChave: string;
  appRetorno: string;
}

export interface Config {
  cadastroAberto: boolean;
  /** Conta nova só entra depois de aprovada por nós. */
  cadastroComAprovacao?: boolean;
  /** Chave das rotas de aprovação; nulo = rotas desligadas. */
  aprovacaoChave?: string | null;
  /** Dados do app na Deere; nulo enquanto faltar alguma variável (o provedor falso não precisa). */
  deere: DeereAcesso | null;
  porta: number;
  deereProvedor: 'fake' | 'deere';
  /** Organização do administrador criado na subida. Nas rotas, a organização vem do token (@OrgAtual). */
  orgId: string;
  /** Pasta Gen4 com talhões e linhas reais para usar no lugar da fazenda de demonstração. */
  pastaGen4: string | null;
  /** Endereço do Postgres, ou nulo para usar o banco embutido. */
  bancoUrl: string | null;
  /** Pasta do banco embutido. Nulo = só em memória (testes). */
  bancoPasta: string | null;
  jwtSegredo: string;
  adminEmail: string;
  adminSenha: string;
  adminNome: string;
  /** E-mail da conta de demonstração; nulo = nenhuma fazenda é de demonstração. */
  demoEmail?: string | null;
  corsOrigens: string[];
  /** Chave da IA (só no servidor) e o modelo usado pelo assistente. */
  iaChave: string | null;
  iaModelo: string;
  atrasDeProxy: boolean;
  logDeere: boolean;
  deereMedicoes: boolean;
  pushAlertas: boolean;
  expoAccessToken: string | null;
  medicoesPreencherDesde: string | null;
  logPedidos: boolean;
  combustivelPeloTanque: boolean;
  whatsappProvedor: 'fake' | 'baileys';
  whatsappCriptoChave: string | null;
  redisUrl: string | null;
  /** true quando login ou segredo vieram dos padrões de desenvolvimento (nunca em produção). */
  credenciaisDeDesenvolvimento: boolean;
}

export const CONFIG = Symbol('CONFIG');

/** Valida o ambiente na subida: a API não sobe com configuração inválida. */
export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const r = EnvSchema.safeParse(env);
  if (!r.success) {
    throw new Error(`Configuração inválida: ${z.prettifyError(r.error)}`);
  }
  // Sem variável definida, usa a pasta padrão se ela existir (nunca durante os testes).
  const padrao = env.NODE_ENV === 'test' ? null : resolve(PASTA_GEN4_PADRAO);
  const pastaGen4 = r.data.DEERE_PASTA_GEN4 ? resolve(r.data.DEERE_PASTA_GEN4) : padrao && existsSync(padrao) ? padrao : null;

  // Em produção nada de segurança tem valor padrão: sem as três variáveis, a API não sobe.
  const { JWT_SECRET, ADMIN_EMAIL, ADMIN_SENHA } = r.data;
  const faltando = [!JWT_SECRET && 'JWT_SECRET', !ADMIN_EMAIL && 'ADMIN_EMAIL', !ADMIN_SENHA && 'ADMIN_SENHA'].filter(Boolean);
  const faltandoEmProducao = [...faltando, !r.data.DATABASE_URL && 'DATABASE_URL'].filter(Boolean);
  if (r.data.NODE_ENV === 'production' && faltandoEmProducao.length > 0) {
    throw new Error(`Configuração inválida: em produção é obrigatório definir ${faltandoEmProducao.join(', ')}`);
  }

  const d = r.data;
  const deere: DeereAcesso | null =
    d.DEERE_CLIENT_ID && d.DEERE_CLIENT_SECRET && d.DEERE_REDIRECT_URI && d.DEERE_CRIPTO_CHAVE
      ? {
          clientId: d.DEERE_CLIENT_ID,
          clientSecret: d.DEERE_CLIENT_SECRET,
          baseUrl: d.DEERE_BASE_URL.replace(/\/$/, ''),
          equipamentosUrl: d.DEERE_EQUIPAMENTOS_URL.replace(/\/$/, ''),
          aempUrl: d.DEERE_AEMP_URL?.replace(/\/$/, ''),
          redirectUri: d.DEERE_REDIRECT_URI,
          wellKnown: d.DEERE_WELL_KNOWN,
          escopos: d.DEERE_ESCOPOS,
          criptoChave: d.DEERE_CRIPTO_CHAVE,
          appRetorno: d.APP_RETORNO_DEERE,
        }
      : null;
  if (d.DEERE_PROVEDOR === 'deere' && !deere) {
    throw new Error('Configuração inválida: DEERE_PROVEDOR=deere exige DEERE_CLIENT_ID, DEERE_CLIENT_SECRET, DEERE_REDIRECT_URI e DEERE_CRIPTO_CHAVE');
  }

  if (d.WHATSAPP_PROVEDOR === 'baileys' && (!d.WHATSAPP_CRIPTO_CHAVE || !d.REDIS_URL)) {
    throw new Error('Configuração inválida: WHATSAPP_PROVEDOR=baileys exige WHATSAPP_CRIPTO_CHAVE e REDIS_URL');
  }

  return {
    cadastroAberto: d.CADASTRO_ABERTO === '1',
    cadastroComAprovacao: d.CADASTRO_COM_APROVACAO ? d.CADASTRO_COM_APROVACAO === '1' : d.NODE_ENV === 'production',
    aprovacaoChave: d.APROVACAO_CHAVE ?? null,
    deere,
    porta: r.data.PORT,
    deereProvedor: r.data.DEERE_PROVEDOR,
    orgId: r.data.ORG_ID,
    pastaGen4,
    bancoUrl: r.data.DATABASE_URL ?? null,
    bancoPasta: env.NODE_ENV === 'test' ? null : resolve(PASTA_BANCO_PADRAO),
    // Sem segredo definido (desenvolvimento), gera um por execução: reiniciar a API desloga todo mundo.
    jwtSegredo: JWT_SECRET ?? randomBytes(48).toString('base64url'),
    adminEmail: ADMIN_EMAIL ?? ADMIN_DEV.email,
    adminSenha: ADMIN_SENHA ?? ADMIN_DEV.senha,
    adminNome: r.data.ADMIN_NOME,
    demoEmail: r.data.DEMO_EMAIL ?? null,
    corsOrigens: r.data.CORS_ORIGENS.split(',').map((o) => o.trim()).filter(Boolean),
    iaChave: r.data.ANTHROPIC_API_KEY ?? null,
    iaModelo: r.data.ANTHROPIC_MODELO,
    atrasDeProxy: r.data.ATRAS_DE_PROXY === '1',
    logDeere: r.data.LOG_DEERE === '1',
    deereMedicoes: r.data.DEERE_MEDICOES === '1',
    pushAlertas: r.data.PUSH_ALERTAS === '1',
    expoAccessToken: r.data.EXPO_ACCESS_TOKEN ?? null,
    medicoesPreencherDesde: r.data.MEDICOES_PREENCHER_DESDE ?? null,
    logPedidos: r.data.LOG_PEDIDOS === '1',
    combustivelPeloTanque: d.COMBUSTIVEL_PELO_TANQUE === '1',
    whatsappProvedor: d.WHATSAPP_PROVEDOR,
    whatsappCriptoChave: d.WHATSAPP_CRIPTO_CHAVE ?? null,
    redisUrl: d.REDIS_URL ?? null,
    credenciaisDeDesenvolvimento: faltando.length > 0,
  };
}
