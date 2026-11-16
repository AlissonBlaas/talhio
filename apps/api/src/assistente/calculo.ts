/**
 * Conta pedida pelo assistente. O modelo não faz conta de cabeça: manda a expressão, o servidor calcula. Só aceita
 * números, + - * / e parênteses; nada é executado como código.
 */

export class ContaInvalida extends Error {}

/** "1.234,5" e "1234.5" viram 1234.5. */
function lerOperando(escrito: string): number {
  const br = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(escrito) || escrito.includes(',');
  const valor = Number(br ? escrito.replace(/\./g, '').replace(',', '.') : escrito);
  if (!Number.isFinite(valor)) throw new ContaInvalida(`Número inválido: ${escrito}`);
  return valor;
}

type Peca = { tipo: 'numero'; valor: number } | { tipo: 'sinal'; sinal: '+' | '-' | '*' | '/' | '(' | ')' };

function separar(expressao: string): Peca[] {
  const pecas: Peca[] = [];
  const texto = expressao.replace(/\s+/g, '').replace(/[×x]/gi, '*').replace(/÷/g, '/').replace(/−/g, '-');
  let i = 0;
  while (i < texto.length) {
    const c = texto[i]!;
    if ('+-*/()'.includes(c)) {
      pecas.push({ tipo: 'sinal', sinal: c as '+' });
      i++;
      continue;
    }
    const numero = /^(?:\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?)/.exec(texto.slice(i));
    if (!numero) throw new ContaInvalida(`Não entendi "${texto.slice(i, i + 12)}". Use só números, + - * / e parênteses.`);
    pecas.push({ tipo: 'numero', valor: lerOperando(numero[0]) });
    i += numero[0].length;
  }
  return pecas;
}

/** Calcula a expressão. Devolve o resultado e os números que entraram nela. */
export function calcular(expressao: string): { resultado: number; operandos: number[] } {
  if (expressao.length > 300) throw new ContaInvalida('Expressão longa demais.');
  const pecas = separar(expressao);
  if (pecas.length === 0) throw new ContaInvalida('Expressão vazia.');
  let pos = 0;
  const ve = (sinal: string) => {
    const p = pecas[pos];
    return p?.tipo === 'sinal' && p.sinal === sinal;
  };
  const fator = (): number => {
    const p = pecas[pos];
    if (!p) throw new ContaInvalida('A expressão terminou antes da hora.');
    if (p.tipo === 'numero') {
      pos++;
      return p.valor;
    }
    if (p.sinal === '-') {
      pos++;
      return -fator();
    }
    if (p.sinal === '+') {
      pos++;
      return fator();
    }
    if (p.sinal === '(') {
      pos++;
      const dentro = soma();
      if (!ve(')')) throw new ContaInvalida('Faltou fechar um parêntese.');
      pos++;
      return dentro;
    }
    throw new ContaInvalida(`Sinal fora de lugar: ${p.sinal}`);
  };
  const produto = (): number => {
    let valor = fator();
    while (ve('*') || ve('/')) {
      const dividir = ve('/');
      pos++;
      const outro = fator();
      if (dividir && outro === 0) throw new ContaInvalida('Divisão por zero.');
      valor = dividir ? valor / outro : valor * outro;
    }
    return valor;
  };
  function soma(): number {
    let valor = produto();
    while (ve('+') || ve('-')) {
      const menos = ve('-');
      pos++;
      const outro = produto();
      valor = menos ? valor - outro : valor + outro;
    }
    return valor;
  }
  const resultado = soma();
  if (pos < pecas.length) throw new ContaInvalida('Sobrou coisa no fim da expressão.');
  if (!Number.isFinite(resultado)) throw new ContaInvalida('A conta não deu um número.');
  return { resultado, operandos: pecas.flatMap((p) => (p.tipo === 'numero' ? [p.valor] : [])) };
}

/** Números que podem entrar numa conta sem vir dos dados: contagens pequenas e fatores de conversão. */
export const ehConstante = (valor: number) => (Number.isInteger(valor) && valor >= 0 && valor <= 31) || [60, 100, 365, 1000, 3600].includes(valor);
