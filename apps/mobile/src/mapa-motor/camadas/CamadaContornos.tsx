import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { memo } from 'react';

import { cores } from '@/shared/theme/tokens';

type Props = {
  geo: GeoJSON.FeatureCollection<GeoJSON.Polygon> | GeoJSON.Feature<GeoJSON.Polygon>;
  /** referencia = tracejado e discreto (talhões vizinhos); foco = linha cheia (o talhão em edição). */
  estilo?: 'referencia' | 'foco' | 'linha';
};

/** Contornos de talhão só para orientar: não recebem toque nem seleção. */
export const CamadaContornos = memo(function CamadaContornos({ geo, estilo = 'foco' }: Props) {
  const id = `contornos-${estilo}`;
  return (
    <GeoJSONSource id={id} data={geo}>
      {estilo === 'linha' ? null : <Layer type="fill" id={`${id}-fundo`} source={id} paint={{ 'fill-color': 'rgba(224,64,251,0.10)' }} />}
      <Layer
        type="line"
        id={`${id}-linha`}
        source={id}
        layout={{ 'line-join': 'round' }}
        paint={estilo === 'referencia' ? { 'line-color': cores.talhaoContorno, 'line-width': 2.5, 'line-dasharray': [2, 1.2] } : { 'line-color': cores.talhaoContorno, 'line-width': 2.5 }}
      />
    </GeoJSONSource>
  );
});
