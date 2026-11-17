import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { memo } from 'react';

import { cores } from '@/shared/theme/tokens';

type Props = {
  /** Itens com `tipo`: `area`, `linha`, `canto` (este com `selecionado`) e `meio` (o meio de cada lado, onde nasce um canto novo). */
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
      <Layer type="line" id="desenho-linha" source="desenho" filter={['==', ['get', 'tipo'], 'linha']} layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': cor, 'line-width': 2.5 }} />
      {/* Halo do canto selecionado, por baixo do ponto. */}
      <Layer
        type="circle"
        id="desenho-canto-halo"
        source="desenho"
        filter={['all', ['==', ['get', 'tipo'], 'canto'], ['get', 'selecionado']]}
        paint={{ 'circle-radius': 16, 'circle-color': 'rgba(255,255,255,0.35)', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5 }}
      />
      {/* O meio de cada lado: um ponto discreto. Tocar nele cria um canto ali, para acompanhar uma curva. */}
      <Layer
        type="circle"
        id="desenho-meios"
        source="desenho"
        filter={['==', ['get', 'tipo'], 'meio']}
        paint={{ 'circle-radius': 4, 'circle-color': '#FFFFFF', 'circle-opacity': 0.75, 'circle-stroke-color': cor, 'circle-stroke-width': 1.5 }}
      />
      <Layer
        type="circle"
        id="desenho-cantos"
        source="desenho"
        filter={['==', ['get', 'tipo'], 'canto']}
        paint={{
          // Pequenos de propósito: com o mapa aproximado, cantos grandes escondem a divisa que a pessoa está seguindo.
          // A área de toque não depende do desenho (a tela mede a distância do dedo ao canto).
          'circle-radius': ['case', ['get', 'selecionado'], 8, 6],
          'circle-color': ['case', ['get', 'selecionado'], '#FFFFFF', cor],
          'circle-stroke-color': ['case', ['get', 'selecionado'], cor, '#FFFFFF'],
          'circle-stroke-width': ['case', ['get', 'selecionado'], 3, 2],
        }}
      />
    </GeoJSONSource>
  );
});
