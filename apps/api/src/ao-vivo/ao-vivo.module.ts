import { Module } from '@nestjs/common';
import { AssistenteModule } from '../assistente/assistente.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MaquinasModule } from '../maquinas/maquinas.module.js';
import { AoVivoGateway } from './ao-vivo.gateway.js';

@Module({ imports: [AuthModule, MaquinasModule, AssistenteModule], providers: [AoVivoGateway] })
export class AoVivoModule {}
