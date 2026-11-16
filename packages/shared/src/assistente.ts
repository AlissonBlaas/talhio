import { z } from 'zod';

/**
 * Um botão embaixo da resposta que leva a uma tela do aplicativo. A rota vem SEMPRE de uma lista fixa do servidor
 * (o modelo só escolhe o identificador): começa com "/" e é um caminho do próprio app, nunca um endereço de fora.
 */
export const AtalhoSchema = z.object({ rotulo: z.string().min(1).max(40), rota: z.string().regex(/^\/[a-z0-9\-/_.~%]*$/i).max(160) });
export type Atalho = z.infer<typeof AtalhoSchema>;

export const MensagemSchema = z.object({
  papel: z.enum(['usuario', 'assistente']),
  texto: z.string().trim().min(1).max(4000),
  /** Só nas falas do assistente: telas para abrir a partir da resposta. */
  atalhos: z.array(AtalhoSchema).max(3).optional(),
});
export type Mensagem = z.infer<typeof MensagemSchema>;

/** Uma pergunta nova. Sem `conversaId`, começa uma conversa; com ele, continua a que já existe. */
export const PerguntaSchema = z.object({
  conversaId: z.string().min(1).max(100).nullable().default(null),
  texto: z.string().trim().min(1, 'Escreva a pergunta').max(4000),
});
export type Pergunta = z.input<typeof PerguntaSchema>;

export const RespostaSchema = z.object({
  /** A conversa onde a pergunta e a resposta foram guardadas. Use nas próximas perguntas. */
  conversaId: z.string(),
  texto: z.string(),
  /** Perguntas de continuação, para aparecerem como atalhos. */
  sugestoes: z.array(z.string()).max(3),
  /** Telas do aplicativo para abrir a partir desta resposta ("Abrir a Escala"). */
  atalhos: z.array(AtalhoSchema).max(3).default([]),
});
export type Resposta = z.infer<typeof RespostaSchema>;

/** Uma conversa na lista do histórico. */
export const ConversaResumoSchema = z.object({
  id: z.string(),
  /** A primeira pergunta, encurtada. */
  titulo: z.string(),
  atualizadaEm: z.iso.datetime(),
});
export type ConversaResumo = z.infer<typeof ConversaResumoSchema>;

/** Uma página do histórico, da conversa mais recente para a mais antiga. */
export const PaginaDeConversasSchema = z.object({
  conversas: z.array(ConversaResumoSchema),
  /** Quantas pular para pedir a próxima página. Nulo quando acabou. */
  proximo: z.number().int().nullable(),
});
export type PaginaDeConversas = z.infer<typeof PaginaDeConversasSchema>;
/** `?pular=20`: a partir de qual conversa listar. */
export const PedidoDeConversasSchema = z.object({ pular: z.coerce.number().int().min(0).max(10_000).default(0) });

/**
 * Um trecho da conversa: as mensagens mais recentes (ou as anteriores a `antes`), em ordem.
 * As mensagens são numeradas a partir de 0 dentro da conversa.
 */
export const ConversaSchema = ConversaResumoSchema.extend({
  mensagens: z.array(MensagemSchema),
  /** Número da primeira mensagem deste trecho. Maior que 0 = há mensagens mais antigas para buscar. */
  primeiraOrdem: z.number().int().min(0),
});
/** `?antes=40&limite=30`: as `limite` mensagens imediatamente anteriores à de número `antes`. */
export const PedidoDeMensagensSchema = z.object({
  antes: z.coerce.number().int().min(0).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(30),
});
export type Conversa = z.infer<typeof ConversaSchema>;
