import { Inject, Injectable, Logger } from '@nestjs/common';
import { CONFIG, type Config } from '../core/config.js';

export interface MensagemPush {
  titulo: string;
  texto: string;
  /** Vai junto no push: o app usa para abrir a máquina quando a pessoa toca. */
  dados: Record<string, string>;
}

type Http = typeof fetch;
export const HTTP_EXPO = Symbol('HTTP_EXPO');

const ENDERECO = 'https://exp.host/--/api/v2/push/send';
/** O Expo aceita até 100 mensagens por chamada. */
const POR_CHAMADA = 100;

/**
 * Envia push pelo serviço do Expo. Devolve os tokens que o Expo disse que não existem mais (para o chamador apagar).
 * Nunca lança por erro de rede ou de resposta: o push é um aviso a mais, e a notificação já está na aba do app.
 */
@Injectable()
export class ExpoPushService {
  private readonly log = new Logger('Push');

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(HTTP_EXPO) private readonly http: Http,
  ) {}

  async enviar(tokens: string[], mensagem: MensagemPush): Promise<{ invalidos: string[] }> {
    const invalidos: string[] = [];
    if (tokens.length === 0) return { invalidos };
    for (let i = 0; i < tokens.length; i += POR_CHAMADA) {
      const lote = tokens.slice(i, i + POR_CHAMADA);
      try {
        const resposta = await this.http(ENDERECO, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(this.config.expoAccessToken ? { Authorization: `Bearer ${this.config.expoAccessToken}` } : {}),
          },
          body: JSON.stringify(lote.map((to) => ({ to, title: mensagem.titulo, body: mensagem.texto, data: mensagem.dados, sound: 'default', priority: 'high', channelId: 'alertas' }))),
          signal: AbortSignal.timeout(15_000),
        });
        if (!resposta.ok) {
          this.log.warn(`O Expo respondeu ${resposta.status} ao enviar ${lote.length} push.`);
          continue;
        }
        const corpo = (await resposta.json()) as { data?: { status?: string; details?: { error?: string } }[] };
        (corpo.data ?? []).forEach((ticket, n) => {
          if (ticket.status !== 'error') return;
          if (ticket.details?.error === 'DeviceNotRegistered') invalidos.push(lote[n]!);
          else this.log.warn(`Push recusado pelo Expo: ${ticket.details?.error ?? 'erro desconhecido'}`);
        });
      } catch (e) {
        this.log.warn(`Não consegui falar com o Expo: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { invalidos };
  }
}
