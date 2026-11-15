import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

type Props = {
  rotulo: string;
  /** Já está no período corrente: não há para onde avançar. */
  noAtual: boolean;
  aoVoltar: () => void;
  aoAvancar: () => void;
  aoIrParaHoje: () => void;
};

/** ‹ rótulo › dentro do cabeçalho verde; "Hoje" aparece quando o período escolhido é antigo. */
export function SeletorData({ rotulo, noAtual, aoVoltar, aoAvancar, aoIrParaHoje }: Props) {
  return (
    <View style={styles.linha}>
      <Pressable accessibilityRole="button" accessibilityLabel="Período anterior" hitSlop={4} onPress={aoVoltar} style={styles.seta}>
        <Icone nome="voltar" cor={cores.textoSobreEscuro} tamanho={20} espessura={2.4} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar para o período atual" disabled={noAtual} onPress={aoIrParaHoje} style={styles.centro}>
        <Text numberOfLines={1} style={styles.rotulo}>
          {rotulo}
        </Text>
        {!noAtual ? <Text style={styles.hoje}>Ir para hoje</Text> : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próximo período"
        accessibilityState={{ disabled: noAtual }}
        disabled={noAtual}
        hitSlop={4}
        onPress={aoAvancar}
        style={[styles.seta, noAtual && styles.desligada]}>
        <View style={styles.espelho}>
          <Icone nome="voltar" cor={cores.textoSobreEscuro} tamanho={20} espessura={2.4} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  seta: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(241,242,236,0.14)' },
  desligada: { opacity: 0.3 },
  espelho: { transform: [{ scaleX: -1 }] },
  centro: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  rotulo: { fontFamily: fontes.rotulo, fontSize: 16, color: cores.textoSobreEscuro },
  hoje: { fontFamily: fontes.rotuloLeve, fontSize: 13, color: cores.milho },
});
