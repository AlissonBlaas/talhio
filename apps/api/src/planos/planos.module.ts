import { Module } from '@nestjs/common';
import { EscalaRepository } from '../escala/escala.repository.js';
import { MaquinasModule } from '../maquinas/maquinas.module.js';
import { TalhoesModule } from '../talhoes/talhoes.module.js';
import { PlanosController } from './planos.controller.js';
import { PlanosRepository } from './planos.repository.js';
import { PlanosService } from './planos.service.js';

@Module({
  imports: [MaquinasModule, TalhoesModule],
  controllers: [PlanosController],
  providers: [PlanosService, PlanosRepository, EscalaRepository],
})
export class PlanosModule {}
