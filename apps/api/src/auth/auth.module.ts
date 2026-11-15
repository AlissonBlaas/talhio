import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { BloqueioService } from './bloqueio.service.js';
import { SessoesRepository } from './sessoes.repository.js';
import { TokenService } from './token.service.js';
import { UsuariosRepository } from './usuarios.repository.js';

/**
 * Login e as duas guardas globais, nesta ordem:
 * 1. limite de requisições por endereço de rede (vale para tudo, inclusive rotas abertas);
 * 2. exigência de token de acesso (tudo, exceto @Publico()).
 */
@Module({
  imports: [
    ThrottlerModule.forRoot({
      // Folgado para o uso normal (o app consulta a cada 30 s) e para várias pessoas na mesma rede da fazenda.
      throttlers: [{ name: 'default', ttl: 60_000, limit: 600 }],
      errorMessage: 'Muitas requisições. Aguarde um minuto e tente de novo.',
    }),
  ],
  exports: [TokenService],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    UsuariosRepository,
    SessoesRepository,
    BloqueioService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
