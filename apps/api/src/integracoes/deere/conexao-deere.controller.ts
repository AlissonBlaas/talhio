import { Body, Controller, Delete, Get, HttpCode, Inject, Logger, Post, Query, Redirect } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConcluirConexaoSchema, EscolherOrganizacoesSchema, type AvisoDeere, type ConcluirConexao, type ConexaoDeere, type InicioDaConexao, type OrganizacaoDeere } from '@talhio/shared';
import type { z } from 'zod';
import { OrgAtual, Publico, SoAdmin } from '../../auth/auth.decorators.js';
import { ZodPipe } from '../../shared/zod.pipe.js';
import type { ProvedorMaquinas } from '@talhio/deere';
import { ConexaoDeereService } from './conexao-deere.service.js';
import { PROVEDOR_MAQUINAS } from './deere.tokens.js';
import { SincronizacaoDeereService } from './sincronizacao-deere.service.js';

@Controller('deere')
export class ConexaoDeereController {
  private readonly log = new Logger('AvisoDeere');

  constructor(
    @Inject(ConexaoDeereService) private readonly conexao: ConexaoDeereService,
    @Inject(SincronizacaoDeereService) private readonly sincronizacao: SincronizacaoDeereService,
    @Inject(PROVEDOR_MAQUINAS) private readonly provedor: ProvedorMaquinas,
  ) {}

  /** Conexão pronta: já começa a trazer os dados em segundo plano, para estarem prontos quando o usuário abrir o app. */
  private async comSincronizacao(orgId: string, estado: Promise<ConexaoDeere>, trocou = false): Promise<ConexaoDeere> {
    const c = await estado;
    if (trocou) await this.sincronizacao.recomecar(orgId);
    else if (c.estado === 'pronto') this.sincronizacao.agora(orgId);
    return c;
  }

  @Get('conexao')
  estado(@OrgAtual() orgId: string): Promise<ConexaoDeere> {
    return this.conexao.estado(orgId);
  }

  /** Passo 1: devolve o endereço de login da Deere para o app abrir no navegador. */
  @SoAdmin()
  @Post('conexao/iniciar')
  @HttpCode(200)
  iniciar(@OrgAtual() orgId: string): Promise<InicioDaConexao> {
    return this.conexao.iniciar(orgId);
  }

  /**
   * Passo 2: a Deere manda o navegador de volta para cá. Rota aberta de propósito (o navegador não leva o token
   * do app) e por isso NÃO conclui nada: só repassa o código e o `state` ao app, que conclui logado (passo 3).
   */
  @Publico()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('callback')
  @Redirect()
  async callback(@Query('code') code?: string, @Query('state') state?: string, @Query('error') error?: string): Promise<{ url: string; statusCode: number }> {
    return { url: this.conexao.voltaDoNavegador({ code, state, error }), statusCode: 302 };
  }

  /**
   * Passo 3: o app, logado como administrador, entrega o código e o `state` que voltaram no navegador. Só conclui
   * se o `state` foi gerado por esta mesma fazenda: um link de conexão de outra fazenda não liga conta nenhuma.
   */
  @SoAdmin()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('conexao/concluir')
  @HttpCode(200)
  concluir(@OrgAtual() orgId: string, @Body(new ZodPipe(ConcluirConexaoSchema)) dados: ConcluirConexao): Promise<ConexaoDeere> {
    return this.comSincronizacao(orgId, this.conexao.concluir(orgId, dados));
  }

