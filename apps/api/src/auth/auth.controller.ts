import { Body, Controller, Get, HttpCode, Inject, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CadastrarSchema, EntrarSchema, RenovarSchema, type Renovar, type Sessao, type Usuario } from '@talhio/shared';
import type { z } from 'zod';
import { ZodPipe } from '../shared/zod.pipe.js';
import { Publico, UsuarioAtual } from './auth.decorators.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /** Limite apertado por endereço de rede: 5 tentativas por minuto (além da trava por e-mail). */
  @Publico()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('entrar')
  @HttpCode(200)
  entrar(@Body(new ZodPipe(EntrarSchema)) dados: z.output<typeof EntrarSchema>, @Ip() origem: string): Promise<Sessao> {
    return this.auth.entrar(dados.email, dados.senha, origem);
  }

  /** Quem chega pela primeira vez: cria a conta e a fazenda. */
  @Publico()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('cadastrar')
  cadastrar(@Body(new ZodPipe(CadastrarSchema)) dados: z.output<typeof CadastrarSchema>): Promise<Sessao> {
    return this.auth.cadastrar(dados);
  }

  @Publico()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('renovar')
  @HttpCode(200)
  renovar(@Body(new ZodPipe(RenovarSchema)) dados: Renovar): Promise<Sessao> {
    return this.auth.renovar(dados.tokenRenovacao);
  }

  /** Aberta de propósito: sair precisa funcionar mesmo com o token de acesso já vencido. */
  @Publico()
  @Post('sair')
  @HttpCode(204)
  sair(@Body(new ZodPipe(RenovarSchema)) dados: Renovar): Promise<void> {
    return this.auth.sair(dados.tokenRenovacao);
  }

  @Get('eu')
  eu(@UsuarioAtual() usuarioId: string): Promise<Usuario> {
    return this.auth.eu(usuarioId);
  }
}
