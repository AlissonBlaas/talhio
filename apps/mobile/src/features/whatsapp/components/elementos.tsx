import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

export function Botao({ rotulo, aoTocar, ocupado, contorno }: { rotulo: string; aoTocar: () => void; ocupado?: boolean; contorno?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ busy: !!ocupado }} disabled={ocupado} onPress={aoTocar} style={[styles.botao, contorno ? styles.botaoContorno : styles.botaoCheio]}>
      {ocupado ? <ActivityIndicator color={contorno ? cores.mata : cores.sobreMilho} /> : <Text style={[styles.botaoTexto, contorno && { color: cores.mata }]}>{rotulo}</Text>}
    </Pressable>
  );
}

export function Erro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <View accessibilityRole="alert" style={styles.erro}>
      <Icone nome="atencao" cor={cores.perigoTexto} tamanho={18} />
      <Text style={styles.erroTexto}>{mensagem}</Text>
    </View>
  );
}

export function Aviso({ icone, titulo, texto }: { icone: 'confere' | 'atencao'; titulo: string; texto: string }) {
  return (
    <View style={styles.aviso}>
      <View style={styles.avisoIcone}>
        <Icone nome={icone} cor={cores.sobreMilho} tamanho={18} espessura={2.4} />
      </View>
      <View style={styles.avisoTextos}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.texto}>{texto}</Text>
      </View>
    </View>
  );
}

export const estilosWhatsapp = StyleSheet.create({
  bloco: { gap: 12 },
  titulo: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 26, color: cores.texto },
  texto: { fontFamily: fontes.regular, fontSize: 15, lineHeight: 22, color: cores.textoMedio },
});

const styles = StyleSheet.create({
  ...estilosWhatsapp,
  botao: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  botaoCheio: { backgroundColor: cores.milho },
  botaoContorno: { borderWidth: 2, borderColor: cores.mata },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
  aviso: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  avisoIcone: { width: 32, height: 32, borderRadius: 16, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  avisoTextos: { flex: 1, gap: 4 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
  erroTexto: { flex: 1, fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, color: cores.perigoTexto },
});
