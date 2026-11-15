import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { CONFIG, type Config } from '../core/config.js';
import { abrirBanco, type Banco, type BancoAberto } from './banco.js';

/** Token do banco: `@Inject(BANCO) private readonly db: Banco`. Só repositories injetam isto. */
export const BANCO = Symbol('BANCO');
const BANCO_ABERTO = Symbol('BANCO_ABERTO');

@Global()
@Module({
  providers: [
    { provide: BANCO_ABERTO, inject: [CONFIG], useFactory: (config: Config): Promise<BancoAberto> => abrirBanco({ url: config.bancoUrl, pasta: config.bancoPasta }) },
    { provide: BANCO, inject: [BANCO_ABERTO], useFactory: (aberto: BancoAberto): Banco => aberto.db },
  ],
  exports: [BANCO],
})
export class BancoModule implements OnApplicationShutdown {
  constructor(@Inject(BANCO_ABERTO) private readonly aberto: BancoAberto) {}

  async onApplicationShutdown(): Promise<void> {
    await this.aberto.fechar();
  }
}
