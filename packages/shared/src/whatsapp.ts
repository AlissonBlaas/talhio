import { z } from 'zod';

/** Grupo do WhatsApp. O id é o identificador do WhatsApp (termina em @g.us). */
export const GrupoWhatsappSchema = z.object({
  id: z.string().regex(/^\d+(-\d+)?@g\.us$/),
  nome: z.string(),
  participantes: z.number().int().nonnegative(),
});
export type GrupoWhatsapp = z.infer<typeof GrupoWhatsappSchema>;

export const ListaGruposWhatsappSchema = z.object({ grupos: z.array(GrupoWhatsappSchema) });
export type ListaGruposWhatsapp = z.infer<typeof ListaGruposWhatsappSchema>;

export const EscolherGrupoSchema = z.object({ grupoId: GrupoWhatsappSchema.shape.id });
export type EscolherGrupo = z.infer<typeof EscolherGrupoSchema>;

/** Onde está a ligação da fazenda com o WhatsApp. */
export const EstadoWhatsappSchema = z.object({
  estado: z.enum([
    /** O servidor não está com o WhatsApp ligado (sem chave ou provedor desligado). */
    'indisponivel',
    'desconectado',
    /** O código foi gerado; falta a pessoa digitar no WhatsApp. */
    'aguardando-codigo',
    /** Já foi conectado e o servidor está religando sozinho (queda de rede, reinício). */
    'reconectando',
    'conectado',
  ]),
  /** Número conectado, só dígitos com o código do país (ex.: 5547999990000). */
  numero: z.string().nullable(),
  conectadoEm: z.iso.datetime().nullable(),
  /** Grupo que recebe as notificações da fazenda. Nulo até a pessoa escolher. */
  grupo: z.object({ id: z.string(), nome: z.string() }).nullable().default(null),
});
export type EstadoWhatsapp = z.infer<typeof EstadoWhatsappSchema>;

/** Aceita "(47) 99999-0000", "47999990000" ou "+55 47 99999-0000"; devolve só dígitos com o 55 na frente. */
export function normalizarTelefone(texto: string): string {
  const digitos = texto.replace(/\D/g, '');
  return digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
}

/**
 * Máscara do telefone brasileiro enquanto a pessoa digita: põe o parêntese do DDD, o espaço e o hífen sozinha.
 * "47999990000" vira "(47) 99999-0000"; com 10 dígitos (fixo), "(47) 3333-0000". Aceita número colado com +55.
 * `anterior` é o que estava no campo: apagar um caractere da máscara (o hífen, o parêntese) apaga o dígito antes dele,
 * senão a máscara voltaria a pôr o mesmo caractere e a pessoa não conseguiria apagar.
 */
export function mascaraDeTelefone(texto: string, anterior = ''): string {
  const soDigitos = (t: string) => t.replace(/\D/g, '');
  let digitos = soDigitos(texto);
  if (texto.length < anterior.length && digitos === soDigitos(anterior)) digitos = digitos.slice(0, -1);
  // Colado com o código do país: fica só DDD + número.
  if (digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2);
  digitos = digitos.slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  // Celular tem 9 dígitos (5 + 4); fixo tem 8 (4 + 4). Enquanto não chega ao nono, mostra no formato do fixo.
  const corte = numero.length > 8 ? 5 : 4;
  return numero.length <= corte ? `(${ddd}) ${numero}` : `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}

export const PedirCodigoSchema = z.object({
  /** Número do WhatsApp que vai ser conectado (o do celular que a fazenda usa para falar com a equipe). */
  telefone: z
    .string()
    .trim()
    .max(30)
    .transform(normalizarTelefone)
    .refine((t) => /^\d{12,15}$/.test(t), 'Informe o número com DDD, ex.: (47) 99999-0000'),
});
export type PedirCodigo = z.input<typeof PedirCodigoSchema>;

export const CodigoWhatsappSchema = z.object({
  /** Código de 8 letras e números para digitar no WhatsApp (Aparelhos conectados > Conectar com número de telefone). */
  codigo: z.string().min(4).max(16),
  telefone: z.string(),
});
export type CodigoWhatsapp = z.infer<typeof CodigoWhatsappSchema>;

/** Texto que o administrador manda ao grupo escolhido (a escala do dia, por exemplo). */
export const MensagemAoGrupoSchema = z.object({ texto: z.string().trim().min(1, 'Mensagem vazia').max(4000) });
export type MensagemAoGrupo = z.infer<typeof MensagemAoGrupoSchema>;

/** Resposta de um envio ao grupo: o nome do grupo que recebeu, para a tela confirmar. */
export const EnvioAoGrupoSchema = z.object({ grupoNome: z.string() });
export type EnvioAoGrupo = z.infer<typeof EnvioAoGrupoSchema>;
