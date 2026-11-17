import { Global, Module } from '@nestjs/common';
import { DemonstracaoService } from './demonstracao.service.js';

@Global()
@Module({ providers: [DemonstracaoService], exports: [DemonstracaoService] })
export class DemonstracaoModule {}
