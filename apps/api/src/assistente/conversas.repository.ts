import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Atalho, Conversa, ConversaResumo, Mensagem, PaginaDeConversas } from '@talhio/shared';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { conversas, mensagens } from '../banco/schema.js';

/** De quem é a conversa. Toda consulta filtra pelos dois: organização e usuário. */
export interface Dono {
  orgId: string;
  usuarioId: string;
}

export const CONVERSAS_POR_PAGINA = 20;
const TAMANHO_DO_TITULO = 60;

const doDono = (dono: Dono) => and(eq(conversas.orgId, dono.orgId), eq(conversas.usuarioId, dono.usuarioId));
const resumo = (c: typeof conversas.$inferSelect): ConversaResumo => ({ id: c.id, titulo: c.titulo, atualizadaEm: c.atualizadoEm.toISOString() });

@Injectable()
export class ConversasRepository {
  constructor(@Inject(BANCO) private readonly db: Banco) {}

  /** Uma página das conversas do usuário, da mais recente para a mais antiga. */
  async listar(dono: Dono, pular = 0): Promise<PaginaDeConversas> {
    // Pede uma a mais só para saber se existe próxima página.
    const lista = await this.db.select().from(conversas).where(doDono(dono)).orderBy(desc(conversas.atualizadoEm), desc(conversas.id)).limit(CONVERSAS_POR_PAGINA + 1).offset(pular);
    const temMais = lista.length > CONVERSAS_POR_PAGINA;
    return { conversas: lista.slice(0, CONVERSAS_POR_PAGINA).map(resumo), proximo: temMais ? pular + CONVERSAS_POR_PAGINA : null };
  }

  /**
   * Um trecho da conversa: as `limite` mensagens mais recentes (ou as anteriores à de número
   * `antes`), em ordem. Null se a conversa não existe ou é de outra pessoa.
   * Nunca carrega a conversa inteira: uma conversa longa não pesa no servidor nem no app.
   */
  async buscar(dono: Dono, id: string, trecho: { limite: number; antes?: number }): Promise<Conversa | null> {
    const [conversa] = await this.db.select().from(conversas).where(and(eq(conversas.id, id), doDono(dono))).limit(1);
    if (!conversa) return null;
    const daConversa = eq(mensagens.conversaId, id);
    const lista = await this.db
      .select({ papel: mensagens.papel, texto: mensagens.texto, atalhos: mensagens.atalhos, ordem: mensagens.ordem })
      .from(mensagens)
      .where(trecho.antes === undefined ? daConversa : and(daConversa, lt(mensagens.ordem, trecho.antes)))
      .orderBy(desc(mensagens.ordem))
      .limit(trecho.limite);
    lista.reverse();
    return { ...resumo(conversa), mensagens: lista.map((m): Mensagem => ({ papel: m.papel, texto: m.texto, ...(m.atalhos?.length ? { atalhos: m.atalhos } : {}) })), primeiraOrdem: lista[0]?.ordem ?? trecho.antes ?? 0 };
  }

  /**
   * Grava a pergunta e a resposta juntas (ou nenhuma das duas), criando a conversa se for a primeira.
   * Devolve o id da conversa.
   */
  async guardarTroca(dono: Dono, conversaId: string | null, pergunta: string, resposta: string, atalhos: Atalho[] = []): Promise<string> {
    return this.db.transaction(async (tx) => {
      let id = conversaId;
      let ordem = 0;
      if (id) {
        const [{ total } = { total: 0 }] = await tx.select({ total: sql<number>`count(*)::int` }).from(mensagens).where(eq(mensagens.conversaId, id));
        ordem = total;
        await tx.update(conversas).set({ atualizadoEm: new Date() }).where(eq(conversas.id, id));
      } else {
        id = `c-${randomUUID()}`;
        const titulo = pergunta.length > TAMANHO_DO_TITULO ? `${pergunta.slice(0, TAMANHO_DO_TITULO - 1).trimEnd()}…` : pergunta;
        await tx.insert(conversas).values({ id, orgId: dono.orgId, usuarioId: dono.usuarioId, titulo });
      }
      await tx.insert(mensagens).values([
        { id: `m-${randomUUID()}`, conversaId: id, papel: 'usuario', texto: pergunta, ordem },
        { id: `m-${randomUUID()}`, conversaId: id, papel: 'assistente', texto: resposta, atalhos: atalhos.length > 0 ? atalhos : null, ordem: ordem + 1 },
      ]);
      return id;
    });
  }

  /** Apaga a conversa e as mensagens dela. Devolve false se não existe ou é de outra pessoa. */
  async apagar(dono: Dono, id: string): Promise<boolean> {
    const apagadas = await this.db.delete(conversas).where(and(eq(conversas.id, id), doDono(dono))).returning({ id: conversas.id });
    return apagadas.length > 0;
  }
}
