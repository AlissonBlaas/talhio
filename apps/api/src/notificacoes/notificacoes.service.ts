import { Inject, Injectable } from '@nestjs/common';
import type { ListaNotificacoes, RegistrarDispositivo } from '@talhio/shared';
import { DispositivosRepository } from './dispositivos.repository.js';
import { ExpoPushService } from './expo-push.service.js';
import { NotificacoesRepository, type NovaNotificacao } from './notificacoes.repository.js';

/** Quantas notificações a aba mostra. */
const LIMITE_DA_ABA = 60;

/** A aba de notificações do app e o push dos alertas. A regra do que vira alerta mora em `MotorDeAlertasService`. */
@Injectable()
export class NotificacoesService {
  constructor(
    @Inject(NotificacoesRepository) private readonly notificacoes: NotificacoesRepository,
    @Inject(DispositivosRepository) private readonly dispositivos: DispositivosRepository,
    @Inject(ExpoPushService) private readonly push: ExpoPushService,
  ) {}

  async listar(orgId: string, usuarioId: string): Promise<ListaNotificacoes> {
    const limpoAte = await this.notificacoes.limpoAte(usuarioId);
    const [itens, naoLidas] = await Promise.all([this.notificacoes.listar(orgId, LIMITE_DA_ABA, limpoAte), this.notificacoes.naoLidas(orgId, usuarioId)]);
    return { itens, naoLidas };
  }

  /** Limpa a aba só para este usuário. */
  async limpar(usuarioId: string): Promise<void> {
    await this.notificacoes.limpar(usuarioId);
  }

  async marcarLidas(usuarioId: string): Promise<void> {
    await this.notificacoes.marcarLidas(usuarioId);
  }

  registrarDispositivo(usuarioId: string, orgId: string, dados: RegistrarDispositivo): Promise<void> {
    return this.dispositivos.registrar(usuarioId, orgId, dados.token, dados.plataforma);
  }

  removerDispositivo(usuarioId: string, token: string): Promise<void> {
    return this.dispositivos.remover(usuarioId, token);
  }

  /**
   * Guarda a notificação (vai para a aba) e, se for nova, manda o push para os aparelhos da fazenda. O mesmo alerta
   * visto duas vezes (mesmo id) não repete o push. Devolve se era nova.
   */
  async emitir(orgId: string, nova: NovaNotificacao): Promise<boolean> {
    const criada = await this.notificacoes.criar(orgId, nova);
    if (!criada) return false;
    const tokens = await this.dispositivos.tokensDaFazenda(orgId);
    const { invalidos } = await this.push.enviar(tokens, {
      titulo: nova.titulo,
      texto: nova.texto,
      dados: { notificacaoId: nova.id, tipo: nova.tipo, ...(nova.maquinaId ? { maquinaId: nova.maquinaId } : {}) },
    });
    await this.dispositivos.removerInvalidos(invalidos);
    return true;
  }
}
