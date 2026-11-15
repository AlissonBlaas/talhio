import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { memo } from 'react';

import { cores } from '@/shared/theme/tokens';

type Largura = ['interpolate', ['linear'], ['zoom'], ...number[]];
const porZoom = (longe: number, perto: number): Largura => ['interpolate', ['linear'], ['zoom'], 12, longe, 17, perto];

type Props = {
  /** Uma linha (ou várias) por máquina, com a propriedade `id`. */
  geo: GeoJSON.FeatureCollection<GeoJSON.MultiLineString | GeoJSON.LineString, { id: string }>;
  /** O caminho desta máquina fica em destaque; os outros, mais discretos. */
  selecionadaId?: string | null;
  /** Onde cada máquina parou (propriedades `id` e `minutos`). Parada longa aparece maior. */
  paradas?: GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; minutos: number }>;
};

const SEM_PARADAS: GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; minutos: number }> = { type: 'FeatureCollection', features: [] };

/** Caminho que as máquinas fizeram hoje. UMA fonte e duas camadas para todas as máquinas; a seleção só muda a pintura. */
export const CamadaRastros = memo(function CamadaRastros({ geo, selecionadaId = null, paradas = SEM_PARADAS }: Props) {
  const escolhida: ['==', ['get', string], string] = ['==', ['get', 'id'], selecionadaId ?? ''];
  return (
    <>
    <GeoJSONSource id="rastros" data={geo}>
      <Layer type="line" id="rastros-borda" source="rastros" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': cores.passadaBorda, 'line-width': porZoom(1.6, 4.2), 'line-opacity': 0.6 }} />
      <Layer
        type="line"
        id="rastros-linha"
        source="rastros"
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        // O zoom só pode ser a entrada de um `interpolate` de primeiro nível: a escolha da máquina vai DENTRO dele.
        paint={{
          'line-color': ['case', escolhida, cores.milho, cores.passadaPlantio],
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, ['case', escolhida, 1.6, 0.9], 17, ['case', escolhida, 3.4, 2.4]],
          'line-opacity': ['case', escolhida, 1, 0.85],
        }}
      />
    </GeoJSONSource>
    {/* Paradas: bolinha clara com miolo escuro, como o relógio do rastro. Só aparecem de perto, para não poluir. */}
    <GeoJSONSource id="rastros-paradas" data={paradas}>
      <Layer
        type="circle"
        id="rastros-paradas-anel"
        source="rastros-paradas"
        minzoom={13}
        paint={{
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, ['case', ['>=', ['get', 'minutos'], 15], 4, 3], 17, ['case', ['>=', ['get', 'minutos'], 15], 9, 6.5]],
          'circle-color': cores.cartao,
          'circle-stroke-color': ['case', escolhida, cores.milho, cores.passadaBorda],
          'circle-stroke-width': 2,
        }}
      />
      <Layer
        type="circle"
        id="rastros-paradas-miolo"
        source="rastros-paradas"
        minzoom={13}
        paint={{ 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 1, 17, ['case', ['>=', ['get', 'minutos'], 15], 3.5, 2.5]], 'circle-color': cores.passadaBorda }}
      />
    </GeoJSONSource>
    </>
  );
});
