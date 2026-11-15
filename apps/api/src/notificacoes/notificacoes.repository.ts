import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Notificacao } from '@talhio/shared';
import type { Banco } from '../banco/banco.js';
import { BANCO } from '../banco/banco.module.js';
import { notificacoes, notificacoesLidas } from '../banco/schema.js';

export type NovaNotificacao = Omit<Notificacao, 'resolvidaEm' | 'criadaEm'> & { chave: string; criadaEm?: Date };

const paraContrato = (l: typeof notificacoes.$inferSelect): Notificacao => ({
  id: l.id,
  tipo: l.tipo,
  severidade: l.severidade,
  maquinaId: l.maquinaId,
  maquinaNome: l.maquinaNome,
  titulo: l.titulo,
  texto: l.texto,
  criadaEm: l.criadaEm.toISOString(),
  resolvidaEm: l.resolvidaEm?.toISOString() ?? null,
});

/** Notificações da fazenda e o quanto cada usuário já leu. Toda consulta filtra por orgId. */
@Injectable()
export class NotificacoesRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  /** Há um episódio aberto (não resolvido) desse problema? */
  async abertas(orgId: string, tipo: Notificacao['tipo']): Promise<{ chave: string; id: string }[]> {
    return this.db
      .select({ chave: notificacoes.chave, id: notificacoes.id })
      .from(notificacoes)
      .where(and(eq(notificacoes.orgId, orgId), eq(notificacoes.tipo, tipo), isNull(notificacoes.resolvidaEm)));
  }

  /** Quando o último episódio desse problema começou (para não repetir o aviso em seguida). */
  async ultimaDaChave(orgId: string, chave: string): Promise<{ criadaEm: Date; resolvida: boolean } | null> {
    const [l] = await this.db.select({ criadaEm: notificacoes.criadaEm, resolvidaEm: notificacoes.resolvidaEm }).from(notificacoes).where(and(eq(notificacoes.orgId, orgId), eq(notificacoes.chave, chave))).orderBy(desc(notificacoes.criadaEm)).limit(1);
    return l ? { criadaEm: l.criadaEm, resolvida: l.resolvidaEm !== null } : null;
  }

  /** Cria a notificação. Devolve falso se o id já existe (o mesmo alerta da Deere visto duas vezes). */
  async criar(orgId: string, n: NovaNotificacao): Promise<boolean> {
    const r = await this.db
      .insert(notificacoes)
      .values({ id: n.id, orgId, chave: n.chave, tipo: n.tipo, severidade: n.severidade, maquinaId: n.maquinaId, maquinaNome: n.maquinaNome, titulo: n.titulo, texto: n.texto, criadaEm: n.criadaEm ?? new Date() })
      .onConflictDoNothing()
      .returning({ id: notificacoes.id });
    return r.length > 0;
  }

  async resolver(orgId: string, id: string, quando: Date = new Date()): Promise<void> {
    await this.db.update(notificacoes).set({ resolvidaEm: quando }).where(and(eq(notificacoes.orgId, orgId), eq(notificacoes.id, id), isNull(notificacoes.resolvidaEm)));
  }

  async listar(orgId: string, limite: number): Promise<Notificacao[]> {
    const linhas = await this.db.select().from(notificacoes).where(eq(notificacoes.orgId, orgId)).orderBy(desc(notificacoes.criadaEm)).limit(limite);
    return linhas.map(paraContrato);
  }

  /** Quantas chegaram depois da última leitura do usuário (sem leitura registrada, as dos últimos 7 dias). */
  async naoLidas(orgId: string, usuarioId: string, agora: Date = new Date()): Promise<number> {
    const [lida] = await this.db.select({ lidoAte: notificacoesLidas.lidoAte }).from(notificacoesLidas).where(eq(notificacoesLidas.usuarioId, usuarioId)).limit(1);
    const desde = lida?.lidoAte ?? new Date(agora.getTime() - 7 * 86_400_000);
    const [r] = await this.db.select({ n: sql<number>`count(*)::int` }).from(notificacoes).where(and(eq(notificacoes.orgId, orgId), gt(notificacoes.criadaEm, desde)));
    return r?.n ?? 0;
  }

  async marcarLidas(usuarioId: string, agora: Date = new Date()): Promise<void> {
    await this.db.insert(notificacoesLidas).values({ usuarioId, lidoAte: agora }).onConflictDoUpdate({ target: notificacoesLidas.usuarioId, set: { lidoAte: agora } });
  }
}
