import type { RefObject } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

import type { MapaControle } from './tipos';

type Props = {
  /** O mesmo `ref` passado ao `MapaBase`. */
  controle: RefObject<MapaControle | null>;
  style?: StyleProp<ViewStyle>;
};

/** Botões de aproximar e afastar. Servem para uma mão só e para o simulador, onde não há pinça. */
export function BotoesDeZoom({ controle, style }: Props) {
  return (
    <View style={[styles.caixa, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Aproximar" onPress={() => controle.current?.aproximar(1)} style={styles.botao}>
        <Text style={styles.texto}>+</Text>
      </Pressable>
      <View style={styles.divisor} />
      <Pressable accessibilityRole="button" accessibilityLabel="Afastar" onPress={() => controle.current?.aproximar(-1)} style={styles.botao}>
        <Text style={styles.texto}>−</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { backgroundColor: cores.controleMapa, borderRadius: 14, overflow: 'hidden' },
  botao: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  texto: { fontFamily: fontes.regular, fontSize: 22, lineHeight: 26, color: cores.sobreEscuro },
  divisor: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
});
