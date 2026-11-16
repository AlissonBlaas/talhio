import { Body, Controller, Get, HttpCode, Inject, Post } from '@nestjs/common';
import { RegistrarDispositivoSchema, RemoverDispositivoSchema, type ListaNotificacoes, type RegistrarDispositivo, type RemoverDispositivo } from '@talhio/shared';
import { OrgAtual, UsuarioAtual } from '../auth/auth.decorators.js';
import { ZodPipe } from '../shared/zod.pipe.js';
import { NotificacoesService } from './notificacoes.service.js';

// Controller fino: recebe a requisição e delega. A regra mora no service.
@Controller()
export class NotificacoesController {
  constructor(@Inject(NotificacoesService) private readonly notificacoes: NotificacoesService) {}

  /** A aba de notificações: as mais recentes da fazenda e quantas o usuário ainda não viu. */
  @Get('notificacoes')
  listar(@OrgAtual() orgId: string, @UsuarioAtual() usuarioId: string): Promise<ListaNotificacoes> {
    return this.notificacoes.listar(orgId, usuarioId);
  }

  /** O usuário abriu a aba: tudo até agora conta como visto. */
  @Post('notificacoes/lidas')
  @HttpCode(204)
  async marcarLidas(@UsuarioAtual() usuarioId: string): Promise<void> {
    await this.notificacoes.marcarLidas(usuarioId);
  }

  /** O usuário tocou em "Limpar": a aba dele fica vazia até chegar um alerta novo. Os outros usuários não são afetados. */
  @Post('notificacoes/limpar')
  @HttpCode(204)
  async limpar(@UsuarioAtual() usuarioId: string): Promise<void> {
    await this.notificacoes.limpar(usuarioId);
  }

  /** Liga o push deste aparelho para o usuário logado. */
  @Post('dispositivos')
  @HttpCode(204)
  async registrar(@OrgAtual() orgId: string, @UsuarioAtual() usuarioId: string, @Body(new ZodPipe(RegistrarDispositivoSchema)) dados: RegistrarDispositivo): Promise<void> {
    await this.notificacoes.registrarDispositivo(usuarioId, orgId, dados);
  }

  /** Desliga o push deste aparelho (sair da conta ou desligar o aviso). */
  @Post('dispositivos/remover')
  @HttpCode(204)
  async remover(@UsuarioAtual() usuarioId: string, @Body(new ZodPipe(RemoverDispositivoSchema)) dados: RemoverDispositivo): Promise<void> {
    await this.notificacoes.removerDispositivo(usuarioId, dados.token);
  }
}
