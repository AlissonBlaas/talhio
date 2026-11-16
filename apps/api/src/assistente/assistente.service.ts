import { appendFile, mkdir } from 'node:fs/promises';
import { BadGatewayException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DiaSchema, PeriodoSchema, type Conversa, type PaginaDeConversas, type Mensagem, type Resposta } from '@talhio/shared';
import { z } from 'zod';
import { ConsumoDeereRepository, type ConsumoDoMes } from '../integracoes/deere/consumo-deere.repository.js';
import { MaquinasService } from '../maquinas/maquinas.service.js';
import { PainelService } from '../painel/painel.service.js';
import { RelatoriosService } from '../relatorios/relatorios.service.js';
import { diaLocal } from '../shared/dia.js';
import { TalhoesService } from '../talhoes/talhoes.service.js';
import { ConversasRepository, type Dono } from './conversas.repository.js';
import { CortaSugestoes, montarInstrucoes, separarSugestoes } from './instrucoes.js';
import { IaIndisponivel, IaNaoConfigurada, MODELO_IA, type Ferramentas, type ModeloIa, type MotivoDaFalha } from './modelo-ia.js';

/** Quantas mensagens anteriores vão para o modelo. O histórico inteiro continua guardado. */
const MEMORIA_DA_CONVERSA = 20;

/** O que mostrar no app para cada falha. Quem usa é o administrador, então dizemos o que conferir. */
const MENSAGEM_DA_FALHA: Record<MotivoDaFalha, string> = {
  chave: 'A chave da IA foi recusada. Confira ANTHROPIC_API_KEY no servidor.',
  credito: 'A conta da IA está sem crédito. Adicione crédito no console da Anthropic.',
  modelo: 'O modelo de IA configurado não existe ou não está liberado para esta conta. Confira ANTHROPIC_MODELO no servidor.',
  limite: 'A IA está recebendo perguntas demais agora. Tente de novo em um minuto.',
  outro: 'O assistente não respondeu agora. Tente de novo em instantes.',
};

/**
 * O detalhe da falha fica só no servidor: no terminal e em .dados/assistente-falhas.log.
 * A mensagem do fornecedor não traz a chave nem a pergunta.
 */
function anotarFalha(erro: unknown, agora: Date) {
  const linha = `[assistente] ${agora.toISOString()} A IA não respondeu: ${erro instanceof Error ? erro.message : String(erro)}`;
  console.warn(linha);
  if (process.env.NODE_ENV === 'test') return;
  void mkdir('.dados', { recursive: true })
    .then(() => appendFile('.dados/assistente-falhas.log', `${linha}\n`))
    .catch(() => undefined);
}

const naoEncontrada = () => new NotFoundException({ codigo: 'CONVERSA_NAO_ENCONTRADA', mensagem: 'Essa conversa não existe mais.' });

@Injectable()
export class AssistenteService {
  constructor(
    @Inject(MODELO_IA) private readonly ia: ModeloIa,
    @Inject(ConversasRepository) private readonly conversas: ConversasRepository,
    @Inject(PainelService) private readonly painel: PainelService,
    @Inject(MaquinasService) private readonly maquinas: MaquinasService,
    @Inject(TalhoesService) private readonly talhoes: TalhoesService,
    @Inject(RelatoriosService) private readonly relatorios: RelatoriosService,
    @Inject(ConsumoDeereRepository) private readonly consumo: ConsumoDeereRepository,
  ) {}

  /**
   * Responde à pergunta dentro da conversa (ou começa uma). O histórico vem do banco, não do app:
   * quem pergunta não consegue inventar falas anteriores do assistente.
   */
  responder(dono: Dono, conversaId: string | null, texto: string, agora = new Date()): Promise<Resposta> {
    return this.executar(dono, conversaId, texto, agora, (instrucoes, conversa, ferramentas) => this.ia.responder(instrucoes, conversa, ferramentas));
  }

