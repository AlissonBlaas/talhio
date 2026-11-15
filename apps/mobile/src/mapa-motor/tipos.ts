/** [longitude, latitude] */
export type LngLat = [number, number];
/** [oeste, sul, leste, norte] */
export type Limites = [number, number, number, number];
export type Margem = { top: number; right: number; bottom: number; left: number };
/** Ponto na tela, em pontos de layout: [x, y]. */
export type PontoTela = [number, number];

/** Comandos do mapa, usados pela tela por meio de `ref`. */
export interface MapaControle {
  /** Aproxima (passo positivo) ou afasta (negativo). */
  aproximar(passo: number): void;
  /** Leva o centro até o ponto, aproximando até `zoomMinimo` se estiver mais longe que isso. */
  irPara(centro: LngLat, opcoes?: { zoomMinimo?: number; margem?: Margem; duracaoMs?: number }): void;
  /** Enquadra a área. */
  enquadrar(limites: Limites, opcoes?: { margem?: Margem; duracaoMs?: number }): void;
  /** Onde um ponto do mapa está na tela agora. */
  projetar(posicao: LngLat): Promise<PontoTela | null>;
}
