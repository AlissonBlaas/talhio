import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { detalheDoItem, useEscala } from '@/features/escala';
import { cores, fontes } from '@/shared/theme/tokens';

/** Quem está escalado hoje, em linhas; "Completar" leva à aba Escala quando falta gente. */
export const EscalaDeHoje = memo(function EscalaDeHoje() {
  const { escala } = useEscala();
  const router = useRouter();
  if (!escala) return null;
  const aoAbrir = () => router.navigate('/escala');
  const faltam = escala.itens.filter((i) => !i.operador).length;
  return (
    <View style={styles.bloco}>
      <View style={styles.cabeca}>
        <Text style={styles.titulo}>Escala de hoje</Text>
        <Pressable accessibilityRole="button" onPress={aoAbrir} hitSlop={8} style={styles.completar}>
          <Text style={styles.completarTexto}>{faltam > 0 ? 'Completar' : 'Abrir'}</Text>
        </Pressable>
      </View>
      {escala.itens.slice(0, 4).map((item) => (
        <View key={item.maquinaId} style={styles.linha}>
          <Text style={styles.maquina} numberOfLines={1}>
            {item.maquinaNome}
          </Text>
          <Text style={[styles.detalhe, !item.operador && styles.semOperador]} numberOfLines={1}>
            {detalheDoItem(item)}
          </Text>
        </View>
      ))}
      {faltam > 0 ? <Text style={styles.faltam}>{faltam === 1 ? '1 máquina sem operador' : `${faltam} máquinas sem operador`}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bloco: { gap: 8 },
  cabeca: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titulo: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 26, color: cores.texto },
  completar: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  completarTexto: { fontFamily: fontes.rotulo, fontSize: 15, color: cores.folha },
  linha: { gap: 1, paddingVertical: 6, borderTopWidth: 1, borderTopColor: cores.borda },
  maquina: { fontFamily: fontes.rotulo, fontSize: 16, color: cores.texto },
  semOperador: { color: cores.alerta },
  detalhe: { fontFamily: fontes.regular, fontSize: 14, color: cores.textoSuave },
  faltam: { fontFamily: fontes.italico, fontSize: 14, color: cores.textoMedio },
});
