import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

/** Cartão com título e linhas "rótulo — valor". */
export function SecaoDados({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={styles.secao}>
      <Text style={styles.titulo}>{titulo}</Text>
      <View style={styles.cartao}>{children}</View>
    </View>
  );
}

/** `aviso`: o valor fica em laranja, com um texto curto embaixo dizendo por quê. */
export function LinhaDado({ rotulo, valor, aviso, children }: { rotulo: string; valor: string; aviso?: string; children?: ReactNode }) {
  return (
    <View style={styles.linha}>
      <View style={styles.linhaTopo}>
        <Text style={styles.rotulo}>{rotulo}</Text>
        <Text style={[styles.valor, aviso ? styles.valorAviso : null]} numberOfLines={1}>
          {valor}
        </Text>
      </View>
      {aviso ? <Text style={styles.aviso}>{aviso}</Text> : null}
      {children}
    </View>
  );
}

/** Barra de nível (combustível). Fica em cor de alerta quando está baixo. */
export function BarraNivel({ percentual, baixo, suspeito = false }: { percentual: number; baixo: boolean; suspeito?: boolean }) {
  return (
    <View style={styles.trilho}>
      <View style={[styles.barra, { width: `${percentual}%`, backgroundColor: suspeito ? cores.aviso : baixo ? cores.parada : cores.primario }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  secao: { gap: 8 },
  titulo: { fontFamily: fontes.semi, fontSize: 13, lineHeight: 16, color: cores.textoSuave },
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 22, paddingHorizontal: 16, overflow: 'hidden' },
  // A margem negativa esconde o divisor da última linha atrás da borda do cartão.
  linha: { paddingVertical: 13, gap: 8, borderBottomWidth: 1, borderBottomColor: cores.divisor, marginBottom: -1 },
  linhaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  rotulo: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 18, color: cores.textoMedio },
  valor: { flexShrink: 1, fontFamily: fontes.semi, fontSize: 14, lineHeight: 18, color: cores.texto, textAlign: 'right' },
  valorAviso: { color: cores.aviso },
  aviso: { fontFamily: fontes.medio, fontSize: 12, lineHeight: 16, color: cores.aviso, textAlign: 'right' },
  trilho: { height: 8, borderRadius: 4, backgroundColor: cores.divisor, overflow: 'hidden' },
  barra: { height: 8, borderRadius: 4 },
});
