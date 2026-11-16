import Anthropic from '@anthropic-ai/sdk';
import type { Mensagem } from '@talhio/shared';

/** Token do modelo de IA. Trocar de fornecedor é trocar a classe registrada neste token. */
export const MODELO_IA = Symbol('MODELO_IA');

export class IaNaoConfigurada extends Error {}
/** Por que a IA não respondeu, em termos que dá para explicar a quem administra o servidor. */
export type MotivoDaFalha = 'chave' | 'credito' | 'modelo' | 'limite' | 'outro';

export class IaIndisponivel extends Error {
  constructor(
    mensagem: string,
    readonly motivo: MotivoDaFalha = 'outro',
    readonly status?: number,
  ) {
    super(mensagem);
  }
}

/** O que o modelo pode consultar durante a resposta. Cada ferramenta já vem presa à organização de quem perguntou. */
export interface Ferramentas {
  /** Relatório de um dia, de 7 dias ou de um mês (`data` = AAAA-MM-DD), da fazenda ou só de algumas máquinas. Devolve o relatório ou `{ erro }`. */
  consultarRelatorio(pedido: unknown): Promise<unknown>;
  /** Combustível e horas de motor por mês e por máquina, dos últimos `meses` meses. Devolve o histórico ou `{ erro }`. */
  consultarHistoricoMensal?(pedido: unknown): Promise<unknown>;
  /** Todas as medições do Analisador da Máquina de uma máquina num período de até 30 dias. Devolve a análise ou `{ erro }`. */
  consultarAnaliseDaMaquina?(pedido: unknown): Promise<unknown>;
  /** Faz uma conta (+ - * /) com números que já vieram dos dados ou da pergunta. Devolve o resultado ou `{ erro }`. */
  calcular?(pedido: unknown): Promise<unknown>;
}

export interface ModeloIa {
  /** Responde à conversa seguindo as instruções. Só texto. As ferramentas, se houver, deixam o modelo buscar mais dados. */
  responder(instrucoes: string, conversa: Mensagem[], ferramentas?: Ferramentas): Promise<string>;
  /** Como `responder`, mas entrega cada pedaço do texto assim que o modelo o escreve. Devolve o texto inteiro. */
  transmitir?(instrucoes: string, conversa: Mensagem[], ferramentas: Ferramentas | undefined, aoTrecho: (texto: string) => void): Promise<string>;
}

const FERRAMENTA_RELATORIO = {
  name: 'consultar_relatorio',
  description:
    'Busca o relatório calculado pelo sistema de qualquer dia, de 7 dias ou de um mês da fazenda (de qualquer época, inclusive meses e anos anteriores): área, horas, consumo, tempo parado, a máquina que mais parou, o resultado de cada máquina e a série dia a dia, sempre comparado com o período anterior. Use quando a pergunta for sobre outro período que não "hoje" ou "últimos 7 dias" (um dia específico, o mês, mês passado). Com `maquinas`, o relatório (e a série dia a dia) conta só essas máquinas.',
  input_schema: {
    type: 'object' as const,
    properties: {
      periodo: { type: 'string', enum: ['dia', 'semana', 'mes'], description: 'dia = um dia; semana = os 7 dias que terminam em `data`; mes = o mês de calendário que contém `data`.' },
      data: { type: 'string', description: 'Dia de referência no formato AAAA-MM-DD. Sem ela vale hoje. Datas futuras valem hoje.' },
      maquinas: { type: 'array', items: { type: 'string' }, description: 'Opcional: ids das máquinas (campo "id" de cada máquina nos DADOS). Sem ele, a fazenda inteira.' },
    },
    required: ['periodo'],
  },
};

const FERRAMENTA_HISTORICO = {
  name: 'consultar_historico_mensal',
  description:
    'Busca, de uma vez, um resumo de cada mês dos últimos meses e o TOTAL do período já somado: área trabalhada (ha), área fora dos talhões, horas, litros, consumo (L/h e L/ha), tempo parado, o detalhe do motor (trabalhando, ocioso, transporte) e o resultado de cada máquina em cada mês. São os mesmos números da aba Relatórios. É OBRIGATÓRIA para qualquer pergunta sobre o ano, sobre vários meses, sobre "até agora", para comparar meses ou achar o melhor/pior mês. Use o campo "total" para o total do período; não some os meses por conta própria.',
  input_schema: {
    type: 'object' as const,
    properties: {
      meses: { type: 'integer', minimum: 1, maximum: 24, description: 'Quantos meses para trás, contando o mês atual. Padrão: 6. Para "este ano", use o número do mês atual (ex.: em novembro, 11).' },
    },
    required: [],
  },
};

