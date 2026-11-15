import { z } from 'zod';

/** Ponto geográfico em graus decimais (WGS84). */
export const PosicaoSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Posicao = z.infer<typeof PosicaoSchema>;

/** Polígono GeoJSON: coordinates[anel][ponto] = [lng, lat]. */
export const PoligonoSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});
export type Poligono = z.infer<typeof PoligonoSchema>;

const RAIO_TERRA_M = 6_378_137;
const rad = (graus: number) => (graus * Math.PI) / 180;

/** Área de um anel [lng, lat][] sobre a esfera, em metros quadrados (com sinal). */
function areaDoAnel(anel: [number, number][]): number {
  const n = anel.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const p1 = anel[i]!;
    const p2 = anel[(i + 1) % n]!;
    const p3 = anel[(i + 2) % n]!;
    total += (rad(p3[0]) - rad(p1[0])) * Math.sin(rad(p2[1]));
  }
  return (total * RAIO_TERRA_M * RAIO_TERRA_M) / 2;
}

/**
 * Área do polígono em hectares, considerando a curvatura da Terra.
 * Mesmo cálculo no app (prévia ao desenhar) e no backend (valor salvo).
 * Com PostGIS, o valor salvo passa a vir de ST_Area(contorno::geography).
 */
export function areaHaDoPoligono(poligono: Poligono): number {
  const [externo, ...buracos] = poligono.coordinates;
  if (!externo) return 0;
  const semFecho = (anel: [number, number][]) => {
    const a = anel[0];
    const z = anel[anel.length - 1];
    return a && z && a[0] === z[0] && a[1] === z[1] ? anel.slice(0, -1) : anel;
  };
  const area = Math.abs(areaDoAnel(semFecho(externo))) - buracos.reduce((s, b) => s + Math.abs(areaDoAnel(semFecho(b))), 0);
  return Math.max(0, area) / 10_000;
}
