import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { BANCO } from '../banco/banco.module.js';
import type { Banco } from '../banco/banco.js';
import { usuarios } from '../banco/schema.js';
import { CONFIG, type Config } from '../core/config.js';

/**
 * Qual fazenda é a de demonstração (a conta que o revisor da Apple usa para ver o app funcionando sem John Deere).
 * Definida por `DEMO_EMAIL`: a fazenda dessa conta lê dados de exemplo e nada sai dela (WhatsApp, John Deere).
 * Sem `DEMO_EMAIL`, nenhuma fazenda é de demonstração.
 */
@Injectable()
export class DemonstracaoService implements OnModuleInit {
  private readonly log = new Logger('Demonstracao');
  private org: string | null = null;

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(BANCO) private readonly db: Banco,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.demoEmail;
    if (!email) return;
    const [conta] = await this.db.select({ orgId: usuarios.orgId }).from(usuarios).where(eq(usuarios.email, email)).limit(1);
    if (!conta) return void this.log.warn(`DEMO_EMAIL definido, mas não há conta com esse e-mail: nenhuma fazenda é de demonstração (crie a conta e reinicie a API)`);
    // A fazenda do administrador do servidor nunca pode virar demonstração por engano.
    if (conta.orgId === this.config.orgId) return void this.log.error('DEMO_EMAIL é da fazenda do administrador do servidor: ignorado');
    this.org = conta.orgId;
    this.log.log(`fazenda de demonstração: ${conta.orgId}`);
  }

  /** Esta fazenda é a de demonstração? */
  ehDemo(orgId: string): boolean {
    return this.org !== null && orgId === this.org;
  }
}
