import { Inject, Injectable } from '@nestjs/common';
import type { Linha } from '@talhio/shared';
import { asc, eq } from 'drizzle-orm';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { linhas } from '../banco/schema.js';

/** Linhas AB criadas no app. Sempre filtradas pela organização. */
@Injectable()
export class LinhasRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  async listar(orgId: string): Promise<Linha[]> {
    const guardadas = await this.db.select().from(linhas).where(eq(linhas.orgId, orgId)).orderBy(asc(linhas.criadoEm));
    return guardadas.map((l) => ({
      id: l.id,
      nome: l.nome,
      talhaoId: l.talhaoId,
      a: l.a,
      b: l.b,
      direcaoGraus: l.direcaoGraus,
      padraoDaFazenda: l.padraoDaFazenda,
      tipo: 'reta' as const,
      passadas: null,
    }));
  }

  async salvar(orgId: string, linha: Linha): Promise<void> {
    await this.db.insert(linhas).values({ id: linha.id, orgId, talhaoId: linha.talhaoId, nome: linha.nome, a: linha.a, b: linha.b, direcaoGraus: linha.direcaoGraus, padraoDaFazenda: linha.padraoDaFazenda });
  }
}
