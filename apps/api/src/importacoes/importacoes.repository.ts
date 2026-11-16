import { Inject, Injectable } from '@nestjs/common';
import type { FazendaImportada } from '@talhio/deere';
import { asc, eq } from 'drizzle-orm';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { fazendasImportadas } from '../banco/schema.js';

/** Fazendas importadas por arquivo, uma por organização. */
@Injectable()
export class ImportacoesRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  /** Guarda a fazenda da organização, no lugar da que havia. */
  async salvar(orgId: string, dados: FazendaImportada, quando = new Date()): Promise<void> {
    await this.db
      .insert(fazendasImportadas)
      .values({ orgId, dados, importadaEm: quando })
      .onConflictDoUpdate({ target: fazendasImportadas.orgId, set: { dados, importadaEm: quando } });
  }

  /** A fazenda importada desta organização, se houver. */
  async buscar(orgId: string): Promise<FazendaImportada | null> {
    const [linha] = await this.db.select({ dados: fazendasImportadas.dados }).from(fazendasImportadas).where(eq(fazendasImportadas.orgId, orgId)).limit(1);
    return linha?.dados ?? null;
  }

  /**
   * Todas as fazendas guardadas, da importação mais antiga para a mais recente. Só para repor o
   * provedor na subida da API: é a única consulta que não filtra por organização, e devolve cada
   * fazenda junto com a organização dona dela.
   */
  todas(): Promise<{ orgId: string; dados: FazendaImportada }[]> {
    return this.db.select({ orgId: fazendasImportadas.orgId, dados: fazendasImportadas.dados }).from(fazendasImportadas).orderBy(asc(fazendasImportadas.importadaEm));
  }
}
