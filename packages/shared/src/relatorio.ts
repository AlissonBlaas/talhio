import { z } from 'zod';

import { OperacaoSchema } from './talhoes';

export const PeriodoSchema = z.enum(['dia', 'semana', 'mes']);
export type Periodo = z.infer<typeof PeriodoSchema>;

/** Um número do período e o mesmo número no período anterior (o dia antes, os 7 dias antes ou o mês antes). */
const ComparadoSchema = z.object({ valor: z.number(), anterior: z.number() });

/** Dia de referência de um relatório: AAAA-MM-DD. Sem ele, vale hoje. */
export const DiaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data no formato AAAA-MM-DD.');

export const RelatorioSchema = z.object({
  periodo: PeriodoSchema,
  /** Nome da fazenda, para o cabeçalho do PDF e dos textos. */
  fazendaNome: z.string(),
  /** Quando o relatório foi pedido só para algumas máquinas: quais. Nulo = a fazenda inteira. */
  soMaquinas: z.array(z.object({ maquinaId: z.string(), nome: z.string() })).nullable().default(null),
  /** Primeiro e último dia do período, no formato AAAA-MM-DD (dia: os dois são iguais). */
  inicio: z.string(),
  fim: z.string(),
  /** Primeiro e último dia do período anterior, usado na comparação. */
  anteriorInicio: z.string(),
  anteriorFim: z.string(),
  /** Texto pronto para ler. Os números dele saem dos indicadores abaixo, calculados no servidor. */
  resumo: z.string(),
  indicadores: z.object({
    areaHa: ComparadoSchema,
    /** Da área trabalhada, quanto foi fora de todos os talhões com contorno (o resto foi dentro). */
    areaForaDosTalhoesHa: z.number().nonnegative().default(0),
    horas: ComparadoSchema,
    /** Litros de combustível por hectare. Nulo quando não houve área trabalhada. */
    consumoLPorHa: z.object({ valor: z.number().nullable(), anterior: z.number().nullable() }),
    /**
     * Litros de combustível por hora de máquina. Existe sempre que há leitura de combustível, mesmo quando a área
     * não cobre o trabalho todo (ela só é medida dentro dos talhões com contorno). Nulo sem leitura de combustível.
     */
    consumoLPorHora: z.object({ valor: z.number().nullable(), anterior: z.number().nullable() }).default({ valor: null, anterior: null }),
    paradoMin: ComparadoSchema,
    /** Combustível usado no período, em litros. Nulo sem leitura de combustível (não é zero litro). */
    litros: z.object({ valor: z.number().nullable(), anterior: z.number().nullable() }).default({ valor: null, anterior: null }),
  }),
  /**
   * true quando algum litro do período é ESTIMADO pela queda do nível do tanque, e não lido do motor. Tela, PDF, texto
   * do WhatsApp e IA avisam: o número pode diferir do monitor.
   */
  combustivelEstimado: z.boolean().default(false),
  /** "HH:MM" quando os litros contam só a partir dessa leitura (o que veio antes ficou de fora). Nulo quando o dia está inteiro. */
  combustivelDesde: z.string().nullable().default(null),
  /** Um ponto por dia do período, para o gráfico de evolução. */
  porDia: z.array(z.object({ dia: z.string(), areaHa: z.number(), horas: z.number(), paradoMin: z.number(), litros: z.number().nullable().default(null) })),
  /** A máquina que mais ficou parada no período, se alguma ficou. */
  maiorParada: z.object({ maquinaId: z.string(), maquinaNome: z.string(), minutos: z.number(), talhaoNome: z.string().nullable() }).nullable(),
  /** Da que mais fez área para a que menos fez. */
  porMaquina: z.array(
    z.object({
      maquinaId: z.string(),
      nome: z.string(),
      areaHa: z.number(),
      horas: z.number(),
      /** Litros gastos no período; nulo = sem leitura de combustível (não é zero litro). */
      litros: z.number().nullable().default(null),
      /** Litros por hectare e por hora de máquina da própria máquina; nulos sem leitura de combustível. */
      consumoLPorHa: z.number().nullable().default(null),
      consumoLPorHora: z.number().nullable().default(null),
      /** true quando os litros desta máquina são ESTIMADOS pela queda do nível do tanque (não é o número do motor). */
      litrosEstimados: z.boolean().default(false),
      /** Minutos com o motor ligado e a máquina parada. */
      paradoMin: z.number().default(0),
      /** true na máquina que merece atenção (a que mais ficou parada). */
      destaque: z.boolean(),
    }),
  ),
  /**
   * Área do período dividida pela operação do plano que valia para cada máquina em cada dia (o plano mais recente
   * que já tinha começado e inclui a máquina). `operacao` nula = área de máquina sem plano. Vazio se não há plano algum.
   */
  porOperacao: z.array(z.object({ operacao: OperacaoSchema.nullable(), areaHa: z.number().nonnegative() })).default([]),
});
export type Relatorio = z.infer<typeof RelatorioSchema>;

/** `?maquinas=id1,id2` nas rotas do relatório: só essas máquinas entram na conta. */
export const FiltroDeMaquinasSchema = z
  .string()
  .max(5000)
  .transform((texto) => [...new Set(texto.split(',').map((id) => id.trim()).filter(Boolean))])
  .pipe(z.array(z.string().max(100).regex(/^[\w-]+$/, 'Identificador inválido')).min(1).max(50));
