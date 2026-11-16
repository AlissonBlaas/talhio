/**
 * Conferência da resposta do assistente. Nada que o modelo escreve chega ao app sem passar por aqui.
 *
 * Cada número da resposta precisa existir no que o servidor entregou (o retrato da fazenda e o resultado das consultas
 * desta resposta) E estar no lugar certo:
 *   - na MEDIDA certa: "357 L" só bate com um campo de litros, "22 L/h" com um de consumo por hora, "16 h" com um de tempo;
 *   - de QUEM a frase fala: se a frase (ou a linha da tabela, ou a pergunta) cita uma máquina ou um talhão, o número tem
 *     que estar dentro dos dados daquela máquina ou talhão; número de uma máquina só passa se ela for citada;
 *   - do PERÍODO de que a frase fala: "em outubro" só aceita número do relatório de outubro; "hoje", do de hoje.
 * O modelo não faz conta: diferença e variação já vêm calculadas (`comVariacoes`).
 */

// ---------------------------------------------------------------------------------------------------------------------
// Números e unidades
// ---------------------------------------------------------------------------------------------------------------------

/** Que tipo de medida é o número. `null` = não deu para saber (aceita qualquer campo). */
type Classe = 'ha' | 'l' | 'l/h' | 'l/ha' | 'tempo' | '%' | 'km/h' | 'm' | 'outra';

/** Inteiro pequeno sem unidade (dia do mês, "2 máquinas", item de lista) não é medição: passa sem conferência. */
const CONTAGEM_MAXIMA = 31;
/** Número escrito em português ("11.738,7", "22,2", "1276") ou como no JSON ("11738.7"). */
const NUMERO = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;
const SEM_LETRA_DEPOIS = '(?![\\p{L}\\d])';
/** Unidade logo depois do número, da mais específica para a mais geral. */
const UNIDADES: [RegExp, Classe, 'h' | 'min' | null][] = [
  [new RegExp(`^\\s*l\\s*\\/\\s*ha${SEM_LETRA_DEPOIS}`, 'iu'), 'l/ha', null],
  [new RegExp(`^\\s*l\\s*\\/\\s*h(?:ora)?${SEM_LETRA_DEPOIS}`, 'iu'), 'l/h', null],
  [new RegExp(`^\\s*km\\s*\\/\\s*h${SEM_LETRA_DEPOIS}`, 'iu'), 'km/h', null],
  [/^\s*%/u, '%', null],
  [new RegExp(`^\\s*(?:ha|hectares?)${SEM_LETRA_DEPOIS}`, 'iu'), 'ha', null],
  [new RegExp(`^\\s*(?:l|litros?)${SEM_LETRA_DEPOIS}`, 'iu'), 'l', null],
  [new RegExp(`^\\s*(?:min|minutos?)${SEM_LETRA_DEPOIS}`, 'iu'), 'tempo', 'min'],
  [new RegExp(`^\\s*(?:h|horas?)${SEM_LETRA_DEPOIS}`, 'iu'), 'tempo', 'h'],
  [new RegExp(`^\\s*(?:m|metros?)${SEM_LETRA_DEPOIS}`, 'iu'), 'm', null],
  [new RegExp(`^\\s*(?:°\\s*c?|rpm|kpa|v|kg|t|km|mil|vezes|x|reais)${SEM_LETRA_DEPOIS}`, 'iu'), 'outra', null],
];
/** Contagem de tempo ("45 dias", "12 meses") não é medição da fazenda. */
const TEMPO_CONTADO = new RegExp(`^\\s*(?:dias?|meses|mês|semanas?|anos?)${SEM_LETRA_DEPOIS}`, 'iu');

function lerNumero(escrito: string): { valor: number; casas: number } {
  const comMilhar = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(escrito);
  const limpo = comMilhar ? escrito.replace(/\./g, '').replace(',', '.') : escrito.replace(',', '.');
  const casas = limpo.includes('.') ? limpo.split('.')[1]!.length : 0;
  return { valor: Number(limpo), casas };
}