  /** Igual a `responder`, mas `aoTrecho` recebe o texto aos poucos, sem as perguntas de continuação. */
  responderEmFluxo(dono: Dono, conversaId: string | null, texto: string, aoTrecho: (trecho: string) => void, agora = new Date()): Promise<Resposta> {
    return this.executar(dono, conversaId, texto, agora, async (instrucoes, conversa, ferramentas) => {
      const corte = new CortaSugestoes();
      const mostrar = (t: string) => t && aoTrecho(t);
      if (!this.ia.transmitir) {
        const bruto = await this.ia.responder(instrucoes, conversa, ferramentas);
        mostrar(corte.empurrar(bruto));
        mostrar(corte.terminar());
        return bruto;
      }
      const bruto = await this.ia.transmitir(instrucoes, conversa, ferramentas, (t) => mostrar(corte.empurrar(t)));
      mostrar(corte.terminar());
      return bruto;
    });
  }

  private async executar(
    dono: Dono,
    conversaId: string | null,
    texto: string,
    agora: Date,
    gerar: (instrucoes: string, conversa: Mensagem[], ferramentas: Ferramentas) => Promise<string>,
  ): Promise<Resposta> {
    // Só as últimas mensagens vão ao modelo, e só elas são lidas do banco.
    const anterior = conversaId ? await this.conversas.buscar(dono, conversaId, { limite: MEMORIA_DA_CONVERSA }) : null;
    if (conversaId && !anterior) throw naoEncontrada();

    const conversa: Mensagem[] = [...(anterior?.mensagens ?? []), { papel: 'usuario', texto }];
    const instrucoes = montarInstrucoes(await this.retratoDaFazenda(dono.orgId, agora), agora);

    let resposta: { texto: string; sugestoes: string[] };
    try {
      resposta = separarSugestoes(await gerar(instrucoes, conversa, this.ferramentasDa(dono.orgId, agora)));
      if (!resposta.texto) throw new Error('Resposta vazia');
    } catch (erro) {
      // Nada é gravado quando a IA falha: "tentar de novo" não duplica a pergunta.
      if (erro instanceof IaNaoConfigurada) {
        throw new ServiceUnavailableException({ codigo: 'IA_NAO_CONFIGURADA', mensagem: 'O assistente ainda não foi ligado neste servidor (falta a chave da IA).' });
      }
      const motivo = erro instanceof IaIndisponivel ? erro.motivo : 'outro';
      anotarFalha(erro, agora);
      // No "outro" o código do fornecedor vai junto: é a pista para quem administra o servidor.
      const pista = motivo === 'outro' && erro instanceof IaIndisponivel ? ` (erro ${erro.status ?? 'de conexão'})` : '';
      throw new BadGatewayException({ codigo: `IA_${motivo.toUpperCase()}`, mensagem: MENSAGEM_DA_FALHA[motivo] + pista });
    }

    const id = await this.conversas.guardarTroca(dono, conversaId, texto, resposta.texto);
    return { conversaId: id, ...resposta };
  }

  /** O que o modelo pode buscar sozinho. Sempre da organização de quem perguntou, nunca de outra. */
  private ferramentasDa(orgId: string, agora: Date): Ferramentas {
    const Pedido = z.object({ periodo: PeriodoSchema, data: DiaSchema.optional(), maquinas: z.array(z.string().min(1).max(100)).min(1).max(50).optional() });
    const PedidoDeHistorico = z.object({ meses: z.number().int().min(1).max(24).optional() });
    const PedidoDeAnalise = z.object({ maquina: z.string().min(1).max(100), de: DiaSchema, ate: DiaSchema.optional() });
    return {
      consultarRelatorio: async (pedido) => {
        const lido = Pedido.safeParse(pedido);
        if (!lido.success) return { erro: 'Pedido inválido: informe periodo (dia, semana ou mes) e, se quiser, data no formato AAAA-MM-DD e maquinas (lista de ids).' };
        return this.relatorios.montar(orgId, lido.data.periodo, lido.data.data, agora, lido.data.maquinas);
      },
      consultarHistoricoMensal: async (pedido) => {
        const lido = PedidoDeHistorico.safeParse(pedido ?? {});
        if (!lido.success) return { erro: 'Pedido inválido: informe meses como um número inteiro de 1 a 24.' };
        return this.historicoMensal(orgId, lido.data.meses ?? 6, agora);
      },
      consultarAnaliseDaMaquina: async (pedido) => {
        const lido = PedidoDeAnalise.safeParse(pedido);
        if (!lido.success) return { erro: 'Pedido inválido: informe maquina (id) e de (AAAA-MM-DD); ate é opcional.' };
        const analise = await this.maquinas.analise(orgId, lido.data.maquina, lido.data.de, lido.data.ate ?? lido.data.de, agora);
        if (analise.grupos.length === 0) return { ...analise, aviso: 'A máquina não tem medições nesse período (sem telemetria ou não reportou).' };
        // Os ids das medições não ajudam a responder e só gastam contexto.
        return { ...analise, grupos: analise.grupos.map((g) => ({ nome: g.nome, itens: g.itens.map(({ id: _id, ...item }) => item) })) };
      },
    };
  }

