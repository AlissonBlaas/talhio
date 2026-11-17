import { Module } from '@nestjs/common';
import { EscalaModule } from '../escala/escala.module.js';
import { MaquinasModule } from '../maquinas/maquinas.module.js';
import { PainelModule } from '../painel/painel.module.js';
import { RelatoriosModule } from '../relatorios/relatorios.module.js';
import { TalhoesModule } from '../talhoes/talhoes.module.js';
import { AssistenteController } from './assistente.controller.js';
import { AssistenteService } from './assistente.service.js';
import { ConversasRepository } from './conversas.repository.js';
import { IaModule } from './ia.module.js';

@Module({
  imports: [IaModule, PainelModule, MaquinasModule, TalhoesModule, RelatoriosModule, EscalaModule],
  exports: [AssistenteService],
  controllers: [AssistenteController],
  providers: [
    AssistenteService,
    ConversasRepository,
  ],
})
export class AssistenteModule {}
