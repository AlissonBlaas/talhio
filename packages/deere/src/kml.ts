import { areaHa, fechar, type FazendaImportada } from './gen4';
import type { TalhaoExterno } from './tipos';

/**
 * Leitor de KML (Google Earth e a maioria dos programas de mapa): cada `Placemark` com `Polygon` vira um talhão, com
 * o nome do marcador e o anel de fora como contorno. Pontos, linhas e buracos dentro do polígono são ignorados.
 * Função pura: recebe o texto dos arquivos .kml (o .kmz é um zip com um .kml dentro; quem abre o zip é quem chama).
 */

const limpar = (texto: string) =>
  texto
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/** Conteúdo de cada `<nome>...</nome>` (aceita prefixo, ex.: `<kml:Placemark>`). */
function blocos(xml: string, nome: string): string[] {
  const re = new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nome}>`, 'g');
  return [...xml.matchAll(re)].map((m) => m[1] ?? '');
}

/** "lng,lat[,alt] lng,lat[,alt] ..." -> [lng, lat][]; ponto fora do mundo é descartado. */
function coordenadas(texto: string): [number, number][] {
  const pontos: [number, number][] = [];
  for (const trio of texto.trim().split(/\s+/)) {
    const [lng, lat] = trio.split(',').map(Number);
    if (lng === undefined || lat === undefined || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (Math.abs(lng) > 180 || Math.abs(lat) > 90) continue;
    pontos.push([lng, lat]);
  }
  return pontos;
}

/** Identificador estável: o mesmo talhão do mesmo arquivo recebe o mesmo id se for importado de novo. */
function idDe(nome: string, contorno: [number, number][]): string {
  let h = 2166136261;
  for (const c of `${nome}|${contorno[0]?.join(',') ?? ''}|${contorno.length}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `kml-${h.toString(36)}`;
}

export function lerKml(arquivos: string[]): FazendaImportada {
  const talhoes: TalhaoExterno[] = [];
  let cliente: string | null = null;
  for (const xml of arquivos) {
    // O nome do documento (ou da primeira pasta) é o que mais se parece com o nome da fazenda.
    const cabecalho = xml.slice(0, xml.search(/<(?:\w+:)?Placemark[\s>]/) >>> 0 || xml.length);
    cliente ??= limpar(blocos(cabecalho, 'name')[0] ?? '') || null;
    for (const marcador of blocos(xml, 'Placemark')) {
      const nomeDoMarcador = limpar(blocos(marcador, 'name')[0] ?? '');
      const poligonos = blocos(marcador, 'Polygon');
      poligonos.forEach((poligono, i) => {
        const fora = blocos(poligono, 'outerBoundaryIs')[0] ?? poligono;
        const anel = coordenadas(limpar(blocos(fora, 'coordinates')[0] ?? ''));
        // Tira o ponto de fechamento repetido antes de contar os cantos.
        const cantos = anel.length > 1 && anel[0]![0] === anel.at(-1)![0] && anel[0]![1] === anel.at(-1)![1] ? anel.slice(0, -1) : anel;
        if (cantos.length < 3) return;
        const contorno = fechar(cantos);
        const area = Math.round(areaHa(contorno) * 10) / 10;
        if (area <= 0) return;
        const base = nomeDoMarcador || `Talhão ${talhoes.length + 1}`;
        const nome = poligonos.length > 1 ? `${base} (${i + 1})` : base;
        talhoes.push({ id: idDe(nome, contorno), nome, cultura: null, areaHa: area, contorno });
      });
    }
  }
  return { cliente: cliente ?? 'Fazenda', talhoes, linhas: [] };
}
