import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { memo } from 'react';

import { cores } from '@/shared/theme/tokens';

type Props = {
  /** Itens com `tipo`: `area`, `linha` e `canto` (este com `selecionado`). */
  geo: GeoJSON.FeatureCollection;
  salvo: boolean;
};

/**
 * Desenho de um talhão em andamento. Os cantos também são camada do mapa; a seleção por toque é
 * resolvida na tela, comparando o ponto tocado com a posição de cada canto (`MapaControle.projetar`).
 */
export const CamadaDesenhoTalhao = memo(function CamadaDesenhoTalhao({ geo, salvo }: Props) {
  const cor = salvo ? cores.talhaoContorno : cores.desenho;
  return (
    <GeoJSONSource id="desenho" data={geo}>
      <Layer type="fill" id="desenho-area" source="desenho" filter={['==', ['get', 'tipo'], 'area']} paint={{ 'fill-color': salvo ? cores.talhaoSalvoFundo : cores.desenhoFundo }} />
      <Layer type="line" id="desenho-linha" source="desenho" filter={['==', ['get', 'tipo'], 'linha']} layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': cor, 'line-width': 3 }} />
      {/* Halo do canto selecionado, por baixo do ponto. */}
      <Layer
        type="circle"
        id="desenho-canto-halo"
        source="desenho"
        filter={['all', ['==', ['get', 'tipo'], 'canto'], ['get', 'selecionado']]}
        paint={{ 'circle-radius': 22, 'circle-color': 'rgba(255,255,255,0.35)', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 }}
      />
      <Layer
        type="circle"
        id="desenho-cantos"
        source="desenho"
        filter={['==', ['get', 'tipo'], 'canto']}
        paint={{
          'circle-radius': ['case', ['get', 'selecionado'], 13, 10],
          'circle-color': ['case', ['get', 'selecionado'], '#FFFFFF', cor],
          'circle-stroke-color': ['case', ['get', 'selecionado'], cor, '#FFFFFF'],
          'circle-stroke-width': ['case', ['get', 'selecionado'], 4, 2.5],
        }}
      />
    </GeoJSONSource>
  );
});
