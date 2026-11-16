/**
 * Lê a resposta do assistente e separa em blocos para desenhar: parágrafo, título, tópicos e tabela.
 * O servidor só deixa o modelo usar **negrito**, "## título", "- tópico" e tabela com "|". Qualquer outra coisa
 * aparece como texto comum. Funciona com a resposta pela metade (ela chega aos poucos): marcação ainda aberta
 * vira texto simples, sem símbolos soltos na tela.
 */

/** Pedaço de uma linha: texto comum ou em destaque. */
export type Trecho = { texto: string; forte: boolean };

export type Bloco =
  | { tipo: 'paragrafo'; trechos: Trecho[] }
  | { tipo: 'titulo'; trechos: Trecho[] }
  | { tipo: 'topicos'; itens: { marca: string | null; trechos: Trecho[] }[] }
  | { tipo: 'tabela'; colunas: string[]; linhas: Trecho[][][] };

/** Separa o **negrito**. Asterisco que sobrar (marcação ainda sem fechar) some. */
export function lerTrechos(linha: string): Trecho[] {
  const trechos: Trecho[] = [];
  let resto = linha;
  for (;;) {
    const abre = resto.indexOf('**');
    const fecha = abre < 0 ? -1 : resto.indexOf('**', abre + 2);
    if (abre < 0 || fecha < 0) break;
    if (abre > 0) trechos.push({ texto: resto.slice(0, abre), forte: false });
    const dentro = resto.slice(abre + 2, fecha);
    if (dentro) trechos.push({ texto: dentro, forte: true });
    resto = resto.slice(fecha + 2);
  }
  const final = resto.replace(/\*\*/g, '');
  if (final) trechos.push({ texto: final, forte: false });
  return trechos;
}

const TITULO = /^#{1,4}\s+(.*)$/;
const TOPICO = /^(?:[-•*]|(\d{1,2})[.)])\s+(.*)$/;
const SEPARADOR_DE_TABELA = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

const celulas = (linha: string) =>
  linha
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

export function lerBlocos(texto: string): Bloco[] {
  const blocos: Bloco[] = [];
  const linhas = texto.replace(/\r/g, '').split('\n');
  let paragrafo: string[] = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push({ tipo: 'paragrafo', trechos: lerTrechos(paragrafo.join('\n')) });
    paragrafo = [];
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!.trim();
    if (!linha) {
      fecharParagrafo();
      continue;
    }

    // Tabela: linhas seguidas que começam com "|". A segunda (|---|---|) só separa o cabeçalho.
    if (linha.startsWith('|')) {
      const daTabela: string[] = [];
      while (i < linhas.length && linhas[i]!.trim().startsWith('|')) daTabela.push(linhas[i++]!.trim());
      i--;
      const semSeparador = daTabela.filter((l) => !SEPARADOR_DE_TABELA.test(l));
      const [cabecalho, ...corpo] = semSeparador;
      if (cabecalho) {
        fecharParagrafo();
        const colunas = celulas(cabecalho).map((c) => c.replace(/\*\*/g, ''));
        // Linha pela metade (a resposta ainda está chegando) é completada com vazio; coluna a mais é cortada.
        const completar = (l: string) => {
          const lidas = celulas(l);
          return colunas.map((_, n) => lerTrechos(lidas[n] ?? ''));
        };
        blocos.push({ tipo: 'tabela', colunas, linhas: corpo.map(completar) });
      }
      continue;
    }

    const titulo = TITULO.exec(linha);
    if (titulo) {
      fecharParagrafo();
      blocos.push({ tipo: 'titulo', trechos: lerTrechos(titulo[1]!.replace(/\*\*/g, '')) });
      continue;
    }

    const topico = TOPICO.exec(linha);
    if (topico) {
      fecharParagrafo();
      const item = { marca: topico[1] ?? null, trechos: lerTrechos(topico[2]!) };
      const anterior = blocos.at(-1);
      if (anterior?.tipo === 'topicos') anterior.itens.push(item);
      else blocos.push({ tipo: 'topicos', itens: [item] });
      continue;
    }

    // Linha separadora ("---") não é desenhada.
    if (/^[-_*]{3,}$/.test(linha)) {
      fecharParagrafo();
      continue;
    }
    paragrafo.push(linha);
  }
  fecharParagrafo();
  return blocos;
}

/** A célula é número (com unidade ou sem)? Número fica alinhado à direita, com algarismos de mesma largura. */
export const ehNumero = (celula: string) => /^[-+−]?\s*[\d.,]+\s*(%|h|ha|L|L\/h|L\/ha|km\/h|min|km|m|°C|rpm)?$/i.test(celula.trim()) || celula.trim() === '—';
