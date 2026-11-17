import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { IaNaoConfigurada, MODELO_IA, type ModeloIa } from '../assistente/modelo-ia.js';
import type { Banco } from '../banco/banco.js';
import { BANCO } from '../banco/banco.module.js';
import { traducoes } from '../banco/schema.js';

const INSTRUCOES = `Você traduz mensagens de falha de máquinas agrícolas John Deere (códigos de diagnóstico) do inglês para o português do Brasil, como um mecânico de concessionária escreveria.

Regras:
- Responda SÓ com a tradução, em uma linha, sem aspas e sem comentário.
- Copie exatamente como estão: números, códigos, siglas (ECU, SPN, FMI, DTC, CAN, DEF, PTO, SCR, DPF...), unidades e nomes de peça que são marca ou modelo.
- Não acrescente causa, conselho nem informação que não está no texto.
- Se o texto já estiver em português, devolva igual.
- Vocabulário: engine = motor; coolant = líquido de arrefecimento; fuel = combustível; oil pressure = pressão do óleo; hydraulic = hidráulico; transmission = transmissão; sensor = sensor; voltage = tensão; out of range = fora da faixa; low/high = baixo/alto; DEF = ARLA 32 (mantenha também a sigla DEF); aftertreatment = pós-tratamento; operator = operador; stop the machine = pare a máquina; service = manutenção.`;

/** Cada número do original tem que aparecer na tradução (aceita vírgula no lugar do ponto decimal). */
function numerosBatem(original: string, traducao: string): boolean {
  const numeros = original.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const alvo = traducao.replace(/,/g, '.');
  return numeros.every((n) => alvo.includes(n.replace(/,/g, '.')));
}

/**
 * Traduz para o português o texto das falhas que a John Deere manda em inglês (os códigos de diagnóstico das máquinas).
 * Cada texto é traduzido UMA vez e guardado (tabela `traducoes`): as mesmas falhas se repetem na frota, então a IA
 * quase nunca é chamada. A tradução nunca atrasa nem impede um aviso: sem IA, com erro ou com tradução suspeita
 * (vazia, comprida demais ou com número diferente do original), vale o texto original.
 */
@Injectable()
export class TradutorDeFalhas {
  private readonly log = new Logger('Traducao');
  /** Depois de uma falha da IA, espera antes de tentar de novo: a rodada de alertas não pode ficar presa nela. */
  private pausaAte = 0;

  constructor(
    @Inject(BANCO) private readonly db: Banco,
    @Inject(MODELO_IA) private readonly ia: ModeloIa,
  ) {}

  /**
   * O texto em português e se ele é mesmo uma tradução conferida (`traduzido`); falso = devolveu o original.
   * `definitivo` = a IA respondeu, mas a tradução foi recusada: tentar de novo com o mesmo texto não adianta.
   */
  async traduzir(original: string): Promise<{ texto: string; traduzido: boolean; definitivo?: boolean }> {
    const texto = original.replace(/\s+/g, ' ').trim();
    // Só código, sem palavras (ex.: "AIC 524019.31"): não há o que traduzir.
    if (!/[a-zA-Z]{4,}/.test(texto)) return { texto, traduzido: true };
    const chave = createHash('sha256').update(texto.toLowerCase()).digest('hex');
    try {
      const [guardada] = await this.db.select({ traducao: traducoes.traducao }).from(traducoes).where(eq(traducoes.chave, chave)).limit(1);
      if (guardada) return { texto: guardada.traducao, traduzido: true };
      if (Date.now() < this.pausaAte) return { texto, traduzido: false };
      const resposta = (await this.ia.responder(INSTRUCOES, [{ papel: 'usuario', texto }])).replace(/\s+/g, ' ').trim().replace(/^["“](.*)["”]$/, '$1');
      if (!resposta || resposta.length > texto.length * 3 + 60 || !numerosBatem(texto, resposta)) {
        this.log.warn(`tradução recusada (vazia, comprida ou com número diferente): "${texto}" -> "${resposta}"`);
        return { texto, traduzido: false, definitivo: true };
      }
      await this.db.insert(traducoes).values({ chave, original: texto, traducao: resposta }).onConflictDoNothing();
      return { texto: resposta, traduzido: true };
    } catch (e) {
      // IA sem chave: não adianta tentar a cada falha. Outro erro (rede, limite): tenta de novo em 10 min.
      this.pausaAte = Date.now() + (e instanceof IaNaoConfigurada ? 6 * 60 : 10) * 60_000;
      if (!(e instanceof IaNaoConfigurada)) this.log.warn(`não consegui traduzir agora: ${e instanceof Error ? e.message : String(e)}`);
      return { texto, traduzido: false };
    }
  }
}
