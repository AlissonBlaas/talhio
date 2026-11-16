import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';
import type { ExpressionSpecification, FilterSpecification } from '@maplibre/maplibre-gl-style-spec';
import { memo } from 'react';

import { cores } from '@/shared/theme/tokens';

import { useDeslize } from '../useDeslize';
import { useEventoEstavel } from '../useEventoEstavel';

type Props = {
  /** Um ponto por máquina, com `id`, `status` (trabalhando | parada | sem-sinal) e `tipo` (trator | colheitadeira | pulverizador) nas propriedades. */
  geo: GeoJSON.FeatureCollection<GeoJSON.Point>;
  selecionadaId?: string | null;
  aoTocar?: (id: string) => void;
  /** Tira do mapa as máquinas sem sinal (a selecionada continua aparecendo). Muda só o filtro, não reenvia os pontos. */
  esconderSemSinal?: boolean;
};

/** Desenhos próprios do Talhio, em branco, para ficar sobre o círculo da cor do estado. Carregados uma vez só. */
const IMAGENS = {
  'maquina-trator': require('../imagens/maquina-trator.png'),
  'maquina-colheitadeira': require('../imagens/maquina-colheitadeira.png'),
  'maquina-pulverizador': require('../imagens/maquina-pulverizador.png'),
};

type Igual = ['==', ['get', string], string];
const STATUS: ['get', string] = ['get', 'status'];
/**
 * Quem está trabalhando tem que saltar aos olhos, quem está parada com sinal vem em seguida e quem está sem sinal
 * fica discreto: tamanho, cor, contorno e ordem de desenho mudam juntos, para o estado não depender só da cor.
 */
const ORDEM: ExpressionSpecification = ['match', STATUS, 'trabalhando', 3, 'parada', 2, 1];
const AREA_DE_TOQUE = { top: 14, right: 14, bottom: 14, left: 14 };

/**
 * Máquinas: UMA fonte e UMA camada para todas, desenhadas pela placa de vídeo.
 * Para atualizar posições, troque `geo`; nunca crie um componente por máquina.
 */
export function CamadaMaquinas({ aoTocar, ...dados }: Props) {
  return <Interna {...dados} aoTocar={useEventoEstavel(aoTocar)} />;
}

const Interna = memo(function CamadaMaquinasInterna({ geo, selecionadaId = null, esconderSemSinal = false, aoTocar }: { geo: Props['geo']; selecionadaId?: string | null; esconderSemSinal?: boolean; aoTocar: (id: string) => void }) {
  const ativa: Igual = ['==', ['get', 'id'], selecionadaId ?? ''];
  const semSinal: Igual = ['==', STATUS, 'sem-sinal'];
  // Com as sem sinal escondidas, só some quem está sem sinal E não é a selecionada.
  const visivel: FilterSpecification = esconderSemSinal ? ['any', ['!', semSinal], ativa] : true;
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
      {/* Auréola clara em volta de quem está trabalhando: é o que o olho acha primeiro sobre a foto de satélite. */}
      <Layer
        type="circle"
        id="maquinas-trabalhando"
        source="maquinas"
        filter={['==', STATUS, 'trabalhando']}
        paint={{
          'circle-radius': ['case', ativa, 30, 26],
          'circle-color': cores.folhaClara,
          'circle-opacity': 0.4,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.9,
        }}
      />
      <Layer
        type="circle"
        id="maquinas-pontos"
        source="maquinas"
        filter={visivel}
        layout={{ 'circle-sort-key': ORDEM }}
        paint={{
          // Trabalhando é a maior; sem sinal vira um ponto pequeno e apagado (cresce só se for a selecionada).
          'circle-radius': ['case', ativa, 18, ['match', STATUS, 'trabalhando', 16, 'parada', 14, 8]],
          'circle-color': ['match', STATUS, 'trabalhando', cores.folha, 'parada', cores.parada, cores.semSinalNoMapa],
          'circle-opacity': ['case', ativa, 1, ['match', STATUS, 'sem-sinal', 0.8, 1]],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': ['case', ativa, 4, ['match', STATUS, 'trabalhando', 3, 'parada', 2.5, 1.5]],
          'circle-stroke-opacity': ['case', ativa, 1, ['match', STATUS, 'sem-sinal', 0.7, 1]],
        }}
      />
      {/* O desenho do tipo da máquina por cima do círculo; tipo desconhecido fica só com o círculo. */}
      <Layer
        type="symbol"
        id="maquinas-tipo"
        source="maquinas"
        // Sem sinal não leva desenho (o ponto é pequeno demais), a não ser que seja a selecionada.
        filter={['all', ['in', ['get', 'tipo'], ['literal', ['trator', 'colheitadeira', 'pulverizador']]], ['any', ['!', semSinal], ativa]]}
        layout={{
          'symbol-sort-key': ORDEM,
          'icon-image': ['concat', 'maquina-', ['get', 'tipo']],
          'icon-size': ['case', ativa, 0.3, ['match', STATUS, 'trabalhando', 0.28, 0.25]],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        }}
      />
    </GeoJSONSource>
    </>
  );
});
