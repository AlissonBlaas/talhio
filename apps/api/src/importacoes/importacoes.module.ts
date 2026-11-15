import { Module } from '@nestjs/common';
import { ImportacoesController } from './importacoes.controller.js';
import { ImportacoesRepository } from './importacoes.repository.js';
import { ImportacoesService } from './importacoes.service.js';

@Module({ controllers: [ImportacoesController], providers: [ImportacoesService, ImportacoesRepository] })
export class ImportacoesModule {}
