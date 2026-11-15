import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';
import { memo } from 'react';

import { cores } from '@/shared/theme/tokens';

import { useDeslize } from '../useDeslize';
import { useEventoEstavel } from '../useEventoEstavel';

type Props = {
  /** Um ponto por máquina, com `id`, `status` (trabalhando | parada | sem-sinal) e `tipo` (trator | colheitadeira | pulverizador) nas propriedades. */
  geo: GeoJSON.FeatureCollection<GeoJSON.Point>;
  selecionadaId?: string | null;
  aoTocar?: (id: string) => void;
};

/** Desenhos próprios do Talhio, em branco, para ficar sobre o círculo da cor do estado. Carregados uma vez só. */
const IMAGENS = {
  'maquina-trator': require('../imagens/maquina-trator.png'),
  'maquina-colheitadeira': require('../imagens/maquina-colheitadeira.png'),
  'maquina-pulverizador': require('../imagens/maquina-pulverizador.png'),
};

type Igual = ['==', ['get', string], string];
const AREA_DE_TOQUE = { top: 14, right: 14, bottom: 14, left: 14 };

/**
 * Máquinas: UMA fonte e UMA camada para todas, desenhadas pela placa de vídeo.
 * Para atualizar posições, troque `geo`; nunca crie um componente por máquina.
 */
export function CamadaMaquinas({ aoTocar, ...dados }: Props) {
  return <Interna {...dados} aoTocar={useEventoEstavel(aoTocar)} />;
}

const Interna = memo(function CamadaMaquinasInterna({ geo, selecionadaId = null, aoTocar }: { geo: Props['geo']; selecionadaId?: string | null; aoTocar: (id: string) => void }) {
  const ativa: Igual = ['==', ['get', 'id'], selecionadaId ?? ''];
  // As máquinas deslizam até a posição nova, em vez de pular a cada atualização.
  const emMovimento = useDeslize(geo);
  return (
    <>
    <Images images={IMAGENS} />
    <GeoJSONSource
      id="maquinas"
      data={emMovimento}
      hitbox={AREA_DE_TOQUE}
      onPress={(evento) => {
        evento.stopPropagation();
        const id = evento.nativeEvent.features[0]?.properties?.id;
        if (typeof id === 'string') aoTocar(id);
      }}>
      <Layer
        type="circle"
        id="maquinas-pontos"
        source="maquinas"
        paint={{
          'circle-radius': ['case', ativa, 17, 14],
          'circle-color': ['match', ['get', 'status'], 'trabalhando', cores.primario, 'parada', cores.parada, cores.mapaFundo],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': ['case', ativa, 4, 2.5],
        }}
      />
      {/* O desenho do tipo da máquina por cima do círculo; tipo desconhecido fica só com o círculo. */}
      <Layer
        type="symbol"
        id="maquinas-tipo"
        source="maquinas"
        filter={['in', ['get', 'tipo'], ['literal', ['trator', 'colheitadeira', 'pulverizador']]]}
        layout={{
          'icon-image': ['concat', 'maquina-', ['get', 'tipo']],
          'icon-size': ['case', ativa, 0.3, 0.25],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        }}
      />
    </GeoJSONSource>
    </>
  );
});
