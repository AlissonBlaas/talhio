import { z } from 'zod';

/**
 * Notificações da fazenda: alertas das máquinas. Cada uma aparece na aba de notificações do app e, para quem ligou o
 * aviso, chega também como push. Vêm de duas fontes: o que o Talhio vê (máquina parada ou sem sinal, combustível baixo)
 * e as falhas que a máquina registra (códigos de diagnóstico da John Deere).
 */
export const TipoDeNotificacaoSchema = z.enum(['maquina-parada', 'sem-sinal', 'combustivel-baixo', 'falha-maquina']);
export type TipoDeNotificacao = z.infer<typeof TipoDeNotificacaoSchema>;

/** `alta` = precisa de atenção agora; `media` = olhar logo; `baixa` = informativo. */
export const SeveridadeSchema = z.enum(['alta', 'media', 'baixa']);
export type Severidade = z.infer<typeof SeveridadeSchema>;

export const NotificacaoSchema = z.object({
  id: z.string(),
  tipo: TipoDeNotificacaoSchema,
  severidade: SeveridadeSchema,
  maquinaId: z.string().nullable(),
  maquinaNome: z.string().nullable(),
  titulo: z.string(),
  texto: z.string(),
  /** Quando o alerta começou (ISO). */
  criadaEm: z.string(),
  /** Quando o problema acabou (a máquina voltou a andar, o tanque foi enchido...). Nulo = ainda acontece. */
  resolvidaEm: z.string().nullable(),
});
export type Notificacao = z.infer<typeof NotificacaoSchema>;

export const ListaNotificacoesSchema = z.object({
  itens: z.array(NotificacaoSchema),
  /** Quantas chegaram depois da última vez que a pessoa abriu a aba. */
  naoLidas: z.number().int().nonnegative(),
});
export type ListaNotificacoes = z.infer<typeof ListaNotificacoesSchema>;

/** Token do Expo Push que o app pega no aparelho. */
export const RegistrarDispositivoSchema = z.object({
  token: z.string().regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Token de push inválido.'),
  plataforma: z.enum(['ios', 'android']),
});
export type RegistrarDispositivo = z.infer<typeof RegistrarDispositivoSchema>;

export const RemoverDispositivoSchema = z.object({ token: RegistrarDispositivoSchema.shape.token });
export type RemoverDispositivo = z.infer<typeof RemoverDispositivoSchema>;
