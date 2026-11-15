import type { Periodo } from '@talhio/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

const OPCOES: { valor: Periodo; rotulo: string }[] = [
  { valor: 'dia', rotulo: 'Hoje' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
];

export function SeletorPeriodo({ valor, aoMudar }: { valor: Periodo; aoMudar: (periodo: Periodo) => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.trilho}>
      {OPCOES.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <Pressable
            key={opcao.valor}
            accessibilityRole="tab"
            accessibilityState={{ selected: ativo }}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => aoMudar(opcao.valor)}
            style={[styles.opcao, ativo && styles.opcaoAtiva]}>
            <Text style={[styles.texto, ativo ? styles.textoAtivo : styles.textoInativo]}>{opcao.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trilho: { alignSelf: 'stretch', flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, backgroundColor: 'rgba(241,242,236,0.14)' },
  opcao: { flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  opcaoAtiva: { backgroundColor: cores.milho },
  texto: { fontSize: 16 },
  textoAtivo: { fontFamily: fontes.rotulo, color: cores.sobreMilho },
  textoInativo: { fontFamily: fontes.rotuloLeve, color: cores.suaveSobreEscuro },
});
