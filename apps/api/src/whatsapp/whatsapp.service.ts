import { BadGatewayException, Inject, Injectable, Logger, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { normalizarTelefone, type CodigoWhatsapp, type EstadoWhatsapp, type GrupoWhatsapp } from '@talhio/shared';
import { WhatsappRepository } from './whatsapp.repository.js';
import { PROVEDOR_WHATSAPP, type AnexoWhatsapp, type ProvedorWhatsapp } from './whatsapp.tokens.js';

/** Conexão da fazenda com o WhatsApp. Toda chamada leva o orgId da sessão. */
@Injectable()
export class WhatsappService {
  private readonly log = new Logger('WhatsApp');

  constructor(
    @Inject(PROVEDOR_WHATSAPP) private readonly provedor: ProvedorWhatsapp,
    @Inject(WhatsappRepository) private readonly repo: WhatsappRepository,
  ) {}

  async estado(orgId: string): Promise<EstadoWhatsapp> {
    const conexao = await this.provedor.estado(orgId);
    if (conexao.estado === 'indisponivel' || conexao.estado === 'desconectado') return { ...conexao, grupo: null };
    const linha = await this.repo.buscar(orgId);
    return { ...conexao, grupo: linha?.grupoId ? { id: linha.grupoId, nome: linha.grupoNome ?? '' } : null };
  }

  private async exigirConectado(orgId: string): Promise<void> {
    if ((await this.provedor.estado(orgId)).estado !== 'conectado') {
      throw new UnprocessableEntityException({ codigo: 'WHATSAPP_NAO_CONECTADO', mensagem: 'O WhatsApp da fazenda não está conectado. Conecte em Configurações.' });
    }
  }

  /** Grupos do número conectado, para a pessoa escolher onde as notificações saem. */
  async grupos(orgId: string): Promise<GrupoWhatsapp[]> {
    await this.exigirConectado(orgId);
    try {
      return await this.provedor.listarGrupos(orgId);
    } catch (e) {
      this.log.warn(`grupos não lidos: ${e instanceof Error ? e.message : e}`);
      throw new BadGatewayException({ codigo: 'WHATSAPP_GRUPOS_FALHARAM', mensagem: 'Não consegui ler os grupos do WhatsApp. Tente de novo.' });
    }
  }

  /** Só aceita um grupo em que o número conectado está de fato: o id vem do app, mas quem vale é a lista do WhatsApp. */
  async escolherGrupo(orgId: string, grupoId: string): Promise<EstadoWhatsapp> {
    const grupo = (await this.grupos(orgId)).find((g) => g.id === grupoId);
    if (!grupo) throw new UnprocessableEntityException({ codigo: 'WHATSAPP_GRUPO_INEXISTENTE', mensagem: 'Esse grupo não está no WhatsApp conectado.' });
    await this.repo.escolherGrupo(orgId, { id: grupo.id, nome: grupo.nome });
    return this.estado(orgId);
  }

  async tirarGrupo(orgId: string): Promise<EstadoWhatsapp> {
    await this.repo.escolherGrupo(orgId, null);
    return this.estado(orgId);
  }

  /** Para os outros módulos (escala, relatório, alertas): manda para o grupo escolhido, ou diz com clareza por que não deu. */
  /** Conectado e com grupo escolhido, ou erro de negócio dizendo o que falta. */
  async exigirGrupo(orgId: string): Promise<{ id: string; nome: string }> {
    await this.exigirConectado(orgId);
    const { grupo } = await this.estado(orgId);
    if (!grupo) throw new UnprocessableEntityException({ codigo: 'WHATSAPP_SEM_GRUPO', mensagem: 'Escolha o grupo que recebe as notificações em Configurações.' });
    return grupo;
  }

  async notificarGrupo(orgId: string, texto: string, anexo?: AnexoWhatsapp): Promise<{ grupoNome: string }> {
    const grupo = await this.exigirGrupo(orgId);
    try {
      await this.provedor.enviarNoGrupo(orgId, grupo.id, texto, anexo);
      return { grupoNome: grupo.nome };
    } catch (e) {
      this.log.warn(`envio ao grupo falhou: ${e instanceof Error ? e.message : e}`);
      throw new BadGatewayException({ codigo: 'WHATSAPP_ENVIO_FALHOU', mensagem: 'Não consegui enviar a mensagem ao grupo do WhatsApp.' });
    }
  }

  /** Gera o código que a pessoa digita no WhatsApp (Aparelhos conectados > Conectar com número de telefone). */
  async pedirCodigo(orgId: string, telefone: string): Promise<CodigoWhatsapp> {
    if ((await this.provedor.estado(orgId)).estado === 'indisponivel') {
      throw new ServiceUnavailableException({ codigo: 'WHATSAPP_INDISPONIVEL', mensagem: 'O WhatsApp ainda não está ligado neste servidor.' });
    }
    try {
      return { codigo: await this.provedor.pedirCodigo(orgId, telefone), telefone };
    } catch (e) {
      this.log.warn(`código não gerado: ${e instanceof Error ? e.message : e}`);
      throw new BadGatewayException({ codigo: 'WHATSAPP_CODIGO_FALHOU', mensagem: 'Não consegui gerar o código. Confira o número (com DDD) e tente de novo.' });
    }
  }

  desconectar(orgId: string): Promise<void> {
    return this.provedor.desconectar(orgId);
  }

  /** Para os outros módulos (escala, relatório): manda o texto, ou diz com clareza por que não deu. */
  async enviarTexto(orgId: string, telefone: string, texto: string): Promise<void> {
    if ((await this.provedor.estado(orgId)).estado !== 'conectado') {
      throw new UnprocessableEntityException({ codigo: 'WHATSAPP_NAO_CONECTADO', mensagem: 'O WhatsApp da fazenda não está conectado. Conecte em Config.' });
    }
    try {
      await this.provedor.enviarTexto(orgId, normalizarTelefone(telefone), texto);
    } catch (e) {
      this.log.warn(`envio falhou: ${e instanceof Error ? e.message : e}`);
      throw new BadGatewayException({ codigo: 'WHATSAPP_ENVIO_FALHOU', mensagem: e instanceof Error && e.message.includes('não está no WhatsApp') ? 'Esse número não está no WhatsApp.' : 'Não consegui enviar a mensagem pelo WhatsApp.' });
    }
  }

  /** Mensagem de teste: vai para o grupo escolhido ou, sem grupo, para o próprio número conectado. */
  async enviarTeste(orgId: string): Promise<void> {
    if ((await this.estado(orgId)).grupo) return void (await this.notificarGrupo(orgId, '🚜 Talhio conectado! As notificações da fazenda vão chegar neste grupo.'));
    const { estado, numero } = await this.provedor.estado(orgId);
    if (estado !== 'conectado' || !numero) {
      throw new UnprocessableEntityException({ codigo: 'WHATSAPP_NAO_CONECTADO', mensagem: 'O WhatsApp da fazenda não está conectado. Conecte em Config.' });
    }
    await this.enviarTexto(orgId, numero, '🚜 Talhio conectado ao WhatsApp! As escalas e os relatórios da fazenda poderão sair por aqui.');
  }
}
