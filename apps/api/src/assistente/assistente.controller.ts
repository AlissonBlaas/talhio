import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PedidoDeConversasSchema, PedidoDeMensagensSchema, PerguntaSchema, type Conversa, type PaginaDeConversas, type Resposta } from '@talhio/shared';
import type { z } from 'zod';
import { OrgAtual, UsuarioAtual } from '../auth/auth.decorators.js';
import { IdSchema, ZodPipe } from '../shared/zod.pipe.js';
import { AssistenteService } from './assistente.service.js';

@Controller('assistente')
export class AssistenteController {
  constructor(@Inject(AssistenteService) private readonly assistente: AssistenteService) {}

  /** Cada pergunta custa uma chamada paga à IA: limite próprio, bem mais apertado que o geral. */
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post('mensagens')
  @HttpCode(200)
  responder(@OrgAtual() orgId: string, @UsuarioAtual() usuarioId: string, @Body(new ZodPipe(PerguntaSchema)) pergunta: z.output<typeof PerguntaSchema>): Promise<Resposta> {
    return this.assistente.responder({ orgId, usuarioId }, pergunta.conversaId, pergunta.texto);
  }

  /** O histórico de quem está logado, em páginas: `?pular=20` pede a seguinte. */
  @Get('conversas')
  listar(@OrgAtual() orgId: string, @UsuarioAtual() usuarioId: string, @Query(new ZodPipe(PedidoDeConversasSchema)) pedido: z.output<typeof PedidoDeConversasSchema>): Promise<PaginaDeConversas> {
    return this.assistente.listarConversas({ orgId, usuarioId }, pedido.pular);
  }

  @Get('conversas/:id')
  /** As mensagens mais recentes da conversa; `?antes=<número>` pede as anteriores. */
  abrir(
    @OrgAtual() orgId: string,
    @UsuarioAtual() usuarioId: string,
    @Param('id', new ZodPipe(IdSchema)) id: string,
    @Query(new ZodPipe(PedidoDeMensagensSchema)) pedido: z.output<typeof PedidoDeMensagensSchema>,
  ): Promise<Conversa> {
    return this.assistente.abrirConversa({ orgId, usuarioId }, id, pedido);
  }

  @Delete('conversas/:id')
  @HttpCode(204)
  apagar(@OrgAtual() orgId: string, @UsuarioAtual() usuarioId: string, @Param('id', new ZodPipe(IdSchema)) id: string): Promise<void> {
    return this.assistente.apagarConversa({ orgId, usuarioId }, id);
  }
}
