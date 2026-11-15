import { centroDoPoligono, direcaoGraus, distanciaM, gerarPassadas, linhaPelaDirecao, type Posicao, type Talhao } from '@talhio/shared';
import { useMemo, useState } from 'react';

/**
 * Largura do implemento usada para desenhar as passadas.
 * Provisório: fixa em 12 m; passa a vir do implemento da máquina no planejamento.
 */
export const LARGURA_IMPLEMENTO_M = 12;

/** Estado do desenho de uma linha AB sobre um talhão. */
export function useDesenhoLinha(talhao: Talhao | undefined) {
  const [a, setA] = useState<Posicao | null>(null);
  const [b, setB] = useState<Posicao | null>(null);

  const completa = a !== null && b !== null;
  // Recalculado só quando A, B ou o talhão mudam: o mapa recebe o mesmo objeto nos outros redesenhos.
  const passadas = useMemo(() => (a && b && talhao ? gerarPassadas(talhao.contorno, a, b, LARGURA_IMPLEMENTO_M) : []), [a, b, talhao]);

  const geo = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: [
      ...(passadas.length
        ? [
            {
              type: 'Feature' as const,
              properties: { tipo: 'passadas' },
              geometry: { type: 'MultiLineString' as const, coordinates: passadas.map(([p, q]) => [[p.lng, p.lat], [q.lng, q.lat]]) },
            },
          ]
        : []),
      ...(a && b
        ? [{ type: 'Feature' as const, properties: { tipo: 'linha' }, geometry: { type: 'LineString' as const, coordinates: [[a.lng, a.lat], [b.lng, b.lat]] } }]
        : []),
      ...[a, b].flatMap((ponto, indice) =>
        ponto ? [{ type: 'Feature' as const, properties: { tipo: 'ponto', letra: indice === 0 ? 'A' : 'B' }, geometry: { type: 'Point' as const, coordinates: [ponto.lng, ponto.lat] } }] : [],
      ),
    ],
  }), [a, b, passadas]);

  return {
    a,
    b,
    completa,
    geo,
    direcao: completa ? direcaoGraus(a, b) : null,
    quantidadePassadas: passadas.length,
    /** Primeiro toque marca A, o segundo marca B, e um terceiro recomeça. */
    tocar: (ponto: Posicao) => {
      if (a === null || completa) {
        setA(ponto);
        setB(null);
      } else {
        setB(ponto);
      }
    },
    /** Usa a borda mais comprida do talhão como linha. */
    usarBordaMaisLonga: () => {
      const anel = talhao?.contorno.coordinates[0] ?? [];
      let melhor: { a: Posicao; b: Posicao; comprimento: number } | null = null;
      for (let i = 0; i + 1 < anel.length; i++) {
        const p = { lng: anel[i]![0], lat: anel[i]![1] };
        const q = { lng: anel[i + 1]![0], lat: anel[i + 1]![1] };
        const comprimento = distanciaM(p, q);
        if (!melhor || comprimento > melhor.comprimento) melhor = { a: p, b: q, comprimento };
      }
      if (melhor) {
        setA(melhor.a);
        setB(melhor.b);
      }
    },
    /** Aplica uma direção (de uma linha padrão) passando pelo centro do talhão. */
    usarDirecao: (graus: number) => {
      if (!talhao) return;
      const linha = linhaPelaDirecao(centroDoPoligono(talhao.contorno), graus);
      setA(linha.a);
      setB(linha.b);
    },
    refazer: () => {
      setA(null);
      setB(null);
    },
  };
}
