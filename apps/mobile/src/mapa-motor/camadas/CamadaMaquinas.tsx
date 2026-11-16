import { GeoJSONSource, Images, Layer } from '@maplibre/maplibre-react-native';
import type { ExpressionSpecification, FilterSpecification } from '@maplibre/maplibre-gl-style-spec';
import { memo, useMemo } from 'react';

import { cores } from '@/shared/theme/tokens';

import { useDeslize } from '../useDeslize';
import { useEventoEstavel } from '../useEventoEstavel';

type Props = {
  /** Um ponto por máquina, com `id`, `status` (trabalhando | parada | sem-sinal) e `tipo` (trator | colheitadeira | pulverizador) nas propriedades. */
  geo: GeoJSON.FeatureCollection<GeoJSON.Point>;
  selecionadaId?: string | null;
  aoTocar?: (id: string) => void;
  /**
   * Tocaram num grupo (máquinas uma em cima da outra, desenhadas como um marcador só, com a quantidade embaixo): recebe os ids,
   * para a tela deixar escolher qual abrir. Sem isto, o toque no grupo vale como toque na primeira máquina dele.
   */
  aoTocarGrupo?: (ids: string[]) => void;
  /** Tira do mapa as máquinas sem sinal (a selecionada continua aparecendo). */
  esconderSemSinal?: boolean;
};

/** Desenhos próprios do Talhio, em branco, para ficar sobre o círculo da cor do estado. Carregados uma vez só. */
const IMAGENS = {
  'maquina-trator': require('../imagens/maquina-trator.png'),
  'maquina-colheitadeira': require('../imagens/maquina-colheitadeira.png'),
  'maquina-pulverizador': require('../imagens/maquina-pulverizador.png'),
  // Selo com a quantidade, pendurado embaixo do marcador de máquinas empilhadas (o estilo do mapa não tem letras: o número é desenho).
  'grupo-2': require('../imagens/grupo-2.png'),
  'grupo-3': require('../imagens/grupo-3.png'),
  'grupo-4': require('../imagens/grupo-4.png'),
  'grupo-5': require('../imagens/grupo-5.png'),
  'grupo-6': require('../imagens/grupo-6.png'),
  'grupo-7': require('../imagens/grupo-7.png'),
  'grupo-8': require('../imagens/grupo-8.png'),
  'grupo-9': require('../imagens/grupo-9.png'),
  'grupo-mais': require('../imagens/grupo-mais.png'),
};

/** Máquinas a menos disso na tela (em pontos) viram um grupo com a quantidade. */
const RAIO_DO_GRUPO = 24;
/** Acima do zoom máximo do mapa: máquina parada no mesmo lugar que outra continua agrupada por mais que se aproxime. */
const ZOOM_MAXIMO_DO_GRUPO = 20;
/** O que cada grupo sabe dos seus: quantas trabalhando e quantas paradas com sinal (para a cor em volta do número). */
const SOMAS_DO_GRUPO = {
  trabalhando: [['+', ['accumulated'], ['get', 'trabalhando']], ['case', ['==', ['get', 'status'], 'trabalhando'], 1, 0]],
  paradas: [['+', ['accumulated'], ['get', 'paradas']], ['case', ['==', ['get', 'status'], 'parada'], 1, 0]],
} as const;
const EH_GRUPO: FilterSpecification = ['has', 'point_count'];
const SOLTA: FilterSpecification = ['!', ['has', 'point_count']];

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
export function CamadaMaquinas({ aoTocar, aoTocarGrupo, ...dados }: Props) {
  // Sem quem escolha entre as máquinas do grupo, o toque nele abre a primeira.
  const noGrupo = useEventoEstavel(aoTocarGrupo ?? ((ids: string[]) => (ids[0] ? aoTocar?.(ids[0]) : undefined)));
  return <Interna {...dados} aoTocar={useEventoEstavel(aoTocar)} aoTocarGrupo={noGrupo} />;
}

