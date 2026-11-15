import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Banco } from '../../banco/banco.js';
import { BANCO } from '../../banco/banco.module.js';
import { largurasDeImplemento } from '../../banco/schema.js';

/** Largura do implemento de cada máquina, informada pelo administrador. Toda consulta filtra por orgId. */
@Injectable()
export class LarguraImplementoRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  /** Lida a cada conta de hectares: fica 30 s na memória; gravar joga fora. */
  private readonly guardadas = new Map<string, { ate: number; dados: Promise<Map<string, number>> }>();

  todas(orgId: string): Promise<Map<string, number>> {
    const guardado = this.guardadas.get(orgId);
    if (guardado && guardado.ate > Date.now()) return guardado.dados;
    const dados = this.db
      .select()
      .from(largurasDeImplemento)
      .where(eq(largurasDeImplemento.orgId, orgId))
      .then((linhas) => new Map(linhas.map((l) => [l.maquinaId, l.larguraM])))
      .catch((e) => {
        this.guardadas.delete(orgId);
        throw e;
      });
    this.guardadas.set(orgId, { ate: Date.now() + 30_000, dados });
    return dados;
  }

  /** `larguraM` nula apaga: a máquina volta a usar a largura das linhas do talhão. */
  async definir(orgId: string, maquinaId: string, larguraM: number | null): Promise<void> {
    if (larguraM === null) {
      await this.db.delete(largurasDeImplemento).where(and(eq(largurasDeImplemento.orgId, orgId), eq(largurasDeImplemento.maquinaId, maquinaId)));
    } else {
      await this.db
        .insert(largurasDeImplemento)
        .values({ orgId, maquinaId, larguraM })
        .onConflictDoUpdate({ target: [largurasDeImplemento.orgId, largurasDeImplemento.maquinaId], set: { larguraM, atualizadoEm: new Date() } });
    }
    this.guardadas.delete(orgId);
  }
}
