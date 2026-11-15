import { z } from 'zod';
import { PosicaoSchema, type Poligono, type Posicao } from './geo';

/** Linha de guia (linha AB) do piloto automático. */
export const LinhaSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  /** Talhão a que a linha pertence. Nulo para linha padrão da fazenda vinda de fora. */
  talhaoId: z.string().nullable(),
  a: PosicaoSchema,
  b: PosicaoSchema,
  /** Direção da linha em graus, de 0 a 180 (0 = norte-sul, 90 = leste-oeste). */
  direcaoGraus: z.number().min(0).max(180),
  /** Linha salva como padrão da fazenda, para reaproveitar em outros talhões. */
  padraoDaFazenda: z.boolean(),
  /** reta = linha AB; curva = passadas prontas, ponto a ponto (vêm de arquivo ou do Operations Center). */
  tipo: z.enum(['reta', 'curva']),
  /** Só na curva: cada passada como lista de [lng, lat]. Nulo na reta (as passadas são calculadas). */
  passadas: z.array(z.array(z.tuple([z.number(), z.number()]))).nullable(),
});
export type Linha = z.infer<typeof LinhaSchema>;
export const ListaLinhasSchema = z.array(LinhaSchema);

export const NovaLinhaSchema = z.object({
  nome: z.string().trim().min(1, 'Dê um nome à linha').max(60),
  talhaoId: z.string().min(1),
  a: PosicaoSchema,
  b: PosicaoSchema,
  padraoDaFazenda: z.boolean().default(false),
});
export type NovaLinha = z.input<typeof NovaLinhaSchema>;

const M_POR_GRAU = 111_320;
type XY = { x: number; y: number };

/** Posição -> metros em relação a uma origem (plano local; bom para a escala de um talhão). */
function paraMetros(origem: Posicao, p: Posicao): XY {
  return {
    x: (p.lng - origem.lng) * M_POR_GRAU * Math.cos((origem.lat * Math.PI) / 180),
    y: (p.lat - origem.lat) * M_POR_GRAU,
  };
}

function deMetros(origem: Posicao, { x, y }: XY): Posicao {
  return {
    lat: origem.lat + y / M_POR_GRAU,
    lng: origem.lng + x / (M_POR_GRAU * Math.cos((origem.lat * Math.PI) / 180)),
  };
}

export function distanciaM(a: Posicao, b: Posicao): number {
  const d = paraMetros(a, b);
  return Math.hypot(d.x, d.y);
}

/** Direção da linha A-B, de 0 a 180 graus (0 = norte-sul, 90 = leste-oeste). */
export function direcaoGraus(a: Posicao, b: Posicao): number {
  const d = paraMetros(a, b);
  const graus = (Math.atan2(d.x, d.y) * 180) / Math.PI;
  return Math.round((((graus % 180) + 180) % 180) * 10) / 10;
}

/** Linha com a direção dada, passando pelo centro, com o comprimento informado. */
export function linhaPelaDirecao(centro: Posicao, graus: number, comprimentoM = 400): { a: Posicao; b: Posicao } {
  const r = (graus * Math.PI) / 180;
  const meio = comprimentoM / 2;
  const d = { x: Math.sin(r) * meio, y: Math.cos(r) * meio };
  return { a: deMetros(centro, { x: -d.x, y: -d.y }), b: deMetros(centro, d) };
}

/** Ponto médio dos cantos do contorno. */
export function centroDoPoligono(poligono: Poligono): Posicao {
  const anel = (poligono.coordinates[0] ?? []).slice(0, -1);
  const n = anel.length || 1;
  return { lng: anel.reduce((s, p) => s + p[0], 0) / n, lat: anel.reduce((s, p) => s + p[1], 0) / n };
}

/** Limite de passadas geradas, para um toque errado não travar o aparelho. */
const MAXIMO_PASSADAS = 1500;

/**
 * Passadas paralelas à linha A-B, espaçadas pela largura do implemento e recortadas no contorno.
 * Cada passada é um trecho [início, fim] dentro do talhão.
 */
export function gerarPassadas(contorno: Poligono, a: Posicao, b: Posicao, larguraM: number): [Posicao, Posicao][] {
  const anel = contorno.coordinates[0] ?? [];
  const ab = paraMetros(a, b);
  const comprimento = Math.hypot(ab.x, ab.y);
  if (anel.length < 4 || comprimento < 1 || larguraM <= 0) return [];

  // Eixos da linha: t ao longo dela, s perpendicular a ela.
  const d = { x: ab.x / comprimento, y: ab.y / comprimento };
  const n = { x: -d.y, y: d.x };
  const cantos = anel.map(([lng, lat]) => {
    const p = paraMetros(a, { lat, lng });
    return { t: p.x * d.x + p.y * d.y, s: p.x * n.x + p.y * n.y };
  });

  const ss = cantos.map((c) => c.s);
  const primeira = Math.ceil(Math.min(...ss) / larguraM);
  const ultima = Math.floor(Math.max(...ss) / larguraM);
  if (ultima - primeira > MAXIMO_PASSADAS) return [];

  const passadas: [Posicao, Posicao][] = [];
  for (let k = primeira; k <= ultima; k++) {
    const s = k * larguraM;
    const cortes: number[] = [];
    for (let i = 0; i < cantos.length - 1; i++) {
      const p = cantos[i]!;
      const q = cantos[i + 1]!;
      // Regra meio-aberta: cada cruzamento conta uma vez, mesmo passando por um canto.
      if ((p.s <= s && q.s > s) || (q.s <= s && p.s > s)) {
        cortes.push(p.t + ((s - p.s) / (q.s - p.s)) * (q.t - p.t));
      }
    }
    cortes.sort((x, y) => x - y);
    for (let i = 0; i + 1 < cortes.length; i += 2) {
      const ponto = (t: number) => deMetros(a, { x: d.x * t + n.x * s, y: d.y * t + n.y * s });
      passadas.push([ponto(cortes[i]!), ponto(cortes[i + 1]!)]);
    }
  }
  return passadas;
}
