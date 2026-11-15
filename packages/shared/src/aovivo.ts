import { z } from 'zod';
import { MaquinaSchema } from './maquinas';
import { PerguntaSchema, RespostaSchema } from './assistente';

/**
 * Canal ao vivo (WebSocket em /v1/ao-vivo). Um canal só para o app inteiro: o servidor empurra as máquinas
 * quando algo muda e transmite a resposta do assistente aos poucos.
 */

/** O que o app manda. O primeiro quadro tem de ser `auth`; sem ele o servidor fecha o canal em 5 s. */
export const QuadroDoAppSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('auth'), token: z.string().min(1).max(4000) }),
  z.object({ tipo: z.literal('chat'), id: z.string().min(1).max(64), pergunta: PerguntaSchema }),
]);
export type QuadroDoApp = z.input<typeof QuadroDoAppSchema>;

/** O que o servidor manda. */
export const QuadroDoServidorSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('pronto') }),
  z.object({ tipo: z.literal('maquinas'), maquinas: z.array(MaquinaSchema) }),
  z.object({ tipo: z.literal('chat.trecho'), id: z.string(), texto: z.string() }),
  z.object({ tipo: z.literal('chat.fim'), id: z.string(), resposta: RespostaSchema }),
  z.object({ tipo: z.literal('chat.erro'), id: z.string(), codigo: z.string(), mensagem: z.string() }),
]);
export type QuadroDoServidor = z.infer<typeof QuadroDoServidorSchema>;

/** Códigos de fechamento do canal. */
export const FECHAMENTO_NAO_AUTENTICADO = 4401;
