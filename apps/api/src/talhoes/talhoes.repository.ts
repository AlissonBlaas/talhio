import { Inject, Injectable } from '@nestjs/common';
import type { Talhao } from '@talhio/shared';
import { asc, eq } from 'drizzle-orm';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { talhoes } from '../banco/schema.js';

/** Talhões criados no app. Sempre filtrados pela organização. */
@Injectable()
export class TalhoesRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  async listar(orgId: string): Promise<Talhao[]> {
    const linhas = await this.db.select().from(talhoes).where(eq(talhoes.orgId, orgId)).orderBy(asc(talhoes.criadoEm));
    // Operação e andamento vêm da telemetria; talhão criado no app ainda não tem.
    return linhas.map((t) => ({ id: t.id, nome: t.nome, cultura: t.cultura, areaHa: t.areaHa, contorno: t.contorno, operacao: null, percentualFeito: null }));
  }

  async salvar(orgId: string, talhao: Talhao): Promise<void> {
    await this.db.insert(talhoes).values({ id: talhao.id, orgId, nome: talhao.nome, cultura: talhao.cultura, areaHa: talhao.areaHa, contorno: talhao.contorno });
  }
}
