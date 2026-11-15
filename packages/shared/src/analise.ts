import { z } from 'zod';

/**
 * "Todos os dados" da máquina: as medições que o Analisador da Máquina do Operations Center mostra (Machine
 * Measurements da John Deere), agrupadas como lá, num período. Cada medição é um valor só (ex.: tensão média) ou uma
 * lista de faixas (ex.: horas por estado da máquina, patinagem por nível).
 */
export const FaixaDaAnaliseSchema = z.object({
  rotulo: z.string(),
  /** Na unidade do item. Nulo quando a Deere não mandou valor para a faixa. */
  valor: z.number().nullable(),
});
export type FaixaDaAnalise = z.infer<typeof FaixaDaAnaliseSchema>;

export const ItemDaAnaliseSchema = z.object({
  id: z.string(),
  /** Em português quando conhecemos a medição; senão o nome que a Deere manda. */
  nome: z.string(),
  /** "h", "L", "L/h", "%", "°C", "rpm", "km/h", "V", "kPa", "°" ou vazio (número sem unidade). */
  unidade: z.string(),
  tipo: z.enum(['valor', 'faixas']),
  valor: z.number().nullable(),
  faixas: z.array(FaixaDaAnaliseSchema),
  /** Como a Deere combinou o período: soma, média, último valor, máximo ou mínimo. */
  agregacao: z.enum(['soma', 'media', 'ultimo', 'maximo', 'minimo']),
});
export type ItemDaAnalise = z.infer<typeof ItemDaAnaliseSchema>;

export const GrupoDaAnaliseSchema = z.object({
  id: z.string(),
  nome: z.string(),
  itens: z.array(ItemDaAnaliseSchema),
});
export type GrupoDaAnalise = z.infer<typeof GrupoDaAnaliseSchema>;

export const AnaliseDaMaquinaSchema = z.object({
  maquinaId: z.string(),
  /** Primeiro e último dia (AAAA-MM-DD, horário de Brasília) do período. */
  de: z.string(),
  ate: z.string(),
  /** Vazio quando a máquina não tem telemetria ou não reportou nada no período. */
  grupos: z.array(GrupoDaAnaliseSchema),
});
export type AnaliseDaMaquina = z.infer<typeof AnaliseDaMaquinaSchema>;