const arredondar = (valor: number, casas: number) => Math.round(valor * 10 ** casas) / 10 ** casas;
const igual = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** A medida de um campo do dado, pelo nome dele. */
function classeDaChave(chave: string): { classe: Classe | null; tempo: 'h' | 'min' | null } {
  if (/LPorHa$/i.test(chave)) return { classe: 'l/ha', tempo: null };
  if (/LPorHora$/i.test(chave)) return { classe: 'l/h', tempo: null };
  if (/litros|combustivelL$/i.test(chave)) return { classe: 'l', tempo: null };
  if (/Pct$|percentual/i.test(chave)) return { classe: '%', tempo: null };
  if (/KmH$/i.test(chave)) return { classe: 'km/h', tempo: null };
  if (/Ha$/.test(chave) || /^area/i.test(chave)) return { classe: 'ha', tempo: null };
  if (/Min$|minutos/i.test(chave)) return { classe: 'tempo', tempo: 'min' };
  if (/^horas|Horas|[a-z]H$|horimetro/.test(chave)) return { classe: 'tempo', tempo: 'h' };
  if (/larguraM$|[a-z]M$/.test(chave)) return { classe: 'm', tempo: null };
  return { classe: null, tempo: null };
}

/** A medida de um item da análise da máquina, pela unidade que ele traz ("L/h", "%", "h", "rpm"...). */
function classeDaUnidade(unidade: string): { classe: Classe | null; tempo: 'h' | 'min' | null } {
  const u = unidade.trim().toLowerCase();
  if (u === 'l/ha') return { classe: 'l/ha', tempo: null };
  if (u === 'l/h') return { classe: 'l/h', tempo: null };
  if (u === 'l') return { classe: 'l', tempo: null };
  if (u === '%') return { classe: '%', tempo: null };
  if (u === 'km/h') return { classe: 'km/h', tempo: null };
  if (u === 'ha') return { classe: 'ha', tempo: null };
  if (u === 'h') return { classe: 'tempo', tempo: 'h' };
  if (u === 'min') return { classe: 'tempo', tempo: 'min' };
  return { classe: u ? 'outra' : null, tempo: null };
}

/** A medida que um cabeçalho de tabela (ou o rótulo da linha) anuncia: "Litros", "L/h", "Horas", "Área (ha)". */
function classeDoRotulo(rotulo: string): { classe: Classe | null; tempo: 'h' | 'min' | null } {
  const r = rotulo.toLowerCase();
  if (/l\s*\/\s*ha/.test(r)) return { classe: 'l/ha', tempo: null };
  if (/l\s*\/\s*h/.test(r) || /consumo.*hora/.test(r)) return { classe: 'l/h', tempo: null };
  if (/km\s*\/\s*h|velocidade/.test(r)) return { classe: 'km/h', tempo: null };
  if (/%|varia/.test(r)) return { classe: '%', tempo: null };
  if (/litro|combust|(?<![\p{L}\d])l(?![\p{L}\d])/u.test(r)) return { classe: 'l', tempo: null };
  if (/área|area|hectare|(?<![\p{L}\d])ha(?![\p{L}\d])/u.test(r)) return { classe: 'ha', tempo: null };
  if (/min/.test(r)) return { classe: 'tempo', tempo: 'min' };
  if (/hora|parad|ocios|tempo|(?<![\p{L}\d])h(?![\p{L}\d])/u.test(r)) return { classe: 'tempo', tempo: null };
  return { classe: null, tempo: null };
}

// ---------------------------------------------------------------------------------------------------------------------
// O que o servidor entregou: cada número, com a medida, de quem é e de que período
// ---------------------------------------------------------------------------------------------------------------------

