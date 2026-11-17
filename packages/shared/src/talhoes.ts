import { z } from 'zod';
import { PoligonoSchema } from './geo';

export const OperacaoSchema = z.enum(['plantio', 'pulverizacao', 'adubacao', 'colheita']);
export type Operacao = z.infer<typeof OperacaoSchema>;

export const TalhaoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  areaHa: z.number().positive(),
  cultura: z.string().nullable(),
  contorno: PoligonoSchema,
  /** Operação em andamento no talhão, se houver. */
  operacao: OperacaoSchema.nullable(),
  /** Quanto da operação em andamento já foi feito, de 0 a 100. Nulo sem operação. */
  percentualFeito: z.number().min(0).max(100).nullable(),
  /**
   * Só na resposta de criar um talhão desenhado no app: foi criado também no Operations Center (`enviado`), a John
   * Deere recusou ou o servidor não está ligado a ela (`recusado`), ou ninguém pediu o envio (`nao-pedido`).
   * Nos três casos o talhão está salvo no Talhio.
   */
  envioDeere: z.enum(['enviado', 'recusado', 'nao-pedido']).optional(),
  /** Talhão desenhado no Talhio: só esses podem ser editados e apagados pelo aplicativo. Ausente = veio da John Deere ou de arquivo. */
  doApp: z.boolean().optional(),
  /** Talhão do aplicativo que tem cópia no Operations Center da fazenda. */
  naDeere: z.boolean().optional(),
});
export type Talhao = z.infer<typeof TalhaoSchema>;

export const ListaTalhoesSchema = z.array(TalhaoSchema);

/** Dados para criar um talhão desenhado no app. A área é calculada pelo backend. */
export const NovoTalhaoSchema = z.object({
  nome: z.string().trim().min(1, 'Dê um nome ao talhão').max(60),
  cultura: z.string().trim().min(1).max(40).nullable().default(null),
  contorno: PoligonoSchema.refine((p) => (p.coordinates[0]?.length ?? 0) >= 4, 'O contorno precisa de pelo menos 3 cantos'),
  /**
   * Criar o talhão também na conta John Deere da fazenda (Operations Center), para a linha AB e o plano poderem
   * chegar ao monitor. É uma escrita na conta do cliente: só com o "sim" de quem está salvando.
   */
  enviarParaDeere: z.boolean().default(false),
});
export type NovoTalhao = z.input<typeof NovoTalhaoSchema>;

/**
 * Mudança num talhão desenhado no app. Só vai o que mudou; a área é recalculada pelo backend quando o contorno muda.
 * `enviarParaDeere` manda o talhão como ficou para o Operations Center (cria lá se ainda não existe; se existe,
 * troca o contorno e o nome). É escrita na conta do cliente: só com o "sim" de quem está salvando.
 */
export const EditarTalhaoSchema = z.object({
  nome: NovoTalhaoSchema.shape.nome.optional(),
  cultura: z.string().trim().min(1).max(40).nullable().optional(),
  contorno: NovoTalhaoSchema.shape.contorno.optional(),
  enviarParaDeere: z.boolean().default(false),
});
export type EditarTalhao = z.input<typeof EditarTalhaoSchema>;

/** `?naDeere=1` ao apagar: arquiva também a cópia do talhão no Operations Center. */
export const PedidoDeApagarTalhaoSchema = z.object({ naDeere: z.enum(['0', '1']).default('0') });

/**
 * O que aconteceu com a cópia na John Deere quando o talhão foi apagado do Talhio: `arquivado` (some de lá e do
 * mapa; dá para desarquivar no Operations Center), `recusado` (a John Deere não aceitou: a cópia continua lá e volta
 * a aparecer no mapa como talhão dela), `mantido` (ninguém pediu para arquivar: idem) ou `nao-tinha`.
 */
export const TalhaoApagadoSchema = z.object({ naDeere: z.enum(['arquivado', 'recusado', 'mantido', 'nao-tinha']) });
export type TalhaoApagado = z.infer<typeof TalhaoApagadoSchema>;
