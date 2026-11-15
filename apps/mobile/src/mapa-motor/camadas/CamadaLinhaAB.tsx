import { GeoJSONSource, Layer, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

import type { LngLat } from '../tipos';

type Props = {
  /** Itens com `tipo`: `passadas`, `linha` e `ponto`. */
  geo: GeoJSON.FeatureCollection;
  a: LngLat | null;
  b: LngLat | null;
  salva: boolean;
};

/** Linha AB em edição: passadas, a linha principal e os pontos A e B com a letra. */
export const CamadaLinhaAB = memo(function CamadaLinhaAB({ geo, a, b, salva }: Props) {
  const cor = salva ? cores.primario : cores.desenho;
  return (
    <>
      <GeoJSONSource id="linha-ab" data={geo}>
        <Layer type="line" id="linha-ab-passadas" source="linha-ab" filter={['==', ['get', 'tipo'], 'passadas']} paint={{ 'line-color': '#FFFFFF', 'line-width': 1, 'line-opacity': 0.6 }} />
        <Layer type="line" id="linha-ab-principal" source="linha-ab" filter={['==', ['get', 'tipo'], 'linha']} layout={{ 'line-cap': 'round' }} paint={{ 'line-color': cor, 'line-width': 3.5 }} />
        <Layer
          type="circle"
          id="linha-ab-pontos"
          source="linha-ab"
          filter={['==', ['get', 'tipo'], 'ponto']}
          paint={{ 'circle-radius': 13, 'circle-color': cor, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 }}
        />
      </GeoJSONSource>

      {/* As letras ficam por cima dos pontos e não recebem toque. */}
      {[a, b].map((ponto, indice) =>
        ponto ? (
          <ViewAnnotation key={indice === 0 ? 'A' : 'B'} id={`letra-${indice}`} lngLat={ponto}>
            <View pointerEvents="none" style={styles.caixa}>
              <Text style={[styles.letra, { color: salva ? cores.sobreEscuro : cores.desenhoTexto }]}>{indice === 0 ? 'A' : 'B'}</Text>
            </View>
          </ViewAnnotation>
        ) : null,
      )}
    </>
  );
});

const styles = StyleSheet.create({
  caixa: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  letra: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 16 },
});
