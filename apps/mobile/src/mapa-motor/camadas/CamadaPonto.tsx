import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { memo, useMemo } from 'react';

import type { LngLat } from '../tipos';

/** Um ponto de destaque (ex.: a máquina, na tela dela). */
export const CamadaPonto = memo(function CamadaPonto({ lng, lat, cor }: { lng: number; lat: number; cor: string }) {
  // Montado só quando a posição muda: o mesmo objeto não é reenviado ao mapa.
  const geo = useMemo<GeoJSON.Feature<GeoJSON.Point>>(() => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] satisfies LngLat } }), [lng, lat]);
  return (
    <GeoJSONSource id="ponto" data={geo}>
      <Layer type="circle" id="ponto-camada" source="ponto" paint={{ 'circle-radius': 11, 'circle-color': cor, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 4 }} />
    </GeoJSONSource>
  );
});
