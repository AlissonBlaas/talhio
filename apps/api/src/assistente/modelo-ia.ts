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
  /** Relatório de um dia, de 7 dias ou de um mês (`data` = AAAA-MM-DD). Devolve o relatório ou `{ erro }`. */
  consultarRelatorio(pedido: unknown): Promise<unknown>;
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
    'Busca o relatório calculado pelo sistema de qualquer dia, de 7 dias ou de um mês da fazenda: área, horas, consumo, tempo parado, a máquina que mais parou, o resultado de cada máquina e a série dia a dia, sempre comparado com o período anterior. Use quando a pergunta for sobre outro período que não "hoje" ou "últimos 7 dias" (um dia específico, o mês, mês passado).',
  input_schema: {
    type: 'object' as const,
    properties: {
      periodo: { type: 'string', enum: ['dia', 'semana', 'mes'], description: 'dia = um dia; semana = os 7 dias que terminam em `data`; mes = o mês de calendário que contém `data`.' },
      data: { type: 'string', description: 'Dia de referência no formato AAAA-MM-DD. Sem ela vale hoje. Datas futuras valem hoje.' },
    },
    required: ['periodo'],
  },
};

/** Quantas vezes o modelo pode pedir dados antes de responder. */
const RODADAS_DE_CONSULTA = 4;

/** Sem chave configurada: toda pergunta falha com um erro claro. */
export class IaDesligada implements ModeloIa {
  responder(): Promise<string> {
    return Promise.reject(new IaNaoConfigurada());
  }

  transmitir(): Promise<string> {
    return Promise.reject(new IaNaoConfigurada());
  }
}

const LIMITE_DE_SAIDA = 4000;

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
      const pedir = async (): Promise<Anthropic.Message> => {
        const parametros = {
          model: this.modelo,
          // O raciocínio do modelo conta neste limite: com pouco espaço a resposta saía cortada ou vazia.
          max_tokens: LIMITE_DE_SAIDA,
          system: instrucoes,
          messages: mensagens,
          ...(ferramentas ? { tools: [FERRAMENTA_RELATORIO] } : {}),
        };
        if (!aoTrecho) return this.cliente.messages.create(parametros);
        const fluxo = this.cliente.messages.stream(parametros);
        fluxo.on('text', (trecho) => {
          texto += trecho;
          aoTrecho(trecho);
        });
        return fluxo.finalMessage();
      };
      let resposta = await pedir();
      // O modelo pede um relatório, o servidor busca (já preso à organização) e devolve o resultado.
      for (let rodada = 0; ferramentas && resposta.stop_reason === 'tool_use' && rodada < RODADAS_DE_CONSULTA; rodada++) {
        const pedidos = resposta.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
        const resultados: Anthropic.ToolResultBlockParam[] = await Promise.all(
          pedidos.map(async (pedido) => ({
            type: 'tool_result' as const,
            tool_use_id: pedido.id,
            content: JSON.stringify(pedido.name === FERRAMENTA_RELATORIO.name ? await ferramentas.consultarRelatorio(pedido.input) : { erro: 'Ferramenta desconhecida.' }),
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
