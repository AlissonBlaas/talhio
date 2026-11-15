import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Banco } from '../banco/banco.js';
import { BANCO } from '../banco/banco.module.js';
import { conexoesWhatsapp } from '../banco/schema.js';

export type ConexaoWhatsappGuardada = typeof conexoesWhatsapp.$inferSelect;

/** Só o estado da conexão (uma linha pequena por fazenda). Credenciais e chaves vivem no Redis (`ArmazemWhatsapp`). */
@Injectable()
export class WhatsappRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  async buscar(orgId: string): Promise<ConexaoWhatsappGuardada | null> {
    const [c] = await this.db.select().from(conexoesWhatsapp).where(eq(conexoesWhatsapp.orgId, orgId)).limit(1);
    return c ?? null;
  }

  /** Fazendas que já foram conectadas: voltam sozinhas quando a API sobe. */
  async pareadas(): Promise<string[]> {
    const linhas = await this.db.select({ orgId: conexoesWhatsapp.orgId }).from(conexoesWhatsapp).where(eq(conexoesWhatsapp.pareado, true));
    return linhas.map((l) => l.orgId);
  }

  async marcarConectado(orgId: string, numero: string): Promise<void> {
    const agora = new Date();
    await this.db
      .insert(conexoesWhatsapp)
      .values({ orgId, pareado: true, numero, conectadoEm: agora })
      .onConflictDoUpdate({ target: conexoesWhatsapp.orgId, set: { pareado: true, numero, conectadoEm: agora, atualizadoEm: agora } });
  }

  async escolherGrupo(orgId: string, grupo: { id: string; nome: string } | null): Promise<void> {
    const valores = { grupoId: grupo?.id ?? null, grupoNome: grupo?.nome ?? null, atualizadoEm: new Date() };
    await this.db.insert(conexoesWhatsapp).values({ orgId, ...valores }).onConflictDoUpdate({ target: conexoesWhatsapp.orgId, set: valores });
  }

  async apagar(orgId: string): Promise<void> {
    await this.db.delete(conexoesWhatsapp).where(eq(conexoesWhatsapp.orgId, orgId));
  }
}
