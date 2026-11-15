import { randomUUID } from 'node:crypto';

import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import type { Usuario } from '@talhio/shared';
import { eq } from 'drizzle-orm';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { organizacoes, usuarios } from '../banco/schema.js';
import { CONFIG, type Config } from '../core/config.js';
import { gerarHash } from './senha.js';

export interface UsuarioGuardado extends Usuario {
  senhaHash: string;
}

const ID_ADMIN = 'u-admin';

@Injectable()
export class UsuariosRepository implements OnModuleInit {
  /** Hash de uma senha qualquer: usado para gastar o mesmo tempo quando o e-mail não existe. */
  hashDeIsca = '';

  constructor(
    @Inject(BANCO) private readonly db: Banco,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /**
   * Garante a organização e o administrador definidos na configuração (ADMIN_EMAIL / ADMIN_SENHA).
   * A senha do .env vale a cada subida: é o jeito de recuperar o acesso enquanto não há "esqueci a senha".
   */
  async onModuleInit(): Promise<void> {
    const { adminEmail, adminSenha, adminNome, orgId } = this.config;
    const senhaHash = await gerarHash(adminSenha);
    await this.db.insert(organizacoes).values({ id: orgId, nome: 'Minha fazenda' }).onConflictDoNothing();
    await this.db
      .insert(usuarios)
      .values({ id: ID_ADMIN, orgId, nome: adminNome, email: adminEmail, senhaHash, papel: 'admin' })
      .onConflictDoUpdate({ target: usuarios.id, set: { orgId, nome: adminNome, email: adminEmail, senhaHash, papel: 'admin' } });
    this.hashDeIsca = await gerarHash('senha-que-ninguem-usa');
  }

  async buscarPorEmail(email: string): Promise<UsuarioGuardado | null> {
    const [usuario] = await this.db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
    return usuario ?? null;
  }

  async buscarPorId(id: string): Promise<UsuarioGuardado | null> {
    const [usuario] = await this.db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1);
    return usuario ?? null;
  }

  /** Cria a fazenda e o primeiro usuário (administrador) numa transação só. Falso se o e-mail já existe. */
  async criarContaNova(dados: { nome: string; fazenda: string; email: string; senhaHash: string }): Promise<UsuarioGuardado | null> {
    const orgId = `org-${randomUUID()}`;
    const usuario: UsuarioGuardado = { id: `u-${randomUUID()}`, orgId, nome: dados.nome, email: dados.email, senhaHash: dados.senhaHash, papel: 'admin' };
    try {
      await this.db.transaction(async (tx) => {
        await tx.insert(organizacoes).values({ id: orgId, nome: dados.fazenda });
        await tx.insert(usuarios).values(usuario);
      });
      return usuario;
    } catch (erro) {
      // E-mail repetido (a restrição unique do banco decide, mesmo com dois cadastros ao mesmo tempo).
      if (await this.buscarPorEmail(dados.email)) return null;
      throw erro;
    }
  }
}
