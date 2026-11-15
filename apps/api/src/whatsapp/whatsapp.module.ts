import { Module } from '@nestjs/common';
import { CONFIG, type Config } from '../core/config.js';
import { ARMAZEM_WHATSAPP, ArmazemMemoria, ArmazemRedis } from './armazem-whatsapp.js';
import { BaileysWhatsapp } from './baileys-whatsapp.js';
import { FakeWhatsapp, WhatsappIndisponivel } from './fake-whatsapp.js';
import { WhatsappController } from './whatsapp.controller.js';
import type { ArmazemWhatsapp } from './armazem-whatsapp.js';
import { WhatsappRepository } from './whatsapp.repository.js';
import { WhatsappService } from './whatsapp.service.js';
import { PROVEDOR_WHATSAPP } from './whatsapp.tokens.js';

/**
 * Único lugar que escolhe como o WhatsApp funciona. "baileys" conecta de verdade (WHATSAPP_PROVEDOR=baileys);
 * em desenvolvimento, "fake" simula o pareamento sem falar com o WhatsApp.
 */
@Module({
  controllers: [WhatsappController],
  providers: [
    WhatsappRepository,
    WhatsappService,
    // Credenciais e chaves de sessão: Redis quando REDIS_URL existe; sem ele (dev), memória.
    { provide: ARMAZEM_WHATSAPP, inject: [CONFIG], useFactory: (config: Config) => (config.redisUrl ? ArmazemRedis.daUrl(config.redisUrl) : new ArmazemMemoria()) },
    {
      provide: PROVEDOR_WHATSAPP,
      inject: [CONFIG, WhatsappRepository, ARMAZEM_WHATSAPP],
      useFactory: (config: Config, repo: WhatsappRepository, armazem: ArmazemWhatsapp) =>
        config.whatsappProvedor === 'baileys'
          ? new BaileysWhatsapp(config, repo, armazem)
          : process.env.NODE_ENV === 'test'
            ? new WhatsappIndisponivel()
            : new FakeWhatsapp(4_000),
    },
  ],
  exports: [WhatsappService],
})
export class WhatsappModule {}
