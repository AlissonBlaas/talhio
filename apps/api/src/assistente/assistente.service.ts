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
import { calcular, ContaInvalida, ehConstante } from './calculo.js';
import { EscalaService } from '../escala/escala.service.js';
import { resolverAtalhos } from './atalhos.js';
import { comVariacoes, conferirResposta, existeNasFontes } from './conferencia.js';
import { CortaSugestoes, MARCA_DOS_DADOS, montarInstrucoes, separarSugestoes } from './instrucoes.js';
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

const PedidoDeConta = z.object({ expressao: z.string().min(1).max(300), descricao: z.string().max(200).optional().default(''), unidade: z.string().max(12).optional() });

/** O que a pessoa vê quando a resposta do modelo traz número que o servidor não consegue confirmar, mesmo na segunda tentativa. */
/** Abre a resposta de reserva: quando nada do que o modelo escreveu conferiu, vai o resumo do dia, que o servidor monta. */
export const SO_O_CONFIRMADO = 'O que está confirmado nos dados de hoje:';

/**
 * Fica só com as linhas que conferem. A resposta nunca é trocada por um "não vou mostrar": o que tem fonte aparece,
 * a linha com número sem fonte sai. Título que ficou sem nada embaixo e tabela que ficou sem linhas também saem.
 */
