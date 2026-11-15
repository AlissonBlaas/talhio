import { Module } from '@nestjs/common';
import { MaquinasModule } from '../maquinas/maquinas.module.js';
import { TalhoesModule } from '../talhoes/talhoes.module.js';
import { PainelController } from './painel.controller.js';
import { PainelService } from './painel.service.js';

@Module({
  imports: [MaquinasModule, TalhoesModule],
  controllers: [PainelController],
  providers: [PainelService], exports: [PainelService],
})
export class PainelModule {}
