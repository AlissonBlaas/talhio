import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

/** Estados padrão de toda tela: carregando, erro com tentar de novo, e vazio. */
export function Carregando() {
  return (
    <View style={styles.centro}>
      <ActivityIndicator color={cores.primario} />
    </View>
  );
}

export function ErroComTentarDeNovo({ mensagem, aoTentar }: { mensagem: string; aoTentar: () => void }) {
  return (
    <View style={styles.centro}>
      <Text style={styles.texto}>{mensagem}</Text>
      <Pressable accessibilityRole="button" onPress={aoTentar} style={styles.botao}>
        <Text style={styles.botaoTexto}>Tentar de novo</Text>
      </Pressable>
    </View>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <View style={styles.centro}>
      <Text style={[styles.texto, { color: cores.textoSuave }]}>{children}</Text>
    </View>
  );
}

/** Tela de aba que ainda não foi construída. */
export function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <View style={[styles.centro, { backgroundColor: cores.fundo }]}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={[styles.texto, { color: cores.textoSuave }]}>Esta tela chega nos próximos passos.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  titulo: { fontFamily: fontes.titulo, fontSize: 22, color: cores.texto },
  texto: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 20, color: cores.texto, textAlign: 'center' },
  botao: { minHeight: 48, paddingHorizontal: 24, borderRadius: 999, justifyContent: 'center', backgroundColor: cores.milho },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 16, color: cores.sobreMilho },
});
