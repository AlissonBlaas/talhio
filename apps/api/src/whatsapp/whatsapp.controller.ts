import { Body, Controller, Delete, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EscolherGrupoSchema, MensagemAoGrupoSchema, PedirCodigoSchema, type CodigoWhatsapp, type EnvioAoGrupo, type EstadoWhatsapp, type ListaGruposWhatsapp } from '@talhio/shared';
import type { z } from 'zod';
import { OrgAtual, SoAdmin } from '../auth/auth.decorators.js';
import { ZodPipe } from '../shared/zod.pipe.js';
import { WhatsappService } from './whatsapp.service.js';

@Controller('whatsapp')
export class WhatsappController {
  constructor(@Inject(WhatsappService) private readonly whatsapp: WhatsappService) {}

  @Get()
  estado(@OrgAtual() orgId: string): Promise<EstadoWhatsapp> {
    return this.whatsapp.estado(orgId);
  }

  /** Gera o código de 8 caracteres para digitar no WhatsApp do celular. Depois disso, acompanhe por `GET /whatsapp`. */
  @SoAdmin()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('codigo')
  @HttpCode(200)
  codigo(@OrgAtual() orgId: string, @Body(new ZodPipe(PedirCodigoSchema)) dados: z.output<typeof PedirCodigoSchema>): Promise<CodigoWhatsapp> {
    return this.whatsapp.pedirCodigo(orgId, dados.telefone);
  }

  /** Grupos do WhatsApp conectado, para escolher onde as notificações saem. */
  @SoAdmin()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('grupos')
  async grupos(@OrgAtual() orgId: string): Promise<ListaGruposWhatsapp> {
    return { grupos: await this.whatsapp.grupos(orgId) };
  }

  @SoAdmin()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('grupo')
  @HttpCode(200)
  escolherGrupo(@OrgAtual() orgId: string, @Body(new ZodPipe(EscolherGrupoSchema)) dados: z.output<typeof EscolherGrupoSchema>): Promise<EstadoWhatsapp> {
    return this.whatsapp.escolherGrupo(orgId, dados.grupoId);
  }

  @SoAdmin()
  @Delete('grupo')
  tirarGrupo(@OrgAtual() orgId: string): Promise<EstadoWhatsapp> {
    return this.whatsapp.tirarGrupo(orgId);
  }

  /** Manda ao grupo escolhido o texto que o administrador viu na tela (a escala do dia, a escala de um plano). */
  @SoAdmin()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mensagem')
  @HttpCode(200)
  mensagem(@OrgAtual() orgId: string, @Body(new ZodPipe(MensagemAoGrupoSchema)) dados: z.output<typeof MensagemAoGrupoSchema>): Promise<EnvioAoGrupo> {
    return this.whatsapp.notificarGrupo(orgId, dados.texto);
  }

  /** Mensagem de teste: vai para o grupo escolhido (ou, sem grupo, para o próprio número). */
  @SoAdmin()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('teste')
  @HttpCode(204)
  teste(@OrgAtual() orgId: string): Promise<void> {
    return this.whatsapp.enviarTeste(orgId);
  }

  @SoAdmin()
  @Delete()
  async desconectar(@OrgAtual() orgId: string): Promise<EstadoWhatsapp> {
    await this.whatsapp.desconectar(orgId);
    return this.whatsapp.estado(orgId);
  }
}
