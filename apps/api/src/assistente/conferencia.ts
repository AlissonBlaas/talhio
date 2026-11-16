/**
 * Conferência da resposta do assistente: todo número que ele escreve precisa existir no que o servidor entregou
 * (o retrato da fazenda, o resultado das consultas desta resposta, a pergunta de quem escreveu). Número sem fonte
 * não chega ao app. O modelo não faz conta: diferença e variação já vêm calculadas (`comVariacoes`).
 */

/** Inteiro pequeno sem unidade (dia do mês, "2 máquinas", item de lista) não é medição: passa sem conferência. */
const CONTAGEM_MAXIMA = 31;
const UNIDADE = /^\s*(?:%|(?:ha|hectares?|h|horas?|min|minutos?|l|litros?|km\/h|km|kg|t|m|metros?|rpm|reais|mil|vezes|x)(?![\p{L}\d])|l\/|°)/iu;
/** Contagem de tempo ("45 dias", "12 meses") não é medição da fazenda. */
const TEMPO = /^\s*(?:dias?|meses|mês|semanas?|anos?)(?![\p{L}])/iu;

/** Número escrito em português ("11.738,7", "22,2", "1276") ou como no JSON ("11738.7"). */
const NUMERO = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;

function lerNumero(escrito: string): { valor: number; casas: number } {
  const comMilhar = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(escrito);
  const limpo = comMilhar ? escrito.replace(/\./g, '').replace(',', '.') : escrito.replace(',', '.');
  const casas = limpo.includes('.') ? limpo.split('.')[1]!.length : 0;
  return { valor: Number(limpo), casas };
}

const arredondar = (valor: number, casas: number) => Math.round(valor * 10 ** casas) / 10 ** casas;

/** Hora local (Brasília) de cada instante ISO que aparece nas fontes: o modelo pode dizer "às 08:04". */
function horariosDe(fonte: string): Set<string> {
  const horarios = new Set<string>();
  for (const [iso] of fonte.matchAll(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})/g)) {
    const instante = new Date(iso);
    if (Number.isNaN(instante.getTime())) continue;
    const local = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(instante);
    horarios.add(local.replace(/^24/, '00'));
  }
  for (const [, h, m] of fonte.matchAll(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/g)) horarios.add(`${h!.padStart(2, '0')}:${m}`);
  return horarios;
}

/**
 * Os números da resposta que NÃO têm fonte. Vazio = pode mostrar.
 * Um número tem fonte quando: é igual a um número das fontes (ou a ele arredondado para as casas que a resposta
 * usou); é uma duração ("68h58", "45 min", "2,5 h") que corresponde a um valor em minutos ou em horas; é um horário
 * que corresponde a um instante das fontes; ou é um inteiro pequeno sem unidade (contagem, dia do mês).
 */
export function numerosSemFonte(resposta: string, fontes: string[]): string[] {
  const tudo = fontes.join('\n');
  const conhecidos = [...new Set([...tudo.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter(Number.isFinite))];
  // Números escritos em português nas fontes de texto (a pergunta do usuário, as regras): "1.276,6".
  for (const [escrito] of tudo.matchAll(NUMERO)) conhecidos.push(lerNumero(escrito).valor);
  const exatos = new Set(conhecidos);
  const horarios = horariosDe(tudo);
  const bate = (valor: number, casas: number) => exatos.has(valor) || conhecidos.some((c) => Math.abs(arredondar(c, casas) - valor) < 1e-9);
  // "68h58": 4138 min nas fontes, ou 68,97 h.
  const duracaoBate = (minutos: number) => conhecidos.some((c) => Math.round(c) === minutos || Math.abs(c * 60 - minutos) <= 1);

  const semFonte: string[] = [];
  // Sem a marcação, e com cada trecho conferido trocado por espaço para não ser lido de novo.
  let texto = resposta.replace(/\*\*/g, '');
  const consumir = (padrao: RegExp, confere: (m: RegExpExecArray) => boolean) => {
    texto = texto.replace(padrao, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpExecArray;
      if (!confere(m)) semFonte.push(String(m[0]).trim());
      return ' '.repeat(String(m[0]).length);
    });
  };

  // Horário "08:04".
  consumir(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/g, (m) => horarios.has(`${m[1]!.padStart(2, '0')}:${m[2]}`));
  // "68h58", "68 h 58 min", "1 h 30": duração, ou horário escrito com h.
  consumir(/(?<![\d,.])(\d{1,5})\s*h\s*(?:e\s*)?(\d{1,2})(?:\s*min(?:utos)?)?(?![\d,.])/gi, (m) => {
    const h = Number(m[1]);
    const min = Number(m[2]);
    return min < 60 && (duracaoBate(h * 60 + min) || horarios.has(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`));
  });

  for (const m of texto.matchAll(NUMERO)) {
    const { valor, casas } = lerNumero(m[0]);
    const depois = texto.slice(m.index + m[0].length, m.index + m[0].length + 12);
    const unidade = UNIDADE.exec(depois)?.[0].trim().toLowerCase() ?? null;
    if (!unidade && casas === 0 && valor <= CONTAGEM_MAXIMA) continue;
    // Ano ("2025") e contagem de tempo ("45 dias") também não são medição.
    if (!unidade && casas === 0 && ((valor >= 2000 && valor <= 2100) || (valor <= 366 && TEMPO.test(depois)))) continue;
    if (bate(valor, casas)) continue;
    // Horas e minutos escritos de outro jeito: "45 min" de 0,75 h; "2,5 h" de 150 min.
    if (unidade && /^min/.test(unidade) && conhecidos.some((c) => Math.abs(c * 60 - valor) <= 1)) continue;
    if (unidade && /^h(oras?)?$/.test(unidade) && conhecidos.some((c) => Math.abs(arredondar(c / 60, casas) - valor) < 1e-9)) continue;
    semFonte.push(`${m[0]}${unidade ? ` ${unidade}` : ''}`);
  }
  return [...new Set(semFonte)];
}

/**
 * Acrescenta, a todo par `{ valor, anterior }` do dado, a diferença e a variação em %, já calculadas. Assim o modelo
 * diz "subiu 12%" lendo o número, sem fazer a conta. Sem os dois valores, nada é acrescentado.
 */
export function comVariacoes<T>(dado: T): T {
  if (Array.isArray(dado)) return dado.map((item) => comVariacoes(item)) as unknown as T;
  if (!dado || typeof dado !== 'object') return dado;
  const saida: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(dado as Record<string, unknown>)) saida[chave] = comVariacoes(valor);
  const { valor, anterior } = saida;
  if (typeof valor === 'number' && typeof anterior === 'number') {
    saida.diferenca = arredondar(valor - anterior, 1);
    saida.variacaoPct = anterior > 0 ? Math.round(((valor - anterior) / anterior) * 100) : null;
  }
  return saida as T;
}
