import type { Poligono, Posicao } from '@talhio/shared';

/**
 * Diz se o ponto está dentro do polígono (ray casting no anel externo).
 * Provisório: quando o Postgres + PostGIS entrar, isso vira ST_Contains no repository.
 */
export function pontoNoPoligono(ponto: Posicao, poligono: Poligono): boolean {
  const anel = poligono.coordinates[0] ?? [];
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const a = anel[i];
    const b = anel[j];
    if (!a || !b) continue;
    const [xi, yi] = a;
    const [xj, yj] = b;
    const cruza = yi > ponto.lat !== yj > ponto.lat && ponto.lng < ((xj - xi) * (ponto.lat - yi)) / (yj - yi) + xi;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}
