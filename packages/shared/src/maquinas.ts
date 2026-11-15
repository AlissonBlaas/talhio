import { z } from 'zod';
import { PosicaoSchema } from './geo';

export const TipoMaquinaSchema = z.enum(['trator', 'pulverizador', 'colheitadeira']);
export type TipoMaquina = z.infer<typeof TipoMaquinaSchema>;

export const StatusMaquinaSchema = z.enum(['trabalhando', 'parada', 'sem-sinal']);
export type StatusMaquina = z.infer<typeof StatusMaquinaSchema>;

export const MaquinaSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  tipo: TipoMaquinaSchema,
  implemento: z.string().nullable(),
  /** Operador escalado para a máquina hoje. */
  operador: z.string().nullable(),
  status: StatusMaquinaSchema,
  /** Talhão em que a máquina está agora, calculado pelo backend. */
  talhaoId: z.string().nullable(),
  talhaoNome: z.string().nullable(),
  /** Data e hora ISO 8601 do último dado recebido da máquina. */
  ultimoSinal: z.string().min(1),
  /** Desde quando está parada (ISO 8601). Nulo se não está parada. */
  paradaDesde: z.string().nullable(),
  posicao: PosicaoSchema.nullable(),
  horasHoje: z.number().nonnegative(),
  areaHojeHa: z.number().nonnegative(),
  /** Velocidade no último dado recebido. Nulo sem dado. */
  velocidadeKmH: z.number().nonnegative().nullable(),
  motorLigado: z.boolean(),
  /** Nível do tanque, de 0 a 100. Nulo quando a máquina não informa. */
  combustivelPct: z.number().min(0).max(100).nullable(),
  /**
   * O tanque está marcando cheio há muito tempo com a máquina trabalhando: a leitura não é confiável (boia travada
   * ou sensor que não informa). O número continua em `combustivelPct`; quem mostra avisa.
   */
  combustivelSuspeito: z.boolean().default(false),
  /** Horas totais do motor (horímetro). */
  horimetro: z.number().nonnegative().nullable(),
  modelo: z.string().nullable(),
  numeroSerie: z.string().nullable(),
  ano: z.number().int().nullable(),
  /** false quando a máquina não tem modem ou assinatura de telemetria ativa. */
  telemetriaAtiva: z.boolean(),
  /** Largura do implemento que o administrador informou, em metros. Nulo = não informada (usa a das linhas do talhão). */
  larguraImplementoM: z.number().positive().nullable().default(null),
  /**
   * Como o dia foi usado, em horas, pelo caminho da máquina: trabalhando (andando em ritmo de serviço), ocioso
   * (ligada e parada) e transporte (andando rápido). `combustivelL` = litros gastos hoje; nulo quando não há leitura.
   * Nulo quando a fonte não informa.
   */
  usoHoje: z
    .object({
      trabalhandoH: z.number().nonnegative(),
      ociosoH: z.number().nonnegative(),
      transporteH: z.number().nonnegative(),
      combustivelL: z.number().nonnegative().nullable(),
      /** Hectares cobertos hoje dentro de talhões com contorno, e fora de todos. A área do dia é a soma dos dois. */
      areaDentroHa: z.number().nonnegative().default(0),
      areaForaHa: z.number().nonnegative().default(0),
      /**
       * Onde o dia foi gasto: horas andando e horas parado dentro de cada talhão, e fora de todos (`talhaoId` nulo).
       * Só entra o que somou pelo menos 3 min. Do maior tempo para o menor.
       */
      porTalhao: z.array(z.object({ talhaoId: z.string().nullable(), nome: z.string(), andandoH: z.number().nonnegative(), paradoH: z.number().nonnegative() })).default([]),
    })
    .nullable()
    .default(null),
});
export type Maquina = z.infer<typeof MaquinaSchema>;

export const ListaMaquinasSchema = z.array(MaquinaSchema);

/** Largura do implemento de uma máquina, em metros. Nulo apaga a informação. */
export const LarguraDoImplementoSchema = z.object({ larguraM: z.number().min(0.5, 'Informe a largura em metros').max(60, 'Largura grande demais').nullable() });
export type LarguraDoImplemento = z.infer<typeof LarguraDoImplementoSchema>;

/** Caminho que a máquina fez hoje, em trechos (um trecho novo a cada pausa longa no sinal). Pontos em [lng, lat]. */
export const RastroDaMaquinaSchema = z.object({
  maquinaId: z.string().min(1),
  trechos: z.array(z.array(z.tuple([z.number(), z.number()]))),
  /** Paradas de 2 min ou mais ao longo do caminho: onde, quando começou e quanto durou. */
  paradas: z.array(z.object({ lng: z.number(), lat: z.number(), inicio: z.string().min(1), minutos: z.number().nonnegative() })).default([]),
});
export type RastroDaMaquina = z.infer<typeof RastroDaMaquinaSchema>;
export const ListaRastrosSchema = z.array(RastroDaMaquinaSchema);
