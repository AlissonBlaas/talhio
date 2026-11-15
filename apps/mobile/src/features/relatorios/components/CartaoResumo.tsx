import { StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

export function CartaoResumo({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <View style={styles.cartao}>
      <View style={styles.topo}>
        <View style={styles.selo}>
          <Icone nome="ia" cor={cores.sobreMilho} tamanho={16} espessura={2.2} />
        </View>
        <Text style={styles.titulo}>{titulo}</Text>
      </View>
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 26, padding: 18, gap: 10 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selo: { width: 30, height: 30, borderRadius: 10, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 26, color: cores.texto },
  texto: { fontFamily: fontes.regular, fontSize: 16, lineHeight: 24, color: cores.textoMedio },
});
