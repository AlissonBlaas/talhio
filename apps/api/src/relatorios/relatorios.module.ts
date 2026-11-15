import { Module } from '@nestjs/common';
import { MaquinasModule } from '../maquinas/maquinas.module.js';
import { PlanosRepository } from '../planos/planos.repository.js';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { RelatoriosEnvioService } from './relatorios-envio.service.js';
import { RelatoriosController } from './relatorios.controller.js';
import { RelatoriosService } from './relatorios.service.js';

@Module({ imports: [MaquinasModule, WhatsappModule], controllers: [RelatoriosController], providers: [RelatoriosService, RelatoriosEnvioService, PlanosRepository], exports: [RelatoriosService] })
export class RelatoriosModule {}
