import type { Posicao } from '@talhio/shared';
import type { ReactNode } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg from 'react-native-svg';

import { IMAGEM_DEMO, posicaoParaPixel } from '@/shared/lib/fazendaDemo';
import { cores } from '@/shared/theme/tokens';

/** Converte uma posição geográfica em ponto da tela, dentro do mapa. */
export type Projetar = (posicao: Posicao) => { x: number; y: number };

type Props = {
  largura: number;
  altura: number;
  /** Largura com que a imagem inteira é desenhada. Define o zoom. */
  larguraImagem: number;
  /** Deslocamento da imagem dentro do quadro. Define o enquadramento. */
  deslocX: number;
  deslocY: number;
  estilo?: StyleProp<ViewStyle>;
  /** Camadas SVG desenhadas sobre a imagem. */
  children: (projetar: Projetar) => ReactNode;
};

export function MapaSatelite({ largura, altura, larguraImagem, deslocX, deslocY, estilo, children }: Props) {
  const escala = larguraImagem / IMAGEM_DEMO.larguraPx;
  const projetar: Projetar = (posicao) => {
    const px = posicaoParaPixel(posicao);
    return { x: px.x * escala + deslocX, y: px.y * escala + deslocY };
  };
  return (
    <View style={[styles.quadro, { width: largura, height: altura }, estilo]}>
      <Image
        source={IMAGEM_DEMO.fonte}
        accessibilityIgnoresInvertColors
        style={{ position: 'absolute', left: deslocX, top: deslocY, width: larguraImagem, height: IMAGEM_DEMO.alturaPx * escala }}
      />
      <Svg width={largura} height={altura} style={StyleSheet.absoluteFill}>
        {children(projetar)}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  quadro: { overflow: 'hidden', backgroundColor: cores.mapaFundo },
});
