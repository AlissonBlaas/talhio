import { Global, Module } from '@nestjs/common';
import { CONFIG, carregarConfig } from './config.js';

/** Setup único da aplicação. Importado só no AppModule. */
@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => carregarConfig() }],
  exports: [CONFIG],
})
export class CoreModule {}
