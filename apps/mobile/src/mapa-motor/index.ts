/**
 * Motor de mapa do Talhio. ÚNICA parte do app que importa a biblioteca de mapas.
 * O resto do app usa só o que sai daqui: `MapaBase`, as camadas e os tipos.
 * Regra conferida por `pnpm --filter @talhio/mobile typecheck` (scripts/verificar-mapa.mjs).
 */
export { BotoesDeZoom } from './BotoesDeZoom';
export { MapaBase } from './MapaBase';
export { CamadaContornos } from './camadas/CamadaContornos';
export { CamadaDesenhoTalhao } from './camadas/CamadaDesenhoTalhao';
export { CamadaLinhaAB } from './camadas/CamadaLinhaAB';
export { CamadaMaquinas } from './camadas/CamadaMaquinas';
export { CamadaPassadas } from './camadas/CamadaPassadas';
export { CamadaRastros } from './camadas/CamadaRastros';
export { CamadaPonto } from './camadas/CamadaPonto';
export { CamadaTalhoes, type PropriedadesDoTalhao, type RotuloDeTalhao } from './camadas/CamadaTalhoes';
export type { Limites, LngLat, MapaControle, Margem, PontoTela } from './tipos';
