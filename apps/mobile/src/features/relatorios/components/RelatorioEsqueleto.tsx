import { StyleSheet, View, type DimensionValue } from 'react-native';

import { Pulsar } from '@/shared/components/animacoes';
import { cores, MARGEM_TELA } from '@/shared/theme/tokens';

const Faixa = ({ largura, altura = 14 }: { largura: DimensionValue; altura?: number }) => <View style={[styles.faixa, { width: largura, height: altura, borderRadius: altura / 2 }]} />;

/** O relatório ainda sendo montado: os mesmos blocos da tela (resumo, quatro indicadores, barras), em cinza, pulsando. */
export function RelatorioEsqueleto() {
  return (
    <Pulsar style={styles.corpo}>
      <View accessibilityRole="progressbar" accessibilityLabel="Montando o relatório" style={styles.resumo}>
        <Faixa largura="45%" altura={20} />
        <Faixa largura="100%" />
        <Faixa largura="92%" />
        <Faixa largura="60%" />
      </View>
      <View style={styles.grade}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.indicador}>
            <Faixa largura="70%" altura={12} />
            <Faixa largura="55%" altura={28} />
            <Faixa largura="80%" altura={12} />
          </View>
        ))}
      </View>
      <View style={styles.barras}>
        <Faixa largura="50%" altura={18} />
        {(['90%', '70%', '55%', '35%'] as const).map((largura) => (
          <View key={largura} style={styles.barra}>
            <Faixa largura="40%" altura={12} />
            <Faixa largura={largura} altura={12} />
          </View>
        ))}
      </View>
      <View style={styles.botao} />
      <View style={styles.botao} />
    </Pulsar>
  );
}

const styles = StyleSheet.create({
  corpo: { gap: 14, paddingHorizontal: MARGEM_TELA },
  faixa: { backgroundColor: cores.trilho },
  resumo: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 26, padding: 18, gap: 12 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  indicador: { flexBasis: '47%', flexGrow: 1, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 16, gap: 8 },
  barras: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 26, paddingVertical: 16, paddingHorizontal: 18, gap: 14 },
  barra: { gap: 6 },
  botao: { height: 54, borderRadius: 27, backgroundColor: cores.trilho },
});
