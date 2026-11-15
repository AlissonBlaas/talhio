import { Module } from '@nestjs/common';
import { EscalaRepository } from '../escala/escala.repository.js';
import { TalhoesModule } from '../talhoes/talhoes.module.js';
import { MaquinasController } from './maquinas.controller.js';
import { MaquinasService } from './maquinas.service.js';

@Module({
  imports: [TalhoesModule],
  controllers: [MaquinasController],
  // O repositório da escala entra aqui (e não o módulo da escala) para a máquina saber quem foi escalado sem dependência circular.
  providers: [MaquinasService, EscalaRepository],
  exports: [MaquinasService],
})
export class MaquinasModule {}
