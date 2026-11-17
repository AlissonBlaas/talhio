import { Module } from '@nestjs/common';
import { CONFIG, type Config } from '../core/config.js';
import { IaAnthropic, IaDesligada, MODELO_IA, type ModeloIa } from './modelo-ia.js';

/** O modelo de IA do servidor, para quem precisa dele (o assistente e a tradução das falhas das máquinas). Sem chave, fica desligado. */
@Module({
  providers: [{ provide: MODELO_IA, inject: [CONFIG], useFactory: (config: Config): ModeloIa => (config.iaChave ? new IaAnthropic(config.iaChave, config.iaModelo) : new IaDesligada()) }],
  exports: [MODELO_IA],
})
export class IaModule {}
