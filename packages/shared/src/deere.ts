import { z } from 'zod';

/**
 * Em que ponto está a ligação da fazenda com a John Deere.
 * - desconectado: ninguém autorizou o Talhio ainda
 * - escolher-organizacao: autorizou, falta dizer qual organização do Operations Center é a da fazenda
 * - liberar-acesso: escolheu, mas a organização ainda precisa liberar o app (passo no site da Deere)
 * - pronto: tudo ligado
 */
export const EstadoConexaoSchema = z.enum(['desconectado', 'escolher-organizacao', 'liberar-acesso', 'pronto']);
export type EstadoConexao = z.infer<typeof EstadoConexaoSchema>;

export const ConexaoDeereSchema = z.object({
  /** demonstracao = dados de exemplo, sem John Deere (não há o que conectar). */
  modo: z.enum(['demonstracao', 'deere']),
  estado: EstadoConexaoSchema,
  organizacaoNome: z.string().nullable(),
  /** Organizações em uso (a primeira é a principal). Mais de uma = máquinas e talhões das duas juntos. */
  organizacaoIds: z.array(z.string()),
  /** Quando a fazenda autorizou (ISO 8601). */
  conectadoEm: z.string().nullable(),
});
export type ConexaoDeere = z.infer<typeof ConexaoDeereSchema>;

/** Endereço da tela de login da John Deere, para abrir no navegador do aparelho. */
export const InicioDaConexaoSchema = z.object({ url: z.string().url() });
export type InicioDaConexao = z.infer<typeof InicioDaConexaoSchema>;

/** O que o navegador trouxe de volta da John Deere, entregue pelo app (logado) para concluir a conexão. */
export const ConcluirConexaoSchema = z.object({ codigo: z.string().min(1).max(4000), estado: z.string().min(1).max(1000) });
export type ConcluirConexao = z.infer<typeof ConcluirConexaoSchema>;

export const OrganizacaoDeereSchema = z.object({
  id: z.string(),
  nome: z.string(),
  /** true = a organização ainda precisa liberar o Talhio no Operations Center. */
  precisaLiberar: z.boolean(),
  /** Página da Deere onde se libera o acesso (quando precisaLiberar). */
  urlLiberar: z.string().nullable(),
});
export type OrganizacaoDeere = z.infer<typeof OrganizacaoDeereSchema>;
export const ListaOrganizacoesDeereSchema = z.object({ organizacoes: z.array(OrganizacaoDeereSchema) });

export const EscolherOrganizacoesSchema = z.object({ organizacaoIds: z.array(z.string().min(1).max(100)).min(1).max(5) });
export type EscolherOrganizacoes = z.infer<typeof EscolherOrganizacoesSchema>;

/** Resultado de ligar o aviso (webhook) de export da John Deere. `novo` = criado agora; false = já existia. */
export const AvisoDeereSchema = z.object({
  ativo: z.literal(true),
  novo: z.boolean(),
  /** Id e situação da assinatura, como a John Deere devolveu (nulos se ela não informou). */
  id: z.string().nullable(),
  status: z.string().nullable(),
  /** Um por tipo de aviso pedido: o que aconteceu com cada um. */
  avisos: z.array(z.object({ evento: z.string(), situacao: z.enum(['criado', 'ja-ligado', 'reativado', 'recusado']), detalhe: z.string().nullable() })).default([]),
});
export type AvisoDeere = z.infer<typeof AvisoDeereSchema>;
