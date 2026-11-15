import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { Banco } from '../banco/banco.js';
import { BANCO } from '../banco/banco.module.js';
import { dispositivosPush } from '../banco/schema.js';

/** Aparelhos com push. Toda consulta filtra por fazenda (ou pelo próprio usuário). */
@Injectable()
export class DispositivosRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  /** Um token é de um usuário só: se o aparelho trocou de conta, o token passa para a conta nova. */
  async registrar(usuarioId: string, orgId: string, token: string, plataforma: 'ios' | 'android'): Promise<void> {
    const agora = new Date();
    await this.db
      .insert(dispositivosPush)
      .values({ id: randomUUID(), usuarioId, orgId, token, plataforma })
      .onConflictDoUpdate({ target: dispositivosPush.token, set: { usuarioId, orgId, plataforma, atualizadoEm: agora } });
  }

  /** Só apaga o token do próprio usuário. */
  async remover(usuarioId: string, token: string): Promise<void> {
    await this.db.delete(dispositivosPush).where(and(eq(dispositivosPush.usuarioId, usuarioId), eq(dispositivosPush.token, token)));
  }

  async tokensDaFazenda(orgId: string): Promise<string[]> {
    const linhas = await this.db.select({ token: dispositivosPush.token }).from(dispositivosPush).where(eq(dispositivosPush.orgId, orgId));
    return linhas.map((l) => l.token);
  }

  /** O Expo avisou que o aparelho não existe mais (app desinstalado): tira da lista. */
  async removerInvalidos(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.db.delete(dispositivosPush).where(inArray(dispositivosPush.token, tokens));
  }
}
