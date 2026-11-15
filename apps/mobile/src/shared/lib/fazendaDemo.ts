import type { Posicao } from '@talhio/shared';

/**
 * Georreferência da imagem de satélite de demonstração.
 * Mesmos números de packages/deere/src/fazenda-demo.ts (o app não importa aquele pacote).
 * Some quando o mapa real entrar.
 */
export const IMAGEM_DEMO = {
  fonte: require('@/assets/images/satelite-demo.jpg') as number,
  larguraPx: 1472,
  alturaPx: 1154,
  lat0: -31.7654,
  lng0: -52.3376,
  mpp: 5,
};

const M_POR_GRAU = 111_320;

/** Posição geográfica -> pixel da imagem. */
export function posicaoParaPixel({ lat, lng }: Posicao): { x: number; y: number } {
  const { lat0, lng0, mpp } = IMAGEM_DEMO;
  return {
    x: ((lng - lng0) * M_POR_GRAU * Math.cos((lat0 * Math.PI) / 180)) / mpp,
    y: ((lat0 - lat) * M_POR_GRAU) / mpp,
  };
}

/** Cantos da imagem de demonstração em [lng, lat]: superior esquerdo, superior direito, inferior direito, inferior esquerdo. */
export function cantosDaImagemDemo(): [[number, number], [number, number], [number, number], [number, number]] {
  const { lat0, lng0, mpp, larguraPx, alturaPx } = IMAGEM_DEMO;
  const lng1 = lng0 + (larguraPx * mpp) / (M_POR_GRAU * Math.cos((lat0 * Math.PI) / 180));
  const lat1 = lat0 - (alturaPx * mpp) / M_POR_GRAU;
  return [
    [lng0, lat0],
    [lng1, lat0],
    [lng1, lat1],
    [lng0, lat1],
  ];
}
