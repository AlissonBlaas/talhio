import { z } from 'zod';

/** Arquivos escolhidos no app, enviados em base64. Aceita um .zip ou os arquivos soltos. */
export const ImportacaoSchema = z.object({
  arquivos: z
    .array(z.object({ nome: z.string().min(1).max(260), conteudoBase64: z.string().min(1) }))
    .min(1, 'Escolha pelo menos um arquivo')
    .max(200, 'Arquivos demais de uma vez'),
});
export type Importacao = z.infer<typeof ImportacaoSchema>;

/** O que entrou no sistema depois de uma importação. */
export const ResultadoImportacaoSchema = z.object({
  fazendaNome: z.string(),
  talhoes: z.array(z.object({ id: z.string(), nome: z.string(), areaHa: z.number(), passadas: z.number().int().nonnegative() })),
  totalLinhas: z.number().int().nonnegative(),
  totalPassadas: z.number().int().nonnegative(),
});
export type ResultadoImportacao = z.infer<typeof ResultadoImportacaoSchema>;