  /**
   * Um mês por linha, dos últimos `meses` meses (contando o atual), com o total do período já somado. Cada mês é o
   * MESMO relatório da aba Relatórios (área, horas, litros, consumo, tempo parado, cada máquina), então o número que a
   * IA diz é o que a tela mostra. O detalhe do motor (trabalhando, ocioso, transporte) vem dos dias guardados do
   * Analisador da Máquina. Toda soma é feita aqui; o modelo só lê.
   */
  async historicoMensal(orgId: string, meses: number, agora = new Date()) {
    const hoje = diaLocal(agora);
    const lista: { mes: string; ultimoDia: string }[] = [];
    for (let n = meses - 1; n >= 0; n--) {
      const primeiro = new Date(`${hoje.slice(0, 7)}-01T12:00:00Z`);
      primeiro.setUTCMonth(primeiro.getUTCMonth() - n);
      const ultimo = new Date(primeiro);
      ultimo.setUTCMonth(ultimo.getUTCMonth() + 1, 0);
      const fim = ultimo.toISOString().slice(0, 10);
      lista.push({ mes: fim.slice(0, 7), ultimoDia: fim > hoje ? hoje : fim });
    }
    const desde = `${lista[0]!.mes}-01`;
    const casas = (valor: number, n = 1) => Math.round(valor * 10 ** n) / 10 ** n;

    // Três meses de cada vez: cada relatório de mês lê centenas de dias de máquina.
    const relatorios: Awaited<ReturnType<RelatoriosService['montar']>>[] = [];
    for (let i = 0; i < lista.length; i += 3) relatorios.push(...(await Promise.all(lista.slice(i, i + 3).map((m) => this.relatorios.montar(orgId, 'mes', m.ultimoDia, agora)))));
    const doMotor = new Map<string, ConsumoDoMes[]>();
    for (const linha of await this.consumo.porMes(orgId, desde).catch(() => [] as ConsumoDoMes[])) doMotor.set(linha.mes, [...(doMotor.get(linha.mes) ?? []), linha]);
    const somaDoMotor = (linhas: ConsumoDoMes[], campo: 'litrosTrabalhando' | 'litrosOcioso' | 'litrosTransporte' | 'horasTrabalhando' | 'horasOcioso' | 'horasTransporte') => casas(linhas.reduce((soma, l) => soma + l[campo], 0));

    const porMes = lista.map(({ mes }, i) => {
      const r = relatorios[i]!;
      const motor = doMotor.get(mes) ?? [];
      return {
        mes,
        // O mês atual ainda está em andamento: comparar com um mês fechado exige dizer isso.
        emAndamento: mes === hoje.slice(0, 7),
        de: r.inicio,
        ate: r.fim,
        areaHa: r.indicadores.areaHa.valor,
        areaForaDosTalhoesHa: r.indicadores.areaForaDosTalhoesHa,
        horas: r.indicadores.horas.valor,
        litros: r.indicadores.litros.valor,
        consumoLPorHora: r.indicadores.consumoLPorHora.valor,
        consumoLPorHa: r.indicadores.consumoLPorHa.valor,
        paradoMin: r.indicadores.paradoMin.valor,
        litrosEstimados: r.combustivelEstimado,
        // Só quando o Analisador da Máquina tem o mês guardado; nulo = sem esse detalhe.
        motorPorEstado:
          motor.length > 0
            ? {
                litrosTrabalhando: somaDoMotor(motor, 'litrosTrabalhando'),
                litrosOcioso: somaDoMotor(motor, 'litrosOcioso'),
                litrosTransporte: somaDoMotor(motor, 'litrosTransporte'),
                horasTrabalhando: somaDoMotor(motor, 'horasTrabalhando'),
                horasOcioso: somaDoMotor(motor, 'horasOcioso'),
                horasTransporte: somaDoMotor(motor, 'horasTransporte'),
              }
            : null,
        porMaquina: r.porMaquina.map((m) => ({ maquinaId: m.maquinaId, nome: m.nome, areaHa: m.areaHa, horas: m.horas, litros: m.litros, consumoLPorHora: m.consumoLPorHora, consumoLPorHa: m.consumoLPorHa, paradoMin: m.paradoMin })),
      };
    });

    // Total do período somado aqui, para o modelo não somar doze números. Litros: só os meses com leitura.
    const comLitros = porMes.filter((m) => m.litros !== null);
    return {
      desde,
      ate: hoje,
      fonte: 'Os mesmos relatórios mensais da aba Relatórios, um por mês',
      total: {
        meses: porMes.length,
        areaHa: casas(porMes.reduce((soma, m) => soma + m.areaHa, 0)),
        areaForaDosTalhoesHa: casas(porMes.reduce((soma, m) => soma + m.areaForaDosTalhoesHa, 0)),
        horas: casas(porMes.reduce((soma, m) => soma + m.horas, 0)),
        paradoMin: porMes.reduce((soma, m) => soma + m.paradoMin, 0),
        litros: comLitros.length > 0 ? comLitros.reduce((soma, m) => soma + (m.litros ?? 0), 0) : null,
        mesesSemLeituraDeCombustivel: porMes.filter((m) => m.litros === null).map((m) => m.mes),
        mesesSemArea: porMes.filter((m) => m.areaHa === 0).map((m) => m.mes),
      },
      meses: porMes,
    };
  }

