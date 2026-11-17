type Canto = [lng: number, lat: number];

/** Quanto de cada lado vizinho a curva ocupa (do lado mais curto dos dois). */
const PARTE_DO_LADO = 0.35;
/** Pontos da curva, contando o começo e o fim. */
const PONTOS = 6;

/**
 * Troca um canto por uma curva suave entre os dois lados que se encontram nele.
 * A curva é feita de pontos de verdade: o contorno salvo (e a área) é exatamente o que aparece no mapa.
 * Com menos de 3 cantos não há o que arredondar, e a lista volta igual.
 */
export function arredondarCanto(cantos: Canto[], indice: number): Canto[] {
  const b = cantos[indice];
  if (cantos.length < 3 || !b) return cantos;
  const a = cantos[(indice - 1 + cantos.length) % cantos.length]!;
  const c = cantos[(indice + 1) % cantos.length]!;
  // Um grau de longitude é mais curto que um de latitude: mede-se em "graus de latitude" para os dois lados pesarem igual.
  const k = Math.cos((b[1] * Math.PI) / 180);
  const tamanho = (p: Canto) => Math.hypot((p[0] - b[0]) * k, p[1] - b[1]);
  const alcance = PARTE_DO_LADO * Math.min(tamanho(a), tamanho(c));
  if (!(alcance > 0)) return cantos;
  const rumoA = (p: Canto): Canto => { const f = alcance / tamanho(p); return [b[0] + (p[0] - b[0]) * f, b[1] + (p[1] - b[1]) * f]; };
  const inicio = rumoA(a);
  const fim = rumoA(c);
  // Curva de Bézier com o canto antigo como ponto de controle: sai de um lado e chega no outro sem quina.
  const curva = Array.from({ length: PONTOS }, (_, i): Canto => {
    const t = i / (PONTOS - 1);
    const u = 1 - t;
    return [u * u * inicio[0] + 2 * u * t * b[0] + t * t * fim[0], u * u * inicio[1] + 2 * u * t * b[1] + t * t * fim[1]];
  });
  return [...cantos.slice(0, indice), ...curva, ...cantos.slice(indice + 1)];
}
