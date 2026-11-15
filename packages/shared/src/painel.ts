import { z } from 'zod';
import { PoligonoSchema, PosicaoSchema } from './geo';
import { StatusMaquinaSchema } from './maquinas';
import { OperacaoSchema } from './talhoes';

/** Tudo o que a tela Início precisa, em uma chamada só. */
export const PainelSchema = z.object({
  fazendaNome: z.string().min(1),
  contagem: z.object({
    trabalhando: z.number().int().nonnegative(),
    parada: z.number().int().nonnegative(),
    semSinal: z.number().int().nonnegative(),
  }),
  talhoes: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      contorno: PoligonoSchema,
      /** Operação em andamento no talhão, se houver. */
      operacao: OperacaoSchema.nullable(),
    }),
  ),
  maquinas: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      status: StatusMaquinaSchema,
      posicao: PosicaoSchema.nullable(),
    }),
  ),
  /** Alerta mais importante do momento, se houver. */
  alerta: z
    .object({
      tipo: z.literal('maquina-parada'),
      maquinaId: z.string(),
      maquinaNome: z.string(),
      desde: z.string(),
      talhaoNome: z.string().nullable(),
      motorLigado: z.boolean(),
    })
    .nullable(),
  operacaoAtual: z
    .object({
      nome: z.string(),
      percentual: z.number().min(0).max(100),
    })
    .nullable(),
});
export type Painel = z.infer<typeof PainelSchema>;