  /**
   * Aviso da Deere de que um export ficou pronto. Rota aberta (a Deere não leva o token do app) e por isso
   * o conteúdo do aviso não é usado: ele só dispara uma rodada de leitura, que fala com a Deere com as
   * credenciais do servidor. Sem efeito colateral além de ler mais cedo.
   */
  @Publico()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('webhook')
  @HttpCode(204)
  webhook(@Body() corpo: unknown): void {
    // Só para acompanhar no log que os avisos estão chegando: tipo, organização e situação. O conteúdo não decide nada.
    const eventos = Array.isArray(corpo) ? corpo.slice(0, 5) : [];
    const resumo = eventos.map((e) => {
      const dados = (e ?? {}) as { eventTypeId?: unknown; metadata?: { key?: unknown; value?: unknown }[] };
      const meta = (chave: string) => String((Array.isArray(dados.metadata) ? dados.metadata : []).find((m) => m?.key === chave)?.value ?? '?').slice(0, 40);
      // O texto vem de fora: sem quebra de linha nem caractere de controle, para ninguém forjar linhas no log.
      return `${String(dados.eventTypeId ?? '?').slice(0, 40)} org ${meta('orgId')} ${meta('requestStatus')}`.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '?');
    });
    this.log.log(`Aviso da John Deere recebido: ${resumo.length ? resumo.join(' | ') : 'sem eventos no corpo'}`);
    // Mudou talhão, contorno ou linha: o que estava guardado do mapa não vale mais.
    const tipos = (Array.isArray(corpo) ? corpo : []).map((e) => String((e as { eventTypeId?: unknown } | null)?.eventTypeId ?? ''));
    void this.sincronizacao.avisado(tipos.some((t) => t === 'field' || t === 'boundary' || t === 'guidanceLine'));
  }

  @Get('organizacoes')
  organizacoes(@OrgAtual() orgId: string): Promise<{ organizacoes: OrganizacaoDeere[] }> {
    return this.conexao.organizacoes(orgId).then((organizacoes) => ({ organizacoes }));
  }

  @SoAdmin()
  @Post('organizacao')
  @HttpCode(200)
  escolher(@OrgAtual() orgId: string, @Body(new ZodPipe(EscolherOrganizacoesSchema)) dados: z.output<typeof EscolherOrganizacoesSchema>): Promise<ConexaoDeere> {
    return this.comSincronizacao(orgId, this.conexao.escolher(orgId, dados.organizacaoIds), true);
  }

  /** Depois de liberar o acesso no site da Deere. */
  @SoAdmin()
  @Post('conexao/conferir')
  @HttpCode(200)
  conferir(@OrgAtual() orgId: string): Promise<ConexaoDeere> {
    return this.comSincronizacao(orgId, this.conexao.conferirLiberacao(orgId));
  }

  /** Mostra, passo a passo, o que a John Deere respondeu (só status e contagens). */
  @SoAdmin()
  @Get('diagnostico')
  async diagnostico(@OrgAtual() orgId: string) {
    const passos = await this.conexao.diagnosticar(orgId);
    // O que o app recebe de verdade depois de toda a leitura: se aqui vier 0, o mapa fica sem talhão.
    try {
      this.provedor.esquecer?.(orgId); // leitura nova, sem o que estava guardado
      const talhoes = await this.provedor.listarTalhoes(orgId);
      passos.push({ passo: 'talhões prontos para o mapa', status: 'ok', total: talhoes.length, nota: talhoes.slice(0, 12).map((t) => `${t.nome} (${t.areaHa} ha)`).join(', ') || 'nenhum talhão com contorno' });
    } catch (e) {
      passos.push({ passo: 'talhões prontos para o mapa', status: 'falhou', total: null, nota: e instanceof Error ? e.message : String(e) });
    }
    return passos;
  }

  /** Liga o aviso de export pronto na John Deere (webhook). Fica gravado na conta da Deere: só a pedido do administrador. */
  @SoAdmin()
  @Post('aviso')
  @HttpCode(200)
  ativarAviso(@OrgAtual() orgId: string): Promise<AvisoDeere> {
    return this.conexao.ativarAviso(orgId);
  }

  @SoAdmin()
  @Delete('conexao')
  @HttpCode(204)
  desconectar(@OrgAtual() orgId: string): Promise<void> {
    return this.conexao.desconectar(orgId);
  }
}
