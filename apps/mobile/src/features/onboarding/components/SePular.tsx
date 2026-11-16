import { StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

/**
 * O que a pessoa fica sem se pular o passo. Fica sempre à vista, antes dos botões: pular é permitido, mas ninguém
 * pula sem saber o que perde. `feito`: o passo já foi concluído, então o aviso vira confirmação.
 */
export function SePular({ itens, feito, textoFeito }: { itens: string[]; feito: boolean; textoFeito: string }) {
  if (feito) {
    return (
      <View style={[styles.caixa, styles.caixaFeita]}>
        <View style={[styles.icone, styles.iconeFeito]}>
          <Icone nome="confere" cor={cores.sobreEscuro} tamanho={16} espessura={2.6} />
        </View>
        <Text style={[styles.titulo, styles.tituloFeito]}>{textoFeito}</Text>
      </View>
    );
  }
  return (
    <View accessibilityRole="alert" style={styles.caixa}>
      <View style={styles.topo}>
        <View style={styles.icone}>
          <Icone nome="atencao" cor={cores.alerta} tamanho={16} espessura={2.4} />
        </View>
        <Text style={styles.titulo}>Se você pular este passo</Text>
      </View>
      {itens.map((item) => (
        <View key={item} style={styles.linha}>
          <View style={styles.ponto} />
          <Text style={styles.texto}>{item}</Text>
        </View>
      ))}
      <Text style={styles.rodape}>Dá para fazer depois, em Configurações.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { backgroundColor: cores.alertaFundo, borderRadius: 22, padding: 16, gap: 10 },
  caixaFeita: { backgroundColor: cores.sucessoFundo, flexDirection: 'row', alignItems: 'center' },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icone: { width: 28, height: 28, borderRadius: 14, backgroundColor: cores.cartao, alignItems: 'center', justifyContent: 'center' },
  iconeFeito: { backgroundColor: cores.folha },
  titulo: { flex: 1, fontFamily: fontes.rotulo, fontSize: 16, lineHeight: 20, color: cores.alerta },
  tituloFeito: { color: cores.sucesso },
  linha: { flexDirection: 'row', gap: 10 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.alerta, marginTop: 8 },
  texto: { flex: 1, fontFamily: fontes.regular, fontSize: 15, lineHeight: 21, color: cores.textoMedio },
  rodape: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.textoSuave },
});
