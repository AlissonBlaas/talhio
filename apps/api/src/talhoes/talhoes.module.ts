import { Module } from '@nestjs/common';
import { TalhoesController } from './talhoes.controller.js';
import { TalhoesRepository } from './talhoes.repository.js';
import { TalhoesService } from './talhoes.service.js';

@Module({
  controllers: [TalhoesController],
  providers: [TalhoesService, TalhoesRepository],
  exports: [TalhoesService],
})
export class TalhoesModule {}
