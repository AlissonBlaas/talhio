import { Module } from '@nestjs/common';
import { CONFIG, type Config } from '../core/config.js';
import { EscalaModule } from '../escala/escala.module.js';
import { MaquinasModule } from '../maquinas/maquinas.module.js';
import { PainelModule } from '../painel/painel.module.js';
import { RelatoriosModule } from '../relatorios/relatorios.module.js';
import { TalhoesModule } from '../talhoes/talhoes.module.js';
import { AssistenteController } from './assistente.controller.js';
import { AssistenteService } from './assistente.service.js';
import { ConversasRepository } from './conversas.repository.js';
import { IaAnthropic, IaDesligada, MODELO_IA, type ModeloIa } from './modelo-ia.js';

@Module({
  imports: [PainelModule, MaquinasModule, TalhoesModule, RelatoriosModule, EscalaModule],
  exports: [AssistenteService],
  controllers: [AssistenteController],
  providers: [
    AssistenteService,
    ConversasRepository,
    { provide: MODELO_IA, inject: [CONFIG], useFactory: (config: Config): ModeloIa => (config.iaChave ? new IaAnthropic(config.iaChave, config.iaModelo) : new IaDesligada()) },
  ],
})
export class AssistenteModule {}
