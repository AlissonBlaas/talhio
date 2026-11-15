import { useEffect, type ReactNode } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

/**
 * Animações do Talhio. Todas rodam fora da thread do JavaScript (não competem com o mapa nem com
 * as buscas) e respeitam "Reduzir movimento" do aparelho: com a opção ligada, o conteúdo
 * simplesmente aparece.
 */

/** Intervalo entre itens que entram em sequência. */
export const DEGRAU_MS = 55;
/** Depois de alguns itens, todos entram juntos: lista longa não fica esperando. */
const MAXIMO_DE_DEGRAUS = 6;

type SurgirProps = {
  children: ReactNode;
  /** Posição na sequência (0, 1, 2...): cada um entra um pouco depois do anterior. */
  ordem?: number;
  /** leve = só aparece; subir = aparece subindo alguns pontos. */
  modo?: 'leve' | 'subir';
  style?: StyleProp<ViewStyle>;
};

/** Faz o conteúdo aparecer ao entrar na tela. */
export function Surgir({ children, ordem = 0, modo = 'subir', style }: SurgirProps) {
  const atraso = Math.min(ordem, MAXIMO_DE_DEGRAUS) * DEGRAU_MS;
  const entrada = modo === 'leve' ? FadeIn.duration(260).delay(atraso) : FadeInDown.duration(340).delay(atraso).easing(Easing.out(Easing.cubic));
  return (
    <Animated.View entering={entrada} style={style}>
      {children}
    </Animated.View>
  );
}

type BarraProps = {
  /** 0 a 100. */
  percentual: number;
  cor: string;
  altura: number;
  /** Atraso antes de começar a crescer. */
  atrasoMs?: number;
};

/** Barra que cresce até o valor, e desliza até o novo valor quando ele muda. */
export function BarraAnimada({ percentual, cor, altura, atrasoMs = 0 }: BarraProps) {
  const alvo = Math.max(0, Math.min(100, percentual));
  const valor = useSharedValue(0);
  useEffect(() => {
    valor.value = withDelay(atrasoMs, withTiming(alvo, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [alvo, atrasoMs, valor]);
  const estilo = useAnimatedStyle(() => ({ width: `${valor.value}%` as DimensionValue }));
  return <Animated.View style={[{ height: altura, borderRadius: altura / 2, backgroundColor: cor }, estilo]} />;
}

/** Três pontos que sobem e descem em sequência: "está respondendo". */
export function PontosPensando({ cor }: { cor: string }) {
  return (
    <>
      {[0, 1, 2].map((indice) => (
        <Ponto key={indice} cor={cor} atrasoMs={indice * 140} />
      ))}
    </>
  );
}

function Ponto({ cor, atrasoMs }: { cor: string; atrasoMs: number }) {
  const fase = useSharedValue(0);
  useEffect(() => {
    fase.value = withDelay(atrasoMs, withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 }), withTiming(0, { duration: 260 })), -1));
  }, [atrasoMs, fase]);
  const estilo = useAnimatedStyle(() => ({ opacity: 0.35 + fase.value * 0.65, transform: [{ translateY: -3 * fase.value }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: cor }, estilo]} />;
}

/** Anel que se expande e some, repetindo: "estou ouvindo". Fica atrás do botão. */
export function AnelPulsante({ cor, tamanho }: { cor: string; tamanho: number }) {
  const fase = useSharedValue(0);
  useEffect(() => {
    fase.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), -1);
  }, [fase]);
  const estilo = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - fase.value), transform: [{ scale: 1 + fase.value * 0.75 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor }, estilo]} />;
}

/** Faz o conteúdo "respirar" (clareia e volta), repetindo: marca um bloco que ainda está carregando. */
export function Pulsar({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const fase = useSharedValue(1);
  useEffect(() => {
    fase.value = withRepeat(withSequence(withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) })), -1);
  }, [fase]);
  const estilo = useAnimatedStyle(() => ({ opacity: fase.value }));
  return <Animated.View style={[style, estilo]}>{children}</Animated.View>;
}