type Faixa = { inicio: string; fim: string };
interface Folha {
  valor: number;
  classe: Classe | null;
  tempo: 'h' | 'min' | null;
  /** Nomes (normalizados) da máquina, do talhão etc. a que o número pertence. Vazio = é da fazenda inteira. */
  nomes: string[];
  /** Período a que o número se refere. Nulo = estado de agora, sem período. */
  periodos: Faixa[] | null;
  /** Saiu de uma conta feita pelo servidor nesta resposta: não pertence a uma máquina nem a um período. */
  calculado?: boolean;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const ehDia = (v: unknown): v is string => typeof v === 'string' && DIA.test(v);
const normalizar = (nome: string) => nome.toLowerCase().replace(/[\s\-–—]+/g, ' ').trim();
const fimDoMes = (mes: string) => {
  const d = new Date(`${mes}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
};
const diasDa = (f: Faixa) => Math.round((Date.parse(`${f.fim}T12:00:00Z`) - Date.parse(`${f.inicio}T12:00:00Z`)) / 86_400_000) + 1;

interface Contexto {
  chave: string;
  nomes: string[];
  periodos: Faixa[] | null;
  anterior: Faixa | null;
  unidade: { classe: Classe | null; tempo: 'h' | 'min' | null } | null;
}

function colherFolhas(dado: unknown, hoje: string, folhas: Folha[], nomes: Set<string>, ctx: Contexto = { chave: '', nomes: [], periodos: null, anterior: null, unidade: null }): void {
  if (typeof dado === 'number' && Number.isFinite(dado)) {
    const medida = ctx.unidade && (ctx.chave === 'valor' || ctx.chave === 'faixas') ? ctx.unidade : ctx.chave === 'variacaoPct' ? { classe: '%' as Classe, tempo: null } : classeDaChave(ctx.chave);
    folhas.push({ valor: dado, classe: medida.classe, tempo: medida.tempo, nomes: ctx.nomes, periodos: ctx.periodos });
    return;
  }
  if (Array.isArray(dado)) {
    for (const item of dado) colherFolhas(item, hoje, folhas, nomes, ctx);
    return;
  }
  if (!dado || typeof dado !== 'object') return;
  const o = dado as Record<string, unknown>;

  // De quem é: o objeto que tem nome (máquina, talhão) é dono de tudo que está dentro dele.
  let dosNomes = ctx.nomes;
  for (const chave of ['nome', 'maquinaNome', 'maquina'] as const) {
    const nome = o[chave];
    if (typeof nome === 'string' && nome.trim()) {
      const n = normalizar(nome);
      nomes.add(n);
      if (!dosNomes.includes(n)) dosNomes = [...dosNomes, n];
      break;
    }
  }
  // De quando é: relatório (inicio/fim), mês do histórico, dia da série, análise (de/ate).
  let periodos = ctx.periodos;
  if (ehDia(o.inicio) && ehDia(o.fim)) periodos = [{ inicio: o.inicio, fim: o.fim }];
  else if (ehDia(o.de) && ehDia(o.ate)) periodos = [{ inicio: o.de, fim: o.ate }];
  else if (typeof o.mes === 'string' && /^\d{4}-\d{2}$/.test(o.mes)) periodos = [{ inicio: `${o.mes}-01`, fim: fimDoMes(o.mes) }];
  else if (ehDia(o.dia)) periodos = [{ inicio: o.dia, fim: o.dia }];
  else if (ehDia(o.desde) && ehDia(o.ate)) periodos = [{ inicio: o.desde, fim: o.ate }];
  const anterior = ehDia(o.anteriorInicio) && ehDia(o.anteriorFim) ? { inicio: o.anteriorInicio, fim: o.anteriorFim } : ctx.anterior;
  const unidade = typeof o.unidade === 'string' ? classeDaUnidade(o.unidade) : ctx.unidade;

  for (const [chave, valor] of Object.entries(o)) {
    // "valor", "anterior" e "diferenca" são do indicador que os contém (areaHa: { valor, anterior }).
    const semantica = ['valor', 'anterior', 'diferenca'].includes(chave) && !unidade ? ctx.chave : chave;
    let doCampo = periodos;
    if (chave === 'anterior' && anterior) doCampo = [anterior];
    else if ((chave === 'diferenca' || chave === 'variacaoPct') && anterior) doCampo = [...(periodos ?? []), anterior];
    else if (/Hoje$/.test(chave) && !ehDia(o.inicio)) doCampo = [{ inicio: hoje, fim: hoje }];
    const chaveDoFilho = chave === 'variacaoPct' ? 'variacaoPct' : unidade && (chave === 'valor' || chave === 'faixas') ? chave : semantica;
    colherFolhas(valor, hoje, folhas, nomes, { chave: chaveDoFilho, nomes: dosNomes, periodos: doCampo, anterior, unidade });
  }
}

/** Hora local (Brasília) de cada instante ISO que aparece nos dados: o modelo pode dizer "às 08:04". */
function horariosDe(fonte: string): Set<string> {
  const horarios = new Set<string>();
  for (const [iso] of fonte.matchAll(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})/g)) {
    const instante = new Date(iso);
    if (Number.isNaN(instante.getTime())) continue;
    horarios.add(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false }).format(instante).replace(/^24/, '00'));
  }
  for (const [, h, m] of fonte.matchAll(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/g)) horarios.add(`${h!.padStart(2, '0')}:${m}`);
  return horarios;
}

// ---------------------------------------------------------------------------------------------------------------------
// De quem e de quando a frase fala
// ---------------------------------------------------------------------------------------------------------------------

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** A frase fala da fazenda inteira (e não só da máquina citada). */
const DA_FAZENDA = /fazenda|granja|frota|(?<![\p{L}])tota(?:l|is)(?![\p{L}])|ao todo|no geral|somad|todas as máquinas|as máquinas juntas|geral/iu;
/** A frase fala de um período longo (o ano, vários meses): não prende o número a um mês. */
const PERIODO_LONGO = /(?<![\p{L}])ano(?![\p{L}])|período|acumulad|até agora|até hoje|desde |\d+\s*meses|últimos meses|todos os meses/iu;

type Mencao = { tipo: 'faixa'; faixa: Faixa } | { tipo: 'semana' } | { tipo: 'mes-qualquer' } | { tipo: 'longo' };

const dois = (n: number) => String(n).padStart(2, '0');
const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const mesAntes = (mes: string) => {
  const d = new Date(`${mes}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};

/** Os períodos que o texto cita: mês pelo nome, datas, hoje, ontem, semana. */
function mencoesDePeriodo(texto: string, hoje: string): Mencao[] {
  const t = texto.toLowerCase();
  const mencoes: Mencao[] = [];
  const anoDeHoje = Number(hoje.slice(0, 4));
  MESES.forEach((nome, i) => {
    for (const m of t.matchAll(new RegExp(`(?<![\\p{L}])${nome}(?![\\p{L}])(?:\\s+(?:de\\s+)?(\\d{4}))?`, 'giu'))) {
      // Sem o ano escrito: o mais recente que já aconteceu.
      const ano = m[1] ? Number(m[1]) : `${anoDeHoje}-${dois(i + 1)}` <= hoje.slice(0, 7) ? anoDeHoje : anoDeHoje - 1;
      const mes = `${ano}-${dois(i + 1)}`;
      mencoes.push({ tipo: 'faixa', faixa: { inicio: `${mes}-01`, fim: fimDoMes(mes) } });
    }
  });
  // Dois meses na mesma frase ("de janeiro a novembro") também valem como o intervalo inteiro.
  if (mencoes.length >= 2) {
    const faixas = mencoes.flatMap((m) => (m.tipo === 'faixa' ? [m.faixa] : []));
    mencoes.push({ tipo: 'faixa', faixa: { inicio: faixas.map((f) => f.inicio).sort()[0]!, fim: faixas.map((f) => f.fim).sort().at(-1)! } });
  }
  for (const m of t.matchAll(/(?<!\d)(\d{4})-(\d{2})(?!-?\d)/g)) mencoes.push({ tipo: 'faixa', faixa: { inicio: `${m[1]}-${m[2]}-01`, fim: fimDoMes(`${m[1]}-${m[2]}`) } });
  const dias: string[] = [];
  for (const m of t.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) dias.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of t.matchAll(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?(?![\d/])/g)) {
    const [d, mes] = [Number(m[1]), Number(m[2])];
    if (d < 1 || d > 31 || mes < 1 || mes > 12) continue;
    const ano = m[3] ? Number(m[3]) : `${anoDeHoje}-${dois(mes)}-${dois(d)}` <= hoje ? anoDeHoje : anoDeHoje - 1;
    dias.push(`${ano}-${dois(mes)}-${dois(d)}`);
  }
  if (/(?<![\p{L}])hoje(?![\p{L}])/u.test(t)) dias.push(hoje);
  if (/(?<![\p{L}])ontem(?![\p{L}])/u.test(t)) dias.push(somarDias(hoje, -1));
  // Duas datas na mesma frase ("de 01/10 a 31/10") formam um intervalo.
  if (dias.length >= 2) {
    const ordenados = [...dias].sort();
    mencoes.push({ tipo: 'faixa', faixa: { inicio: ordenados[0]!, fim: ordenados.at(-1)! } });
  }
  for (const dia of dias) mencoes.push({ tipo: 'faixa', faixa: { inicio: dia, fim: dia } });
  if (/este mês|neste mês|mês atual|no mês até/u.test(t)) mencoes.push({ tipo: 'faixa', faixa: { inicio: `${hoje.slice(0, 7)}-01`, fim: fimDoMes(hoje.slice(0, 7)) } });
  if (/mês passado|mês anterior|último mês/u.test(t)) {
    const mes = mesAntes(hoje.slice(0, 7));
    mencoes.push({ tipo: 'faixa', faixa: { inicio: `${mes}-01`, fim: fimDoMes(mes) } });
    // "contra o mês anterior" numa frase sobre outro mês: o anterior daquele mês, que só o dado sabe.
    mencoes.push({ tipo: 'mes-qualquer' });
  }
  if (/semana|7 dias|sete dias/u.test(t)) mencoes.push({ tipo: 'semana' });
  if (/período anterior|dia anterior|véspera|anteontem/u.test(t)) mencoes.push({ tipo: 'longo' });
  if (PERIODO_LONGO.test(t)) mencoes.push({ tipo: 'longo' });
  if (mencoes.length === 0 && /(?<![\p{L}])m[eê]s(?:es)?(?![\p{L}])/u.test(t)) mencoes.push({ tipo: 'mes-qualquer' });
  return mencoes;
}

function periodoBate(folha: Folha, mencoes: Mencao[], hoje: string): boolean {
  if (!folha.periodos || mencoes.length === 0) return true;
  return folha.periodos.some((f) =>
    mencoes.some((m) => {
      if (m.tipo === 'longo') return true;
      if (m.tipo === 'semana') return diasDa(f) >= 5 && diasDa(f) <= 8;
      if (m.tipo === 'mes-qualquer') return diasDa(f) > 8 && diasDa(f) <= 31;
      const pedido = m.faixa;
      // Um dia citado: só o número daquele dia. Um mês (ou intervalo): o período do número tem que estar dentro dele.
      if (pedido.inicio === pedido.fim) return f.inicio === pedido.inicio && f.fim === pedido.fim;
      // O número de UM dia do mês não é o número do mês: o período dele tem que começar junto (mês inteiro ou mês até hoje).
      return f.inicio === pedido.inicio && f.fim <= pedido.fim && (diasDa(f) > 1 || f.fim === hoje);
    }),
  );
}

/** Quais dos nomes conhecidos (máquinas, talhões) o texto cita. "8270R-23", "8270R – 23" e "8270R 23" são o mesmo nome. */
function nomesCitados(texto: string, nomes: Map<string, RegExp>): string[] {
  const citados: string[] = [];
  for (const [nome, padrao] of nomes) if (padrao.test(texto)) citados.push(nome);
  // "8270R - 2" não é citado só porque "8270R - 23" foi: o padrão já exige que o nome termine ali.
  return citados;
}

function padraoDoNome(nome: string): RegExp | null {
  const partes = nome.split(' ').filter(Boolean);
  if (partes.length === 0) return null;
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\d])${partes.map(escapar).join('[\\s\\-–—]*')}(?![\\p{L}\\d])`, 'iu');
}

// ---------------------------------------------------------------------------------------------------------------------
// A resposta, pedaço por pedaço
// ---------------------------------------------------------------------------------------------------------------------

interface Pedaco {
  /** O texto em que os números são procurados. */
  texto: string;
  /** Do mais perto para o mais longe: o próprio pedaço, o que veio antes no bloco, o parágrafo de abertura, o título, a pergunta. */
  niveis: string[];
  /** Medida anunciada pela coluna ou pela linha da tabela, para célula sem unidade. */
  medida: { classe: Classe | null; tempo: 'h' | 'min' | null };
}

function pedacosDa(resposta: string, pergunta: string): Pedaco[] {
  const pedacos: Pedaco[] = [];
  const linhas = resposta.replace(/\r/g, '').replace(/\*\*/g, '').split('\n');
  let titulo = '';
  let abertura = '';
  let i = 0;
  const semMedida = { classe: null, tempo: null } as const;
  while (i < linhas.length) {
    const linha = linhas[i]!.trim();
    if (!linha) {
      i++;
      continue;
    }
    if (linha.startsWith('|')) {
      const daTabela: string[] = [];
      while (i < linhas.length && linhas[i]!.trim().startsWith('|')) daTabela.push(linhas[i++]!.trim());
      const celulas = (l: string) => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const [cabecalho, ...corpo] = daTabela.filter((l) => !/^\|?\s*:?-{2,}/.test(l)).map(celulas);
      if (!cabecalho) continue;
      for (const linhaDaTabela of corpo) {
        const rotulo = linhaDaTabela[0] ?? '';
        linhaDaTabela.forEach((celula, n) => {
          if (n === 0) return pedacos.push({ texto: celula, niveis: [celula, abertura, titulo, pergunta], medida: semMedida });
          const coluna = cabecalho[n] ?? '';
          const daColuna = classeDoRotulo(coluna);
          // A linha inteira vai junto (para o período escrito em outra coluna), mas quem manda é o rótulo + a coluna.
          pedacos.push({ texto: celula, niveis: [`${rotulo} | ${coluna}`, abertura, titulo, pergunta], medida: daColuna.classe ? daColuna : classeDoRotulo(rotulo) });
        });
      }
      continue;
    }
    const comoTitulo = /^#{1,4}\s+(.*)$/.exec(linha);
    if (comoTitulo) {
      titulo = comoTitulo[1]!;
      abertura = '';
      pedacos.push({ texto: titulo, niveis: [titulo, pergunta], medida: semMedida });
      i++;
      continue;
    }
    const topico = /^(?:[-•*]|\d{1,2}[.)])\s+(.*)$/.exec(linha);
    const corpo = topico ? topico[1]! : linha;
    let antes = '';
    for (const frase of corpo.split(/(?<=[.!?;])\s+/)) {
      if (!frase.trim()) continue;
      pedacos.push({ texto: frase, niveis: [frase, antes, topico ? abertura : '', titulo, pergunta], medida: semMedida });
      antes = `${frase} ${antes}`;
    }
    if (!topico) abertura = corpo;
    i++;
  }
  return pedacos;
}

export interface FontesDaResposta {
  /** O retrato da fazenda e o resultado de cada consulta desta resposta, como objetos. */
  dados: unknown[];
  /** Textos em que basta o número existir: as regras do assistente e o que o usuário escreveu. */
  textos: string[];
  /** A pergunta que está sendo respondida: de quem e de quando ela fala vale para a resposta. */
  pergunta: string;
  /**
   * O que veio antes na conversa (perguntas e respostas já mostradas). Pergunta de continuação ("e essas 5,8 h?") não
   * repete a máquina nem o dia: quando nem a resposta nem a pergunta citam, vale de quem e de quando a conversa falava.
   * Só serve para saber DE QUEM e DE QUANDO; número da conversa não vira fonte.
   */
  contexto?: string;
  /** O que a pessoa escreveu agora (e na pergunta anterior): repetir um número que ela mesma disse é permitido, com ou sem unidade. */
  ditoPelaPessoa?: string[];
  /** Hoje (AAAA-MM-DD), horário de Brasília. */
  hoje: string;
  /** Resultado de cada conta que o servidor fez nesta resposta (ferramenta `calcular`). */
  calculos?: { valor: number; unidade?: string | null }[];
}

/** O número existe em algum lugar do que o servidor entregou ou do que a pessoa escreveu? (Para os operandos de uma conta.) */
export function existeNasFontes(valor: number, fontes: Pick<FontesDaResposta, 'dados' | 'textos' | 'hoje' | 'calculos'>): boolean {
  const alvo = Math.abs(valor);
  const casas = String(alvo).includes('.') ? String(alvo).split('.')[1]!.length : 0;
  if ((fontes.calculos ?? []).some((c) => igual(arredondar(Math.abs(c.valor), casas), alvo))) return true;
  for (const [escrito] of fontes.textos.join('\n').matchAll(NUMERO)) if (igual(lerNumero(escrito).valor, alvo)) return true;
  const folhas: Folha[] = [];
  for (const dado of fontes.dados) colherFolhas(dado, fontes.hoje, folhas, new Set());
  return folhas.some((f) => igual(arredondar(Math.abs(f.valor), casas), alvo));
}

/**
 * O que a resposta traz e não pode: cada item é o número como foi escrito e por que foi recusado. Vazio = pode mostrar.
 */
export function conferirResposta(resposta: string, fontes: FontesDaResposta): string[] {
  const folhas: Folha[] = [];
  const nomesConhecidos = new Set<string>();
  for (const dado of fontes.dados) colherFolhas(dado, fontes.hoje, folhas, nomesConhecidos);
  for (const conta of fontes.calculos ?? []) {
    // "R$" e unidade vazia não prendem a medida; as outras sim ("%", "L", "h"...).
    const medida = conta.unidade && !/^r\$?$/i.test(conta.unidade.trim()) ? classeDaUnidade(conta.unidade) : { classe: null, tempo: null };
    folhas.push({ valor: Math.abs(conta.valor), classe: medida.classe === 'outra' ? null : medida.classe, tempo: medida.tempo, nomes: [], periodos: null, calculado: true });
  }
  const padroes = new Map<string, RegExp>();
  for (const nome of nomesConhecidos) {
    const padrao = padraoDoNome(nome);
    if (padrao) padroes.set(nome, padrao);
  }
  const livres = fontes.textos.join('\n');
  const numerosLivres = new Set<number>();
  for (const [escrito] of livres.matchAll(NUMERO)) numerosLivres.add(lerNumero(escrito).valor);
  const ditos = new Set<number>();
  for (const [escrito] of (fontes.ditoPelaPessoa ?? []).join('\n').matchAll(NUMERO)) ditos.add(lerNumero(escrito).valor);
  const horarios = horariosDe(`${JSON.stringify(fontes.dados)}\n${livres}`);
  // "o trator 24", "a máquina 24": o jeito de falar de quem está no campo. Vale como citar a máquina cujo nome termina
  // nesse número, se só uma termina assim.
  const porNumero = new Map<string, string[]>();
  for (const nome of padroes.keys()) {
    const fim = nome.match(/(\d+)\s*$/)?.[1];
    if (fim) porNumero.set(fim, [...(porNumero.get(fim) ?? []), nome]);
  }
  for (const [fim, nomes] of porNumero) {
    if (nomes.length !== 1) continue;
    const proprio = padroes.get(nomes[0]!)!;
    padroes.set(nomes[0]!, new RegExp(`${proprio.source}|(?<![\\p{L}\\d])(?:trator|m[aá]quina|colheitadeira|pulverizador)\\s+(?:n[º°o.]?\\s*)?${fim}(?![\\p{L}\\d,.])`, 'iu'));
  }

  const problemas: string[] = [];
  const recusar = (escrito: string, motivo: string) => {
    const item = `${escrito.trim()} (${motivo})`;
    if (!problemas.includes(item)) problemas.push(item);
  };

  for (const pedaco of pedacosDa(resposta, fontes.pergunta)) {
    // De quem fala: o nível mais perto que cita algum nome. Se o próprio pedaço fala da fazenda sem citar ninguém, é da fazenda.
    const proprio = pedaco.niveis[0] ?? '';
    const daFazenda = DA_FAZENDA.test(proprio);
    let citados: string[] = [];
    const niveis = [...pedaco.niveis, fontes.contexto ?? ''];
    for (const nivel of niveis) {
      citados = nivel ? nomesCitados(nivel, padroes) : [];
      if (citados.length > 0 || (nivel === proprio && daFazenda)) break;
    }
    let mencoes: Mencao[] = [];
    for (const nivel of niveis) {
      mencoes = nivel ? mencoesDePeriodo(nivel, fontes.hoje) : [];
      if (mencoes.length > 0) break;
    }

    const serve = (folha: Folha) => {
      // A conta foi feita pelo servidor com números já conferidos: vale em qualquer frase.
      if (folha.calculado) return { deQuem: true, deQuando: true };
      const deQuem = folha.nomes.every((n) => citados.includes(n)) && (folha.nomes.length > 0 || citados.length === 0 || daFazenda);
      return { deQuem, deQuando: periodoBate(folha, mencoes, fontes.hoje) };
    };
    /** Confere um número já lido. `bateValor` diz se uma folha tem esse valor (com a conversão da medida). */
    const conferir = (escrito: string, classe: Classe | null, bateValor: (folha: Folha) => boolean, livre: boolean) => {
      if (livre) return;
      const comValor = folhas.filter((f) => bateValor(f));
      if (comValor.length === 0) return recusar(escrito, 'não existe nos dados');
      const daMedida = comValor.filter((f) => classe === null || f.classe === null || f.classe === classe);
      if (daMedida.length === 0) return recusar(escrito, 'existe nos dados, mas em outra medida');
      const resultados = daMedida.map(serve);
      if (resultados.some((r) => r.deQuem && r.deQuando)) return;
      if (!resultados.some((r) => r.deQuem)) return recusar(escrito, citados.length > 0 ? `não é de ${citados.join(' / ')} nos dados` : 'é de uma máquina ou talhão que a frase não cita');
      return recusar(escrito, 'é de outro período, não do que a frase cita');
    };

    let texto = pedaco.texto;
    // O número que faz parte de um nome ("8270R - 23", "Talhão 3") não é medição: some antes da leitura.
    for (const padrao of padroes.values()) texto = texto.replace(new RegExp(padrao.source, 'giu'), (m) => ' '.repeat(m.length));
    const consumir = (padrao: RegExp, tratar: (m: string[]) => void) => {
      texto = texto.replace(padrao, (...args) => {
        const m = args.slice(0, -2) as string[];
        tratar(m);
        return ' '.repeat(m[0]!.length);
      });
    };
    // Horário "08:04".
    consumir(/(?<!\d)(\d{1,2}):(\d{2})(?!\d)/g, (m) => {
      if (!horarios.has(`${m[1]!.padStart(2, '0')}:${m[2]}`)) recusar(m[0]!, 'horário que não existe nos dados');
    });
    // "68h58", "68 h 58 min", "1 h 30": duração (ou horário escrito com h).
    consumir(/(?<![\d,.])(\d{1,5})\s*h\s*(?:e\s*)?(\d{1,2})(?:\s*min(?:utos)?)?(?![\d,.])/gi, (m) => {
      const [h, min] = [Number(m[1]), Number(m[2])];
      if (min >= 60) return recusar(m[0]!, 'duração inválida');
      if (horarios.has(`${dois(h)}:${dois(min)}`)) return;
      const total = h * 60 + min;
      conferir(m[0]!, 'tempo', (f) => (f.tempo === 'min' ? Math.round(f.valor) === total : f.tempo === 'h' ? Math.abs(f.valor * 60 - total) <= 3 : Math.round(f.valor) === total || Math.abs(f.valor * 60 - total) <= 3), numerosLivres.has(total));
    });

    for (const m of texto.matchAll(NUMERO)) {
      const { valor, casas } = lerNumero(m[0]);
      const depois = texto.slice(m.index + m[0].length, m.index + m[0].length + 14);
      const achada = UNIDADES.find(([padrao]) => padrao.test(depois));
      // Colado em letra sem ser unidade ("S550", "6M", "T7"): é um código, não uma medição.
      if (!achada && (/^\p{L}/u.test(depois) || /\p{L}$/u.test(texto.slice(0, m.index)))) continue;
      const classe: Classe | null = achada ? achada[1] : pedaco.medida.classe;
      const tempo = achada ? achada[2] : pedaco.medida.tempo;
      const escrito = `${m[0]}${achada ? ` ${depois.match(achada[0])![0].trim()}` : ''}`;
      if (!achada && !pedaco.medida.classe && casas === 0) {
        if (valor <= CONTAGEM_MAXIMA) continue;
        // Ano ("2025") e contagem de tempo ("45 dias") também não são medição.
        if ((valor >= 2000 && valor <= 2100) || (valor <= 366 && TEMPO_CONTADO.test(depois))) continue;
      }
      const redondo = (f: Folha) => igual(arredondar(f.valor, casas), valor);
      const bate = (f: Folha) => {
        if (classe !== 'tempo') return redondo(f);
        // "45 min" de 0,75 h; "2,5 h" de 150 min; coluna "Horas" sem unidade na célula.
        if (tempo === 'min') return f.tempo === 'h' ? Math.abs(f.valor * 60 - valor) <= 3 : redondo(f);
        if (tempo === 'h') return f.tempo === 'min' ? igual(arredondar(f.valor / 60, casas), valor) : redondo(f);
        return redondo(f) || (f.tempo === 'min' && igual(arredondar(f.valor / 60, casas), valor));
      };
      conferir(escrito, classe, bate, (numerosLivres.has(valor) && !achada) || ditos.has(valor));
    }
  }
  return problemas;
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
