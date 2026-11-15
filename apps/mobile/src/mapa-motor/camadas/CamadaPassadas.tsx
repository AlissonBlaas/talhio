import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { memo } from 'react';

import { cores } from '@/shared/theme/tokens';

type Largura = ['interpolate', ['linear'], ['zoom'], ...number[]];
/** As linhas engrossam ao aproximar e afinam de longe, para não virarem um borrão. */
const porZoom = (longe: number, perto: number): Largura => ['interpolate', ['linear'], ['zoom'], 13, longe, 17, perto];
const LARGURA_PENDENTE = porZoom(0.8, 1.8);
const LARGURA_PENDENTE_BORDA = porZoom(1.8, 3.6);
const LARGURA_FEITA = porZoom(1.4, 3.2);
const LARGURA_FEITA_BORDA = porZoom(2.6, 5.4);

/**
 * Linhas do trator sobre um talhão. Espera itens com a propriedade `tipo`:
 * `pendentes` (passadas por fazer, tracejadas em branco), `feitas` (cheias, no tom claro da
 * `operacao`) e `linha` (a linha AB).
 */
export const CamadaPassadas = memo(function CamadaPassadas({ geo }: { geo: GeoJSON.FeatureCollection }) {
  return (
    <GeoJSONSource id="passadas" data={geo}>
      {/* Cada linha tem uma borda escura por baixo: sem ela, some sobre o talhão colorido e o satélite. */}
      <Layer type="line" id="passadas-pendentes-borda" source="passadas" filter={['==', ['get', 'tipo'], 'pendentes']} paint={{ 'line-color': cores.passadaBorda, 'line-width': LARGURA_PENDENTE_BORDA }} />
      <Layer type="line" id="passadas-pendentes" source="passadas" filter={['==', ['get', 'tipo'], 'pendentes']} paint={{ 'line-color': cores.passadaPendente, 'line-width': LARGURA_PENDENTE, 'line-dasharray': [3, 2] }} />
      <Layer type="line" id="passadas-feitas-borda" source="passadas" filter={['==', ['get', 'tipo'], 'feitas']} paint={{ 'line-color': cores.passadaBorda, 'line-width': LARGURA_FEITA_BORDA }} />
      <Layer
        type="line"
        id="passadas-feitas"
        source="passadas"
        filter={['==', ['get', 'tipo'], 'feitas']}
        paint={{ 'line-color': ['match', ['get', 'operacao'], 'pulverizacao', cores.passadaPulverizacao, 'colheita', cores.passadaColheita, cores.passadaPlantio], 'line-width': LARGURA_FEITA }}
      />
      <Layer type="line" id="passadas-linha" source="passadas" filter={['==', ['get', 'tipo'], 'linha']} layout={{ 'line-cap': 'round' }} paint={{ 'line-color': cores.desenho, 'line-width': 3.5 }} />
    </GeoJSONSource>
  );
});