const FERRAMENTA_ANALISE = {
  name: 'consultar_analise_da_maquina',
  description:
    'Busca todas as medições que o Analisador da Máquina da John Deere tem de UMA máquina num período de até 30 dias (de qualquer época): combustível e horas por estado, consumo médio, carga do motor, rotação, velocidade, temperaturas e o que mais a máquina informar. Use para perguntas detalhadas sobre uma máquina (carga do motor, marcha lenta, velocidade média, temperatura).',
  input_schema: {
    type: 'object' as const,
    properties: {
      maquina: { type: 'string', description: 'Id da máquina (campo "id" da máquina nos DADOS).' },
      de: { type: 'string', description: 'Primeiro dia, AAAA-MM-DD.' },
      ate: { type: 'string', description: 'Último dia, AAAA-MM-DD (no máximo 30 dias depois de `de`). Sem ele vale o mesmo dia de `de`.' },
    },
    required: ['maquina', 'de'],
  },
};

const FERRAMENTA_CALCULAR = {
  name: 'calcular',
  description:
    'Faz uma conta no servidor e devolve o resultado exato. Use SEMPRE que precisar de um número que não vem pronto: somar máquinas ou dias, diferença, média, percentual de um total, custo (litros x preço que a pessoa informou), quanto falta, ritmo por hora. Os números da expressão têm que ter vindo dos DADOS, de uma consulta, de outra conta ou do que a pessoa escreveu; pode usar também contagens pequenas (até 31) e os fatores 60, 100 e 1000. Pode chamar várias vezes.',
  input_schema: {
    type: 'object' as const,
    properties: {
      expressao: { type: 'string', description: 'A conta, só com números, + - * / e parênteses. Decimal com ponto. Ex.: "(3900 + 3450) / 2" ou "357.5 * 6.2".' },
      descricao: { type: 'string', description: 'O que a conta é, em poucas palavras. Ex.: "média de litros das duas máquinas em outubro".' },
      unidade: { type: 'string', description: 'Unidade do resultado: "L", "h", "ha", "L/h", "L/ha", "%", "R$", "min", "km/h" ou vazio.' },
    },
    required: ['expressao', 'descricao'],
  },
};

/** As ferramentas que o servidor oferece nesta resposta e quem atende cada uma. */
function ferramentasOferecidas(ferramentas: Ferramentas) {
  const lista: { definicao: typeof FERRAMENTA_RELATORIO | typeof FERRAMENTA_HISTORICO | typeof FERRAMENTA_ANALISE | typeof FERRAMENTA_CALCULAR; atender: (pedido: unknown) => Promise<unknown> }[] = [
    { definicao: FERRAMENTA_RELATORIO, atender: (p) => ferramentas.consultarRelatorio(p) },
  ];
  if (ferramentas.consultarHistoricoMensal) lista.push({ definicao: FERRAMENTA_HISTORICO, atender: (p) => ferramentas.consultarHistoricoMensal!(p) });
  if (ferramentas.consultarAnaliseDaMaquina) lista.push({ definicao: FERRAMENTA_ANALISE, atender: (p) => ferramentas.consultarAnaliseDaMaquina!(p) });
  if (ferramentas.calcular) lista.push({ definicao: FERRAMENTA_CALCULAR, atender: (p) => ferramentas.calcular!(p) });
  return lista;
}

/** Quantas vezes o modelo pode pedir dados antes de responder. */
const RODADAS_DE_CONSULTA = 8;

/** Sem chave configurada: toda pergunta falha com um erro claro. */
export class IaDesligada implements ModeloIa {
  responder(): Promise<string> {
    return Promise.reject(new IaNaoConfigurada());
  }

  transmitir(): Promise<string> {
    return Promise.reject(new IaNaoConfigurada());
  }
}

const LIMITE_DE_SAIDA = 6000;

/** Claude, pela API da Anthropic. A chave fica só no servidor (apps/api/.env). */
export class IaAnthropic implements ModeloIa {
  private readonly cliente: Anthropic;

  constructor(
    chave: string,
    private readonly modelo: string,
  ) {
    this.cliente = new Anthropic({ apiKey: chave, timeout: 30_000, maxRetries: 1 });
  }

