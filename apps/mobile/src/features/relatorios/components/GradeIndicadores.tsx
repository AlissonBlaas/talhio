import { StyleSheet, Text, View } from 'react-native';

import { Surgir } from '@/shared/components/animacoes';
import { cores, fontes } from '@/shared/theme/tokens';

import type { Indicador } from '../textos';

export function GradeIndicadores({ indicadores }: { indicadores: Indicador[] }) {
  return (
    <View style={styles.grade}>
      {indicadores.map((indicador, indice) => (
        <Surgir key={indicador.rotulo} ordem={indice + 1} style={styles.cartao}>
          <Text style={styles.rotulo}>{indicador.rotulo}</Text>
          <Text style={styles.valor} numberOfLines={1} adjustsFontSizeToFit>
            {indicador.valor}
          </Text>
          <Text style={[styles.variacao, { color: indicador.bom ? cores.folha : cores.perigo }]} numberOfLines={1}>
            {indicador.variacao}
          </Text>
        </Surgir>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Dois por linha: metade da largura menos metade do espaço entre eles.
  cartao: { flexBasis: '47%', flexGrow: 1, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 2 },
  rotulo: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoSuave },
  valor: { fontFamily: fontes.titulo, fontSize: 30, lineHeight: 34, color: cores.texto },
  variacao: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 17 },
});
