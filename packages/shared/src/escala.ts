import { z } from 'zod';

import { StatusMaquinaSchema, TipoMaquinaSchema } from './maquinas';

export const TurnoSchema = z.enum(['dia-todo', 'manha', 'tarde', 'noite']);
export type Turno = z.infer<typeof TurnoSchema>;

/** A ordem em que os turnos aparecem: o dia todo primeiro, depois manhã, tarde e noite. */
export const ORDEM_DOS_TURNOS: Turno[] = ['dia-todo', 'manha', 'tarde', 'noite'];

/** O turno de uma hora do dia (0 a 23), no fuso da fazenda: manhã das 5h ao meio-dia, tarde até as 18h, noite no resto. */
export const turnoDaHora = (hora: number): Exclude<Turno, 'dia-todo'> => (hora >= 5 && hora < 12 ? 'manha' : hora >= 12 && hora < 18 ? 'tarde' : 'noite');

/**
 * Uma máquina em um turno da escala do dia. Toda máquina da fazenda aparece, escalada ou não. A mesma máquina pode ter
 * uma linha por turno (manhã, tarde, noite), cada uma com o seu operador; "dia todo" é uma linha só e exclui as outras.
 */
export const EscalaItemSchema = z.object({
  maquinaId: z.string().min(1),
  maquinaNome: z.string().min(1),
  implemento: z.string().nullable(),
  /** Como a máquina está AGORA (trabalhando, parada com sinal, sem sinal), para a escala mostrar ao lado do nome. */
  maquinaStatus: StatusMaquinaSchema.default('sem-sinal'),
  maquinaTipo: TipoMaquinaSchema.default('trator'),
  /** Nulo quando ninguém foi escalado e a máquina também não informa operador. */
  operador: z.string().nullable(),
  /** O que vai ser feito: "Plantio de soja", "Gradagem"... */
  tarefa: z.string().nullable(),
  talhaoId: z.string().nullable(),
  talhaoNome: z.string().nullable(),
  turno: TurnoSchema,
  /** false = sugestão vinda da máquina, ainda não confirmada por quem monta a escala. */
  definida: z.boolean(),
  /** Quando a escala desta máquina foi enviada à equipe (ISO 8601). Mudar a escala zera. */
  enviadaEm: z.string().nullable(),
});
export type EscalaItem = z.infer<typeof EscalaItemSchema>;

export const EscalaSchema = z.object({
  /** Dia da escala, AAAA-MM-DD, no fuso da fazenda. */
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  itens: z.array(EscalaItemSchema),
});
export type Escala = z.infer<typeof EscalaSchema>;

/** `?dia=AAAA-MM-DD`: de que dia é a escala. Sem ele, hoje. */
export const PedidoDeEscalaSchema = z.object({ dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida').optional() });

/** `?turno=`: ao tirar da escala, só a linha desse turno. Sem ele, todas as linhas da máquina no dia. */
export const PedidoDeTirarSchema = PedidoDeEscalaSchema.extend({ turno: TurnoSchema.optional() });

/** Corpo do envio. Com `maquinaIds`, só essas máquinas constam como enviadas (escala de um plano). */
export const EnvioDaEscalaSchema = z.object({ maquinaIds: z.array(z.string().min(1).max(100)).min(1).max(30).optional() }).default({});

/** Quem vai em uma máquina no dia. */
export const DefinirEscalaSchema = z.object({
  operador: z.string().trim().min(1, 'Escolha quem vai operar').max(40),
  tarefa: z.string().trim().min(1).max(40).nullable().default(null),
  talhaoId: z.string().min(1).max(100).nullable().default(null),
  turno: TurnoSchema.default('dia-todo'),
  /** Ao EDITAR uma linha e trocar o turno dela: o turno que ela tinha, para a linha antiga sair. */
  substitui: TurnoSchema.optional(),
});
export type DefinirEscala = z.input<typeof DefinirEscalaSchema>;
