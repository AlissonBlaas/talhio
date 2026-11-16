import { Module } from '@nestjs/common';
import { MaquinasModule } from '../maquinas/maquinas.module.js';
import { TalhoesModule } from '../talhoes/talhoes.module.js';
import { EscalaController } from './escala.controller.js';
import { EscalaRepository } from './escala.repository.js';
import { EscalaService } from './escala.service.js';

@Module({
  imports: [MaquinasModule, TalhoesModule],
  controllers: [EscalaController],
  providers: [EscalaService, EscalaRepository],
  // A IA lê a escala de hoje.
  exports: [EscalaService],
})
export class EscalaModule {}
