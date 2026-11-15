import type { Operacao } from '@talhio/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

import { OPERACOES } from '../textos';

/** As quatro operações, lado a lado; uma fica marcada. */
export function SeletorDeOperacao({ valor, aoMudar }: { valor: Operacao; aoMudar: (operacao: Operacao) => void }) {
  return (
    <View style={styles.trilho}>
      {OPERACOES.map((operacao) => {
        const marcada = operacao.valor === valor;
        return (
          <Pressable
            key={operacao.valor}
            accessibilityRole="button"
            accessibilityState={{ selected: marcada }}
            onPress={() => aoMudar(operacao.valor)}
            style={[styles.opcao, marcada && styles.marcada]}>
            <Text style={[styles.texto, marcada && styles.textoMarcado]} numberOfLines={1}>
              {operacao.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trilho: { flexDirection: 'row', gap: 6, backgroundColor: cores.desabilitado, padding: 4, borderRadius: 22 },
  opcao: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  marcada: { backgroundColor: cores.cartao, shadowColor: cores.escuro, shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  texto: { fontFamily: fontes.medio, fontSize: 12, color: cores.textoSuave },
  textoMarcado: { fontFamily: fontes.semi, color: cores.texto },
});
