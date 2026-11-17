import { Camera, Map, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';
import { memo, useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode, type Ref } from 'react';
import { StyleSheet } from 'react-native';

import { ESTILO_SATELITE } from './estilo';
import type { Limites, LngLat, MapaControle, Margem, PontoTela } from './tipos';
import { useEventoEstavel } from './useEventoEstavel';

type Props = {
  ref?: Ref<MapaControle>;
  /** Área mostrada ao abrir. Se mudar depois (ex.: importação), o mapa vai para a área nova. */
  limites?: Limites | null;
  /** Folga em volta de `limites`, para o que estiver por cima do mapa (barras, painéis). */
  margem?: Margem;
  /** Alternativa a `limites`: abrir num ponto, com um zoom. */
  centro?: LngLat;
  zoom?: number;
  /** false = mapa parado: sem arrastar nem zoom (miniaturas). */
  interativo?: boolean;
  permitirGirar?: boolean;
  mostrarAtribuicao?: boolean;
  /** Toque no mapa fora de qualquer camada que trate toque. */
  aoTocar?: (posicao: LngLat, pontoTela: PontoTela) => void;
  /**
   * A câmera PAROU (fim de um arrasto, zoom ou comando) ou o mapa acabou de abrir. Não avisa durante o movimento:
   * serve para conferir uma vez o que ficou na tela, nunca para acompanhar o dedo.
   */
  aoParar?: () => void;
  /** Camadas (de `@/mapa-motor`). */
  children?: ReactNode;
};

const GESTOS_DESLIGADOS = { dragPan: false, touchZoom: false, doubleTapZoom: false, doubleTapHoldZoom: false } as const;
const SEM_MARGEM: Margem = { top: 0, right: 0, bottom: 0, left: 0 };
/** Permite afastar até ver uma região inteira e aproximar até o detalhe da imagem de satélite. */
const ZOOM_MINIMO = 3;
/** Além do nível da foto (ver `estilo.ts`): para desenhar detalhe, a foto ampliada basta. */
const ZOOM_MAXIMO = 21;

/**
 * O mapa do Talhio. É o único lugar do app que conhece a biblioteca de mapas.
 *
 * Desempenho:
 * - a tela pode redesenhar à vontade: os manipuladores de toque têm identidade fixa e as camadas
 *   são memorizadas, então nada é reenviado ao mapa nativo se os dados não mudaram;
 * - a posição inicial vale só na montagem; depois disso a câmera é movida por comando (`ref`),
 *   nunca por estado do React.
 */
export const MapaBase = memo(function MapaBase({ ref, limites, margem = SEM_MARGEM, centro, zoom, interativo = true, permitirGirar = false, mostrarAtribuicao = true, aoTocar, aoParar, children }: Props) {
  const mapaRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const tocar = useEventoEstavel(aoTocar);
  const parar = useEventoEstavel(aoParar);

  useImperativeHandle(
    ref,
    (): MapaControle => ({
      aproximar: (passo) => {
        void mapaRef.current?.getZoom().then((atual) => {
          if (typeof atual === 'number') cameraRef.current?.zoomTo(atual + passo, { duration: 250 });
        });
      },
      irPara: (destino, opcoes = {}) => {
        void (async () => {
          const atual = await mapaRef.current?.getZoom();
          cameraRef.current?.easeTo({
            center: destino,
            zoom: Math.max(typeof atual === 'number' ? atual : 0, opcoes.zoomMinimo ?? 0),
            padding: opcoes.margem ?? SEM_MARGEM,
            duration: opcoes.duracaoMs ?? 600,
          });
        })();
      },
      enquadrar: (area, opcoes = {}) => cameraRef.current?.fitBounds(area, { padding: opcoes.margem ?? SEM_MARGEM, duration: opcoes.duracaoMs ?? 600 }),
      projetar: async (posicao) => (await mapaRef.current?.project(posicao)) ?? null,
    }),
    [],
  );

  // A posição inicial só vale na montagem. Quando a área muda depois, a câmera é levada até ela.
  const chave = limites ? limites.join(',') : null;
  const chaveAnterior = useRef(chave);
  const margemAtual = useRef(margem);
  useLayoutEffect(() => {
    margemAtual.current = margem;
  });
  useEffect(() => {
    if (chave === chaveAnterior.current) return;
    chaveAnterior.current = chave;
    if (limites) cameraRef.current?.fitBounds(limites, { padding: margemAtual.current, duration: 0 });
    // `limites` entra pela chave: comparar o texto evita reagir a um array novo com os mesmos números.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  // Calculada uma vez: mudar este objeto depois não move a câmera, só gastaria trabalho.
  const inicial = useRef(limites ? { bounds: limites, padding: margem } : centro ? { center: centro, zoom: zoom ?? 15 } : undefined).current;

  return (
    <Map
      ref={mapaRef}
      style={styles.mapa}
      mapStyle={ESTILO_SATELITE}
      logo={false}
      compass={false}
      attribution={mostrarAtribuicao}
      touchPitch={false}
      touchRotate={interativo && permitirGirar}
      // Os gestos só são mexidos para travar o mapa; no mapa normal valem os padrões da biblioteca.
      {...(interativo ? null : GESTOS_DESLIGADOS)}
      onRegionDidChange={() => parar()}
      onDidFinishLoadingMap={() => parar()}
      onPress={(evento) => tocar(evento.nativeEvent.lngLat as LngLat, evento.nativeEvent.point as PontoTela)}>
      <Camera ref={cameraRef} minZoom={ZOOM_MINIMO} maxZoom={ZOOM_MAXIMO} initialViewState={inicial} />
      {children}
    </Map>
  );
});

const styles = StyleSheet.create({ mapa: { flex: 1 } });
