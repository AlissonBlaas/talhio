import { Injectable } from '@nestjs/common';

/** Senhas erradas, vindas do MESMO endereço de rede, até o e-mail ficar bloqueado para esse endereço. */
export const MAX_TENTATIVAS = 5;
/** Senhas erradas no e-mail, somando TODOS os endereços, até ele ficar bloqueado para todo mundo. */
export const MAX_TENTATIVAS_NO_TOTAL = 50;
export const JANELA_MS = 15 * 60 * 1000;
/** Quantos registros cabem na memória. Acima disso saem os mais antigos, nunca todos de uma vez. */
const MAX_REGISTROS = 20_000;

type Registro = { quantidade: number; desde: number };

/**
 * Trava de força bruta no login, em duas camadas:
 *
 * 1. Por e-mail + endereço de rede: 5 senhas erradas bloqueiam aquele endereço para aquele e-mail por 15 min.
 *    Assim, quem erra de propósito só tranca a si mesmo; o dono da conta, entrando de outro lugar, continua
 *    conseguindo. (Antes o bloqueio era só por e-mail: bastava saber o e-mail de alguém para impedi-lo de entrar.)
 * 2. Por e-mail, somando todos os endereços: 50 erradas em 15 min bloqueiam o e-mail para todos. É o teto contra
 *    um ataque espalhado por muitos endereços; custa 10 vezes mais para ser usado só para atrapalhar.
 *
 * Complementa o limite de pedidos por endereço de rede (5 logins por minuto).
 */
@Injectable()
export class BloqueioService {
  private readonly falhas = new Map<string, Registro>();

  private restante(chave: string, limite: number, agora: number): number {
    const registro = this.falhas.get(chave);
    if (!registro) return 0;
    if (agora - registro.desde >= JANELA_MS) {
      this.falhas.delete(chave);
      return 0;
    }
    return registro.quantidade >= limite ? registro.desde + JANELA_MS - agora : 0;
  }

  /** Quantos ms faltam para liberar; 0 se não está bloqueado. `origem` é o endereço de rede de quem tenta. */
  bloqueadoPor(email: string, agora = Date.now(), origem = ''): number {
    return Math.max(this.restante(`${email}|${origem}`, MAX_TENTATIVAS, agora), this.restante(`${email}|*`, MAX_TENTATIVAS_NO_TOTAL, agora));
  }

  private somar(chave: string, agora: number): void {
    const registro = this.falhas.get(chave);
    if (registro && agora - registro.desde < JANELA_MS) {
      registro.quantidade += 1;
      return;
    }
    // Memória cheia (alguém tentando milhões de e-mails): saem os registros mais antigos. Limpar tudo de uma vez
    // apagaria também os bloqueios em vigor, e isso seria um jeito de derrubar a trava.
    if (this.falhas.size >= MAX_REGISTROS) {
      let sobra = Math.ceil(MAX_REGISTROS / 10);
      for (const antiga of this.falhas.keys()) {
        this.falhas.delete(antiga);
        if (--sobra <= 0) break;
      }
    }
    this.falhas.delete(chave);
    this.falhas.set(chave, { quantidade: 1, desde: agora });
  }

  registrarFalha(email: string, agora = Date.now(), origem = ''): void {
    this.somar(`${email}|${origem}`, agora);
    this.somar(`${email}|*`, agora);
  }

  /** Senha certa: aquele endereço volta a zero. O total do e-mail fica: quem ataca de fora não ganha tentativas novas. */
  limpar(email: string, origem = ''): void {
    this.falhas.delete(`${email}|${origem}`);
  }
}
