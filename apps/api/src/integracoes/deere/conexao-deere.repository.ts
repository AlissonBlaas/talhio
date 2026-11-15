import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Banco } from '../../banco/banco.js';
import { BANCO } from '../../banco/banco.module.js';
import { conexoesDeere } from '../../banco/schema.js';

export type ConexaoGuardada = typeof conexoesDeere.$inferSelect;
export type NovosTokens = Pick<ConexaoGuardada, 'acessoCifrado' | 'renovacaoCifrada' | 'expiraEm' | 'escopos'>;

/** Toda consulta filtra por orgId: uma fazenda nunca vê os tokens de outra. */
@Injectable()
export class ConexaoDeereRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  async buscar(orgId: string): Promise<ConexaoGuardada | null> {
    const [c] = await this.db.select().from(conexoesDeere).where(eq(conexoesDeere.orgId, orgId)).limit(1);
    return c ?? null;
  }

  /** Autorizou de novo: troca os tokens e mantém a organização já escolhida. */
  async guardarTokens(orgId: string, tokens: NovosTokens): Promise<void> {
    const agora = new Date();
    await this.db
      .insert(conexoesDeere)
      .values({ orgId, ...tokens })
      .onConflictDoUpdate({ target: conexoesDeere.orgId, set: { ...tokens, atualizadoEm: agora } });
  }

  async escolherOrganizacao(orgId: string, deereOrgId: string, deereOrgNome: string, extras: string[], precisaLiberar: boolean): Promise<void> {
    await this.db.update(conexoesDeere).set({ deereOrgId, deereOrgNome, deereOrgExtras: extras.join(','), precisaLiberar, atualizadoEm: new Date() }).where(eq(conexoesDeere.orgId, orgId));
  }

  async marcarLiberada(orgId: string): Promise<void> {
    await this.db.update(conexoesDeere).set({ precisaLiberar: false, atualizadoEm: new Date() }).where(eq(conexoesDeere.orgId, orgId));
  }

  async apagar(orgId: string): Promise<void> {
    await this.db.delete(conexoesDeere).where(eq(conexoesDeere.orgId, orgId));
  }
}
