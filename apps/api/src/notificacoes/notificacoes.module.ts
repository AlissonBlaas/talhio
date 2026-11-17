import { Module } from '@nestjs/common';
import { IaModule } from '../assistente/ia.module.js';
import { MaquinasModule } from '../maquinas/maquinas.module.js';
import { DispositivosRepository } from './dispositivos.repository.js';
import { ExpoPushService, HTTP_EXPO } from './expo-push.service.js';
import { MotorDeAlertasService } from './motor-de-alertas.service.js';
import { NotificacoesController } from './notificacoes.controller.js';
import { NotificacoesRepository } from './notificacoes.repository.js';
import { NotificacoesService } from './notificacoes.service.js';
import { TradutorDeFalhas } from './tradutor-de-falhas.service.js';

/** Aba de notificações do app e push dos alertas das máquinas (Expo). */
@Module({
  imports: [MaquinasModule, IaModule],
  controllers: [NotificacoesController],
  providers: [DispositivosRepository, NotificacoesRepository, ExpoPushService, NotificacoesService, TradutorDeFalhas, MotorDeAlertasService, { provide: HTTP_EXPO, useValue: fetch }],
  exports: [NotificacoesService],
})
export class NotificacoesModule {}
