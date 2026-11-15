import { Module } from '@nestjs/common';
import { TalhoesModule } from '../talhoes/talhoes.module.js';
import { LinhasController } from './linhas.controller.js';
import { LinhasRepository } from './linhas.repository.js';
import { LinhasService } from './linhas.service.js';

@Module({
  imports: [TalhoesModule],
  controllers: [LinhasController],
  providers: [LinhasService, LinhasRepository],
  exports: [LinhasService],
})
export class LinhasModule {}
