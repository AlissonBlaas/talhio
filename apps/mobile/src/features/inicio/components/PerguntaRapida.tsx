import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

const SUGESTOES = ['“Quanto fizemos hoje?”', '“Qual máquina ficou mais parada?”'];

/** Campo em pílula que abre o assistente, com o microfone redondo e duas perguntas de exemplo. */
export const PerguntaRapida = memo(function PerguntaRapida() {
  const router = useRouter();
  const aoAbrir = () => router.navigate('/assistente');
  return (
    <View style={styles.bloco}>
      <Text style={styles.titulo}>Pergunte à IA</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Perguntar ao assistente" onPress={aoAbrir} style={styles.campo}>
        <Text style={styles.placeholder}>Pergunte sobre a fazenda…</Text>
        <View style={styles.mic}>
          <Icone nome="microfone" cor={cores.sobreMilho} tamanho={20} espessura={2.2} />
        </View>
      </Pressable>
      {SUGESTOES.map((s) => (
        <Pressable key={s} accessibilityRole="button" onPress={aoAbrir} style={styles.sugestao}>
          <Text style={styles.sugestaoTexto}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  bloco: { gap: 6 },
  titulo: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 26, color: cores.texto, marginBottom: 6 },
  campo: { minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.cartao, flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 6 },
  placeholder: { flex: 1, fontFamily: fontes.regular, fontSize: 16, color: cores.textoSuave },
  mic: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  sugestao: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  sugestaoTexto: { fontFamily: fontes.italico, fontSize: 15, color: cores.textoMedio },
});
