/**
 * Georreferência da fazenda de demonstração.
 * A imagem de satélite do app (1472 x 1154 px) cobre esta área: cada pixel vale MPP metros.
 * O app usa os mesmos números em apps/mobile/src/shared/lib/fazendaDemo.ts para desenhar
 * talhões e máquinas no lugar certo da imagem. Some quando o mapa real entrar.
 */
export const FAZENDA_DEMO = {
  nome: 'Fazenda Boa Vista',
  /** Canto superior esquerdo da imagem. */
  lat0: -31.7654,
  lng0: -52.3376,
  /** Metros por pixel da imagem. */
  mpp: 5,
  larguraPx: 1472,
  alturaPx: 1154,
} as const;

const M_POR_GRAU = 111_320;

/** Pixel da imagem -> [lng, lat]. */
export function pixelParaLngLat(x: number, y: number): [number, number] {
  const { lat0, lng0, mpp } = FAZENDA_DEMO;
  const lat = lat0 - (y * mpp) / M_POR_GRAU;
  const lng = lng0 + (x * mpp) / (M_POR_GRAU * Math.cos((lat0 * Math.PI) / 180));
  return [lng, lat];
}
