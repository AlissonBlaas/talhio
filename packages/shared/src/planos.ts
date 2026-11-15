import { z } from 'zod';
import { OperacaoSchema } from './talhoes';

const DiaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data');
const texto = (max: number) => z.string().trim().min(1).max(max).nullable().default(null);
const numero = (max: number) => z.number().positive().max(max).nullable().default(null);

/**
 * Em que pé está o envio do plano ao monitor da máquina.
 * `aguardando-liberacao`: o plano está salvo, mas a John Deere ainda não liberou o envio (Work Plans).
 */
export const EnvioDoPlanoSchema = z.enum(['aguardando-liberacao', 'na-fila', 'recebido']);
export type EnvioDoPlano = z.infer<typeof EnvioDoPlanoSchema>;

/** Plano de trabalho: o que fazer, em quais talhões, com quais máquinas e a partir de quando. */
export const NovoPlanoSchema = z
  .object({
    /** O primeiro é o talhão principal; os demais recebem o mesmo plano. */
    talhaoIds: z.array(z.string().min(1).max(100)).min(1, 'Escolha o talhão').max(20),
    operacao: OperacaoSchema,
    cultura: texto(40),
    variedade: texto(60),
    sementesPorHa: numero(2_000_000),
    espacamentoCm: numero(500),
    /** Adubo ou defensivo. */
    produto: texto(60),
    /** kg/ha (adubo) ou L/ha (pulverização). */
    doseProduto: numero(100_000),
    dataInicio: DiaSchema,
    recado: texto(300),
    maquinaIds: z.array(z.string().min(1).max(100)).min(1, 'Escolha pelo menos uma máquina').max(30),
  })
  .superRefine((plano, ctx) => {
    if (plano.operacao !== 'plantio') return;
    if (!plano.cultura) ctx.addIssue({ code: 'custom', path: ['cultura'], message: 'Escolha a cultura' });
    if (!plano.variedade) ctx.addIssue({ code: 'custom', path: ['variedade'], message: 'Informe a variedade' });
    if (!plano.sementesPorHa) ctx.addIssue({ code: 'custom', path: ['sementesPorHa'], message: 'Informe a taxa' });
  });
export type NovoPlano = z.input<typeof NovoPlanoSchema>;

export const PlanoSchema = z.object({
  id: z.string().min(1),
  talhoes: z.array(z.object({ id: z.string(), nome: z.string() })),
  operacao: OperacaoSchema,
  cultura: z.string().nullable(),
  variedade: z.string().nullable(),
  sementesPorHa: z.number().nullable(),
  espacamentoCm: z.number().nullable(),
  produto: z.string().nullable(),
  doseProduto: z.number().nullable(),
  dataInicio: DiaSchema,
  recado: z.string().nullable(),
  maquinas: z.array(z.object({ id: z.string(), nome: z.string(), envio: EnvioDoPlanoSchema })),
  criadoEm: z.string(),
});
export type Plano = z.infer<typeof PlanoSchema>;
export const ListaPlanosSchema = z.array(PlanoSchema);