  listarConversas(dono: Dono, pular = 0): Promise<PaginaDeConversas> {
    return this.conversas.listar(dono, pular);
  }

  async abrirConversa(dono: Dono, id: string, trecho: { limite: number; antes?: number } = { limite: 30 }): Promise<Conversa> {
    const conversa = await this.conversas.buscar(dono, id, trecho);
    if (!conversa) throw naoEncontrada();
    return conversa;
  }

  async apagarConversa(dono: Dono, id: string): Promise<void> {
    if (!(await this.conversas.apagar(dono, id))) throw naoEncontrada();
  }

  /**
   * Tudo que o assistente pode saber, só da organização de quem pergunta, já calculado pelos
   * outros serviços. Sem contornos nem coordenadas: não ajudam a responder e só gastam contexto.
   */
  private retratoDaFazenda(orgId: string, agora: Date) {
    // O retrato é o mesmo para perguntas seguidas: guardado 30 s, e quem pergunta junto divide a mesma montagem.
    // Assim a pergunta vai direto ao modelo, sem refazer painel, máquinas, talhões e dois relatórios a cada vez.
    const guardado = this.retratos.get(orgId);
    if (guardado && guardado.ate > Date.now()) return guardado.retrato;
    const retrato = this.montarRetrato(orgId, agora).catch((e) => {
      this.retratos.delete(orgId);
      throw e;
    });
    this.retratos.set(orgId, { ate: Date.now() + 30_000, retrato });
    return retrato;
  }

  private readonly retratos = new Map<string, { ate: number; retrato: ReturnType<AssistenteService['montarRetrato']> }>();

  private async montarRetrato(orgId: string, agora: Date) {
    const [painel, maquinas, talhoes, dia, semana] = await Promise.all([
      this.painel.montar(orgId),
      this.maquinas.listar(orgId, agora),
      this.talhoes.listar(orgId),
      this.relatorios.montar(orgId, 'dia', undefined, agora),
      this.relatorios.montar(orgId, 'semana', undefined, agora),
    ]);
    return {
      fazenda: painel.fazendaNome,
      operacaoEmAndamento: painel.operacaoAtual,
      maquinas: maquinas.map(({ posicao: _posicao, numeroSerie: _serie, ...resto }) => resto),
      talhoes: talhoes.map(({ contorno: _contorno, ...resto }) => resto),
      relatorioDeHoje: dia,
      relatorioDosUltimos7Dias: semana,
    };
  }
}