  async responder(instrucoes: string, conversa: Mensagem[], ferramentas?: Ferramentas): Promise<string> {
    return this.executar(instrucoes, conversa, ferramentas);
  }

  transmitir(instrucoes: string, conversa: Mensagem[], ferramentas: Ferramentas | undefined, aoTrecho: (texto: string) => void): Promise<string> {
    return this.executar(instrucoes, conversa, ferramentas, aoTrecho);
  }

  /** Com `aoTrecho` a resposta vem em fluxo (cada pedaço sai na hora); sem ele, de uma vez. */
  private async executar(instrucoes: string, conversa: Mensagem[], ferramentas?: Ferramentas, aoTrecho?: (texto: string) => void): Promise<string> {
    try {
      const mensagens: Anthropic.MessageParam[] = conversa.map((m) => ({ role: m.papel === 'usuario' ? ('user' as const) : ('assistant' as const), content: m.texto }));
      let texto = '';
      const oferecidas = ferramentas ? ferramentasOferecidas(ferramentas) : [];
      const pedir = async (): Promise<Anthropic.Message> => {
        const parametros = {
          model: this.modelo,
          // O raciocínio do modelo conta neste limite: com pouco espaço a resposta saía cortada ou vazia.
          max_tokens: LIMITE_DE_SAIDA,
          system: instrucoes,
          messages: mensagens,
          ...(oferecidas.length ? { tools: oferecidas.map((f) => f.definicao) } : {}),
        };
        if (!aoTrecho) return this.cliente.messages.create(parametros);
        const fluxo = this.cliente.messages.stream(parametros);
        fluxo.on('text', (trecho) => {
          texto += trecho;
          aoTrecho(trecho);
        });
        return fluxo.finalMessage();
      };
      // Erro numa consulta vira resposta para o modelo ("não consegui esse dado"), não derruba a conversa.
      const atender = async (pedido: Anthropic.ToolUseBlock): Promise<unknown> => {
        const ferramenta = oferecidas.find((f) => f.definicao.name === pedido.name);
        if (!ferramenta) return { erro: 'Ferramenta desconhecida.' };
        try {
          return await ferramenta.atender(pedido.input);
        } catch (e) {
          return { erro: `Não foi possível buscar esse dado agora${e instanceof Error && e.message ? `: ${e.message.slice(0, 200)}` : '.'}` };
        }
      };
      let resposta = await pedir();
      // O modelo pede um relatório, o servidor busca (já preso à organização) e devolve o resultado.
      for (let rodada = 0; ferramentas && resposta.stop_reason === 'tool_use' && rodada < RODADAS_DE_CONSULTA; rodada++) {
        const pedidos = resposta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
        const resultados: Anthropic.ToolResultBlockParam[] = await Promise.all(
          pedidos.map(async (pedido) => ({
            type: 'tool_result' as const,
            tool_use_id: pedido.id,
            content: JSON.stringify(await atender(pedido)),
          })),
        );
        mensagens.push({ role: 'assistant', content: resposta.content }, { role: 'user', content: resultados });
        resposta = await pedir();
      }
      const final = aoTrecho ? texto.trim() : resposta.content.map((bloco) => (bloco.type === 'text' ? bloco.text : '')).join('').trim();
      if (!final || resposta.stop_reason === 'max_tokens') {
        // Resposta pela metade não vai para o usuário: melhor pedir de novo do que mostrar texto cortado.
        throw new Error(`resposta ${final ? 'cortada' : 'vazia'} (parou por ${resposta.stop_reason}; ${resposta.usage.output_tokens} tokens de saída)`);
      }
      return final;
    } catch (erro) {
      const status = erro instanceof Anthropic.APIError ? erro.status : undefined;
      const detalhe = erro instanceof Error ? erro.message : String(erro);
      const motivo: MotivoDaFalha =
        status === 401 || status === 403 ? 'chave' : /credit balance|billing/i.test(detalhe) ? 'credito' : status === 404 ? 'modelo' : status === 429 ? 'limite' : 'outro';
      const causa = erro instanceof Error && erro.cause instanceof Error ? ` | causa: ${erro.cause.message}` : '';
      throw new IaIndisponivel(`${motivo}; HTTP ${status ?? 'sem resposta'}; modelo ${this.modelo}: ${detalhe.slice(0, 300)}${causa.slice(0, 200)}`, motivo, status);
    }
  }
}