export function soOQueConfere(texto: string, conferir: (texto: string) => string[]): string {
  const aceitas: string[] = [];
  for (const linha of texto.split('\n')) {
    if (conferir([...aceitas, linha].join('\n')).length === 0) aceitas.push(linha);
  }
  const ehTitulo = (l: string) => l.trim().startsWith('## ');
  const ehMoldura = (l: string) => /^\s*\|/.test(l) && !/\d/.test(l.replace(/\*\*/g, ''));
  const limpas = aceitas.filter((linha, i) => {
    const proxima = aceitas.slice(i + 1).find((l) => l.trim() !== '');
    if (ehTitulo(linha)) return proxima !== undefined && !ehTitulo(proxima);
    return true;
  });
  // Tabela só com cabeçalho e separador (todas as linhas de dados caíram) não diz nada.
  const comDados = limpas.some((l) => /^\s*\|/.test(l) && !ehMoldura(l));
  return (comDados ? limpas : limpas.filter((l) => !/^\s*\|/.test(l))).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Deixa a resposta sair para o app linha a linha, e só linha conferida. Recebe o texto como o modelo escreve; a cada
 * linha completa confere tudo que chegou até ali e solta a parte nova. Na primeira linha que não confere, fecha.
 */
class PortaDeLinhas {
  private recebido = '';
  private enviado = 0;
  private fechada = false;

  constructor(
    private readonly conferir: (texto: string) => string[],
    private readonly aoTrecho: (trecho: string) => void,
  ) {}

  empurrar(trecho: string): void {
    if (!trecho || this.fechada) return;
    this.recebido += trecho;
    const fimDaLinha = this.recebido.lastIndexOf('\n');
    if (fimDaLinha < this.enviado) return;
    const completo = this.recebido.slice(0, fimDaLinha + 1);
    if (this.conferir(completo).length > 0) {
      this.fechada = true;
      return;
    }
    this.soltar(completo);
  }

  /** Fim: `final` é o texto conferido que fica valendo. Sai o que faltava dele, se o que já saiu é o começo dele. */
  terminar(final: string): void {
    if (final.startsWith(this.recebido.slice(0, this.enviado))) this.soltar(final);
  }

  private soltar(ate: string): void {
    // Em pedaços de linha, para a tela ir preenchendo em vez de mudar de uma vez.
    for (const pedaco of ate.slice(this.enviado).match(/[^\n]*\n?/g) ?? []) if (pedaco) this.aoTrecho(pedaco);
    this.enviado = Math.max(this.enviado, ate.length);
  }
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
    @Inject(EscalaService) private readonly escala: EscalaService,
  ) {}

  /**
   * Responde à pergunta dentro da conversa (ou começa uma). O histórico vem do banco, não do app:
   * quem pergunta não consegue inventar falas anteriores do assistente.
   */
  responder(dono: Dono, conversaId: string | null, texto: string, agora = new Date()): Promise<Resposta> {
    return this.executar(dono, conversaId, texto, agora);
  }

  /**
   * Igual a `responder`, mas `aoTrecho` recebe o texto enquanto o modelo escreve, LINHA A LINHA: cada linha só sai
   * depois de conferida (todo número com fonte, na máquina, na medida e no período certos). Se uma linha não confere,
   * nada mais sai; o modelo responde de novo e o texto final, conferido, substitui o que estava na tela.
   */
  responderEmFluxo(dono: Dono, conversaId: string | null, texto: string, aoTrecho: (trecho: string) => void, agora = new Date()): Promise<Resposta> {
    return this.executar(dono, conversaId, texto, agora, aoTrecho);
  }

  private async executar(dono: Dono, conversaId: string | null, texto: string, agora: Date, aoTrecho?: (trecho: string) => void): Promise<Resposta> {
    // Só as últimas mensagens vão ao modelo, e só elas são lidas do banco.
    const anterior = conversaId ? await this.conversas.buscar(dono, conversaId, { limite: MEMORIA_DA_CONVERSA }) : null;
    if (conversaId && !anterior) throw naoEncontrada();

    const conversa: Mensagem[] = [...(anterior?.mensagens ?? []), { papel: 'usuario', texto }];
    const retrato = comVariacoes(await this.retratoDaFazenda(dono.orgId, agora));
    const instrucoes = montarInstrucoes(retrato, agora);

    let resposta: { texto: string; sugestoes: string[]; atalhos?: string[] };
    try {
      // Tudo que as consultas devolvem fica anotado: é contra isso (e o retrato) que os números da resposta são conferidos.
      const consultas: unknown[] = [];
      // As contas que o servidor fez nesta resposta. Cada operando tem que existir nos dados, numa conta anterior ou no
      // que a pessoa escreveu: assim o resultado é exato e não nasce de número inventado.
      const calculos: { valor: number; unidade: string | null }[] = [];
      const perguntas = conversa.filter((m) => m.papel === 'usuario').map((m) => m.texto);
      const fazerConta = (pedido: unknown) => {
        const lido = PedidoDeConta.safeParse(pedido);
        if (!lido.success) return { erro: 'Pedido inválido: informe expressao (só números, + - * / e parênteses) e descricao.' };
        try {
          const { resultado, operandos } = calcular(lido.data.expressao);
          const semFonte = operandos.filter((n) => !ehConstante(n) && !existeNasFontes(n, { dados: [retrato, ...consultas], textos: perguntas, hoje: diaLocal(agora), calculos }));
          if (semFonte.length > 0) return { erro: `Estes números da expressão não estão nos DADOS, nas consultas nem na pergunta: ${semFonte.join(', ')}. Consulte primeiro e use os números como vieram.` };
          const valor = Math.round(resultado * 100) / 100;
          calculos.push({ valor, unidade: lido.data.unidade?.trim() || null });
          return { descricao: lido.data.descricao, expressao: lido.data.expressao, resultado: valor, unidade: lido.data.unidade ?? '' };
        } catch (e) {
          return { erro: e instanceof ContaInvalida ? e.message : 'Não consegui fazer essa conta.' };
        }
      };
      const ferramentas = this.ferramentasDa(dono.orgId, agora, (resultado) => consultas.push(resultado), fazerConta);
      // As regras (sem os DADOS) e o que a pessoa escreveu: ali basta o número existir. Nos dados, ele tem que estar no lugar certo.
      const regras = instrucoes.slice(0, instrucoes.indexOf(MARCA_DOS_DADOS));
      // Pergunta de continuação não repete a máquina nem o dia: o que a conversa vinha dizendo serve de contexto.
      const contexto = (anterior?.mensagens ?? []).slice(-4).map((m) => m.texto).join('\n');
      const conferir = (escrito: string) =>
        conferirResposta(escrito, { dados: [retrato, ...consultas], textos: [regras, ...perguntas], pergunta: texto, contexto, ditoPelaPessoa: perguntas.slice(-2), hoje: diaLocal(agora), calculos });

      // Em fluxo, cada linha completa é conferida e sai na hora; a que não confere fecha a porta.
      const porta = aoTrecho ? new PortaDeLinhas(conferir, aoTrecho) : null;
      if (porta && this.ia.transmitir) {
        const corte = new CortaSugestoes();
        const bruto = await this.ia.transmitir(instrucoes, conversa, ferramentas, (t) => porta.empurrar(corte.empurrar(t)));
        porta.empurrar(corte.terminar());
        resposta = separarSugestoes(bruto);
      } else {
        resposta = separarSugestoes(await this.ia.responder(instrucoes, conversa, ferramentas));
      }
      if (!resposta.texto) throw new Error('Resposta vazia');
      let semFonte = conferir(resposta.texto);
      if (semFonte.length > 0) {
        // Uma segunda chance, dizendo exatamente quais números não têm fonte. A primeira resposta não é mostrada nem guardada.
        const aviso = `[Conferência automática] A resposta acima NÃO foi mostrada. Estes números não conferem com os DADOS nem com as consultas: ${semFonte.slice(0, 12).join('; ')}. Responda de novo à minha última pergunta. Consulte o que faltar e use só números que vierem dos DADOS ou das consultas, escritos como vieram (pode arredondar), cada um na frase (ou na linha da tabela) que cita a máquina e o período a que ele pertence. Número da fazenda inteira: escreva "a fazenda" ou "no total" na mesma frase. Conta só com a ferramenta calcular, nunca de cabeça. O que não tiver, diga em uma frase que não tem. Não mencione esta conferência.`;
        const segunda = separarSugestoes(await this.ia.responder(instrucoes, [...conversa, { papel: 'assistente', texto: resposta.texto }, { papel: 'usuario', texto: aviso }], ferramentas));
        semFonte = segunda.texto ? conferir(segunda.texto) : semFonte;
        if (segunda.texto && semFonte.length === 0) resposta = segunda;
        else {
          anotarFalha(new Error(`resposta cortada pela conferência; números sem fonte: ${semFonte.join('; ')}`), agora);
          // Nunca devolve "não vou mostrar": fica o que conferiu (da segunda resposta ou, se dela não sobrou nada, da
          // primeira). Se nenhuma linha das duas tem fonte, vai o resumo de hoje, que o servidor monta dos mesmos dados.
          const sobra = [segunda.texto, resposta.texto].map((t) => (t ? soOQueConfere(t, conferir) : '')).find((t) => t.replace(/[^\p{L}\d]/gu, '').length >= 12);
          resposta = { texto: sobra ?? `${SO_O_CONFIRMADO} ${retrato.relatorioDeHoje.resumo}`, sugestoes: sobra ? segunda.sugestoes : [] };
        }
      }
      // O que ainda não saiu (o fim da resposta, ou ela inteira quando não houve fluxo). Se parte de uma resposta
      // recusada já saiu, nada mais é mandado: o texto final substitui o da tela quando a resposta termina.
      porta?.terminar(resposta.texto);
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

    // O modelo só escolhe identificadores; rótulo e rota saem da lista fixa do servidor.
    const atalhos = resolverAtalhos(resposta.atalhos ?? [], retrato.maquinas);
    const id = await this.conversas.guardarTroca(dono, conversaId, texto, resposta.texto, atalhos);
    return { conversaId: id, texto: resposta.texto, sugestoes: resposta.sugestoes, atalhos };
  }

  /** O que o modelo pode buscar sozinho. Sempre da organização de quem perguntou, nunca de outra. */
  private ferramentasDa(orgId: string, agora: Date, anotar: (resultado: unknown) => void = () => undefined, fazerConta?: (pedido: unknown) => unknown): Ferramentas {
    const Pedido = z.object({ periodo: PeriodoSchema, data: DiaSchema.optional(), maquinas: z.array(z.string().min(1).max(100)).min(1).max(50).optional() });
    const PedidoDeHistorico = z.object({ meses: z.number().int().min(1).max(24).optional() });
    const PedidoDeAnalise = z.object({ maquina: z.string().min(1).max(100), de: DiaSchema, ate: DiaSchema.optional() });
    // Par { valor, anterior } sai com diferença e variação prontas; e todo resultado é anotado para a conferência.
    const entregar = async (resultado: Promise<unknown>) => {
      const pronto = comVariacoes(await resultado);
      anotar(pronto);
      return pronto;
    };
    const consultas: Required<Omit<Ferramentas, 'calcular'>> = {
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
        // Com o NOME da máquina (é por ele que a conferência sabe de quem é cada número) e sem os ids das medições.
        const maquina = (await this.maquinas.listar(orgId, agora)).find((m) => m.id === analise.maquinaId)?.nome ?? analise.maquinaId;
        const base = { maquina, de: analise.de, ate: analise.ate };
        if (analise.grupos.length === 0) return { ...base, medicoes: [], aviso: 'A máquina não tem medições nesse período (sem telemetria ou não reportou).' };
        return { ...base, medicoes: analise.grupos.flatMap((g) => g.itens.map(({ id: _id, nome, ...item }) => ({ grupo: g.nome, medicao: nome, ...item }))) };
      },
    };
    return {
      consultarRelatorio: (pedido) => entregar(consultas.consultarRelatorio(pedido)),
      consultarHistoricoMensal: (pedido) => entregar(consultas.consultarHistoricoMensal(pedido)),
      consultarAnaliseDaMaquina: (pedido) => entregar(consultas.consultarAnaliseDaMaquina(pedido)),
      ...(fazerConta ? { calcular: async (pedido: unknown) => fazerConta(pedido) } : {}),
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
    const [painel, maquinas, talhoes, dia, semana, escala] = await Promise.all([
      this.painel.montar(orgId),
      this.maquinas.listar(orgId, agora),
      this.talhoes.listar(orgId),
      this.relatorios.montar(orgId, 'dia', undefined, agora),
      this.relatorios.montar(orgId, 'semana', undefined, agora),
      // A escala não pode derrubar a resposta: sem ela, a IA só fica sem saber quem está em cada turno.
      this.escala.deHoje(orgId, agora).catch(() => null),
    ]);
    return {
      fazenda: painel.fazendaNome,
      operacaoEmAndamento: painel.operacaoAtual,
      maquinas: maquinas.map(({ posicao: _posicao, numeroSerie: _serie, ...resto }) => resto),
      talhoes: talhoes.map(({ contorno: _contorno, ...resto }) => resto),
      // Quem opera cada máquina hoje, por turno ("definida": false = sugestão ainda não confirmada pelo administrador).
      escalaDeHoje: (escala?.itens ?? []).filter((i) => i.operador).map((i) => ({ maquinaNome: i.maquinaNome, turno: i.turno, operador: i.operador, tarefa: i.tarefa, talhao: i.talhaoNome, definida: i.definida, enviada: i.enviadaEm !== null })),
      relatorioDeHoje: dia,
      relatorioDosUltimos7Dias: semana,
    };
  }
}
