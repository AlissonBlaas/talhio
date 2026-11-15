import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq, lte } from 'drizzle-orm';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { sessoes } from '../banco/schema.js';

const resumo = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Tokens de renovação válidos. O banco guarda só o resumo (SHA-256): mesmo que a tabela vaze,
 * o token em si não está lá.
 */
@Injectable()
export class SessoesRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  async criar(usuarioId: string, duracaoMs: number, agora = Date.now()): Promise<string> {
    await this.db.delete(sessoes).where(lte(sessoes.expiraEm, new Date(agora)));
    const token = randomBytes(48).toString('base64url');
    await this.db.insert(sessoes).values({ tokenHash: resumo(token), usuarioId, expiraEm: new Date(agora + duracaoMs) });
    return token;
  }

  /**
   * Consome o token (uso único). Devolve o dono, ou null se não existe ou venceu.
   * Apaga e lê num comando só: duas renovações simultâneas com o mesmo token, só uma passa.
   */
  async consumir(token: string, agora = Date.now()): Promise<string | null> {
    const [sessao] = await this.db.delete(sessoes).where(eq(sessoes.tokenHash, resumo(token))).returning();
    return sessao && sessao.expiraEm.getTime() > agora ? sessao.usuarioId : null;
  }

  async revogar(token: string): Promise<void> {
    await this.db.delete(sessoes).where(eq(sessoes.tokenHash, resumo(token)));
  }
}
