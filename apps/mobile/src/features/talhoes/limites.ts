import type { Talhao } from '@talhio/shared';

/** [oeste, sul, leste, norte] que enquadra todos os talhões. Nulo se não há talhão. */
export function limitesDosTalhoes(talhoes: Talhao[]): [number, number, number, number] | null {
  const pontos = talhoes.flatMap((t) => t.contorno.coordinates[0] ?? []);
  if (pontos.length === 0) return null;
  const lngs = pontos.map((p) => p[0]);
  const lats = pontos.map((p) => p[1]);
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
}
