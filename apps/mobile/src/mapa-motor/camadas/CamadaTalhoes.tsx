import { GeoJSONSource, Layer, ViewAnnotation } from '@maplibre/maplibre-react-native';
import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

import type { LngLat } from '../tipos';
import { useEventoEstavel } from '../useEventoEstavel';

/** Propriedades esperadas em cada talhão do GeoJSON. */
export type PropriedadesDoTalhao = { id: string; operacao: string };
export type RotuloDeTalhao = { id: string; texto: string; descricao: string; centro: LngLat };

type Props = {
  /** Contornos. Cada item com `id` e `operacao` nas propriedades. */
  geo: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  selecionadoId?: string | null;
  /** Etiquetas com o nome, no centro de cada talhão. Omita em mapas pequenos. */
  rotulos?: RotuloDeTalhao[];
  aoTocar?: (id: string) => void;
};

type Igual = ['==', ['get', string], string];
const SEM_ROTULOS: RotuloDeTalhao[] = [];

/** Talhões: preenchimento pela operação em andamento, contorno e (opcional) etiquetas. */
export function CamadaTalhoes({ aoTocar, ...dados }: Props) {
  return <Interna {...dados} aoTocar={useEventoEstavel(aoTocar)} />;
}

const Interna = memo(function CamadaTalhoesInterna({ geo, selecionadoId = null, rotulos = SEM_ROTULOS, aoTocar }: Required<Pick<Props, 'geo' | 'aoTocar'>> & Omit<Props, 'aoTocar'>) {
  // A seleção entra como expressão de pintura: muda a cor na placa de vídeo, sem trocar os dados.
  const ativo: Igual = ['==', ['get', 'id'], selecionadoId ?? ''];

  return (
    <>
      <GeoJSONSource
        id="talhoes"
        data={geo}
        onPress={(evento) => {
          evento.stopPropagation();
          const id = evento.nativeEvent.features[0]?.properties?.id;
          if (typeof id === 'string') aoTocar(id);
        }}>
        <Layer
          type="fill"
          id="talhoes-preenchimento"
          source="talhoes"
          paint={{
            'fill-color': ['match', ['get', 'operacao'], 'plantio', cores.talhaoPlantio, 'pulverizacao', cores.talhaoPulverizacao, ['case', ativo, cores.talhaoSelecionado, 'rgba(0,0,0,0)']],
          }}
        />
        <Layer
          type="line"
          id="talhoes-contorno"
          source="talhoes"
          layout={{ 'line-join': 'round' }}
          paint={{ 'line-color': ['case', ativo, '#FFFFFF', cores.talhaoContorno], 'line-width': ['case', ativo, 4, 2.5] }}
        />
      </GeoJSONSource>

      {rotulos.map((rotulo) => {
        const selecionado = rotulo.id === selecionadoId;
        return (
          <ViewAnnotation key={rotulo.id} id={`rotulo-${rotulo.id}`} lngLat={rotulo.centro}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={rotulo.descricao}
              hitSlop={8}
              onPress={() => aoTocar(rotulo.id)}
              style={[styles.rotulo, selecionado ? styles.rotuloAtivo : styles.rotuloInativo]}>
              <Text numberOfLines={1} style={[styles.rotuloTexto, { color: selecionado ? cores.texto : cores.sobreEscuro }]}>
                {rotulo.texto}
              </Text>
            </Pressable>
          </ViewAnnotation>
        );
      })}
    </>
  );
});

const styles = StyleSheet.create({
  rotulo: { height: 30, minWidth: 44, maxWidth: 170, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rotuloInativo: { backgroundColor: 'rgba(18,32,26,0.82)' },
  rotuloAtivo: { backgroundColor: cores.cartao },
  rotuloTexto: { fontFamily: fontes.semi, fontSize: 13 },
});