const Interna = memo(function CamadaMaquinasInterna({ geo, selecionadaId = null, esconderSemSinal = false, aoTocar, aoTocarGrupo }: { geo: Props['geo']; selecionadaId?: string | null; esconderSemSinal?: boolean; aoTocar: (id: string) => void; aoTocarGrupo: (ids: string[]) => void }) {
  const ativa: Igual = ['==', ['get', 'id'], selecionadaId ?? ''];
  const semSinal: Igual = ['==', STATUS, 'sem-sinal'];
  // Escondidas, as sem sinal saem dos PONTOS (não só do desenho): senão continuariam contando nos grupos.
  // A selecionada fica. O objeto só muda quando os pontos ou a escolha mudam.
  const visiveis = useMemo(
    () => (esconderSemSinal ? { ...geo, features: geo.features.filter((f) => f.properties?.status !== 'sem-sinal' || f.properties?.id === selecionadaId) } : geo),
    [geo, esconderSemSinal, selecionadaId],
  );
  // As máquinas deslizam até a posição nova, em vez de pular a cada atualização.
  const emMovimento = useDeslize(visiveis);
  return (
    <>
    <Images images={IMAGENS} />
    <GeoJSONSource
      id="maquinas"
      data={emMovimento}
      cluster
      clusterRadius={RAIO_DO_GRUPO}
      clusterMaxZoom={ZOOM_MAXIMO_DO_GRUPO}
      clusterProperties={SOMAS_DO_GRUPO as never}
      hitbox={AREA_DE_TOQUE}
      onPress={(evento) => {
        evento.stopPropagation();
        const tocados = evento.nativeEvent.features;
        const idsDe = (lista: readonly { properties?: Record<string, unknown> | null }[]) => [...new Set(lista.flatMap((f) => (typeof f.properties?.id === 'string' ? [f.properties.id] : [])))];
        const grupo = tocados.find((f) => f.properties?.point_count);
        const centro = grupo?.geometry.type === 'Point' ? grupo.geometry.coordinates : null;
        if (grupo && centro) {
          // Quem está no grupo: as N máquinas mais perto do centro dele (N = a quantidade que o grupo mostra).
          // Conta feita aqui, com os pontos que a camada já tem, sem depender de consulta ao mapa nativo.
          const quantas = Number(grupo.properties?.point_count) || 0;
          const distancia = (f: GeoJSON.Feature<GeoJSON.Point>) => Math.hypot(f.geometry.coordinates[0]! - centro[0]!, f.geometry.coordinates[1]! - centro[1]!);
          const ids = idsDe([...visiveis.features].sort((a, b) => distancia(a) - distancia(b)).slice(0, quantas));
          if (ids.length > 1) aoTocarGrupo(ids);
          else if (ids[0]) aoTocar(ids[0]);
          return;
        }
        // Duas máquinas soltas sob o mesmo dedo: também deixa escolher.
        const ids = idsDe(tocados);
        if (ids.length > 1) aoTocarGrupo(ids);
        else if (ids[0]) aoTocar(ids[0]);
      }}>
      {/* Auréola clara em volta de quem está trabalhando: é o que o olho acha primeiro sobre a foto de satélite. */}
      <Layer
        type="circle"
        id="maquinas-trabalhando"
        source="maquinas"
        filter={['all', SOLTA, ['==', STATUS, 'trabalhando']]}
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
        filter={SOLTA}
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
        filter={['all', SOLTA, ['in', ['get', 'tipo'], ['literal', ['trator', 'colheitadeira', 'pulverizador']]], ['any', ['!', semSinal], ativa]]}
        layout={{
          'symbol-sort-key': ORDEM,
          'icon-image': ['concat', 'maquina-', ['get', 'tipo']],
          'icon-size': ['case', ativa, 0.3, ['match', STATUS, 'trabalhando', 0.28, 0.25]],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        }}
      />
      {/* Máquinas uma em cima da outra: UM marcador de máquina, na cor do estado mais importante do grupo, com a quantidade embaixo. */}
      <Layer
        type="circle"
        id="maquinas-grupo-fundo"
        source="maquinas"
        filter={EH_GRUPO}
        paint={{
          'circle-radius': 16,
          'circle-color': ['case', ['>', ['to-number', ['get', 'trabalhando'], 0], 0], cores.folha, ['>', ['to-number', ['get', 'paradas'], 0], 0], cores.parada, cores.semSinalNoMapa],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 3,
        }}
      />
      <Layer
        type="symbol"
        id="maquinas-grupo-tipo"
        source="maquinas"
        filter={EH_GRUPO}
        layout={{ 'icon-image': 'maquina-trator', 'icon-size': 0.27, 'icon-allow-overlap': true, 'icon-ignore-placement': true }}
      />
      <Layer
        type="symbol"
        id="maquinas-grupo"
        source="maquinas"
        filter={EH_GRUPO}
        layout={{
          'icon-image': ['case', ['>', ['get', 'point_count'], 9], 'grupo-mais', ['concat', 'grupo-', ['to-string', ['get', 'point_count']]]],
          // Pequeno e pendurado na borda de baixo do círculo (o deslocamento é na medida do desenho, antes de reduzir).
          'icon-size': 0.2,
          'icon-offset': [0, 92],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        }}
      />
    </GeoJSONSource>
    </>
  );
});
