import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import type { Filtro } from '../hooks/useMaquinas';

const OPCOES: { valor: Filtro; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'trabalhando', rotulo: 'Trabalhando' },
  { valor: 'parada', rotulo: 'Paradas' },
  { valor: 'sem-sinal', rotulo: 'Sem sinal' },
];

type Props = { valor: Filtro; aoMudar: (filtro: Filtro) => void };

export function FiltroStatus({ valor, aoMudar }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linha} style={styles.rolagem}>
      {OPCOES.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <Pressable
            key={opcao.valor}
            accessibilityRole="button"
            accessibilityState={{ selected: ativo }}
            hitSlop={{ top: 2, bottom: 2 }}
            onPress={() => aoMudar(opcao.valor)}
            style={[styles.chip, ativo ? styles.chipAtivo : styles.chipInativo]}>
            <Text style={[styles.texto, { color: ativo ? cores.sobreMilho : cores.textoSobreEscuro }]}>{opcao.rotulo}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // A linha sangra até a borda da tela para rolar em aparelhos estreitos.
  rolagem: { marginHorizontal: -MARGEM_TELA, flexGrow: 0 },
  linha: { gap: 8, paddingHorizontal: MARGEM_TELA },
  chip: { height: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, justifyContent: 'center' },
  chipAtivo: { backgroundColor: cores.milho, borderColor: cores.milho },
  chipInativo: { backgroundColor: 'transparent', borderColor: 'rgba(241,242,236,0.35)' },
  texto: { fontFamily: fontes.rotulo, fontSize: 16, lineHeight: 20 },
});
