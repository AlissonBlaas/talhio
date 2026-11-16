import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { MapaResumo } from '@/features/mapa';
import { Icone } from '@/shared/components/Icone';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

const ALTURA = 200;

/** Cartão da tela Início com a visão geral da fazenda no satélite. */
export const MiniMapa = memo(function MiniMapa() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const largura = width - MARGEM_TELA * 2;
  const aoAbrir = () => router.navigate('/mapa');
  return (
    <View style={[styles.cartao, { width: largura, height: ALTURA }]}>
      <MapaResumo aoTocar={aoAbrir} />

      <Pressable accessibilityRole="button" onPress={aoAbrir} style={styles.abrir}>
        <Icone nome="expandir" cor={cores.sobreMilho} tamanho={16} espessura={2.2} />
        <Text style={styles.abrirTexto}>Abrir mapa</Text>
      </Pressable>

      <View pointerEvents="none" style={styles.legenda}>
        <Item cor={cores.folha} rotulo="Trabalhando" />
        <Item cor={cores.parada} rotulo="Parada" />
        <Item cor={cores.semSinalNoMapa} rotulo="Sem sinal" />
      </View>
    </View>
  );
});

function Item({ cor, rotulo }: { cor?: string; rotulo: string }) {
  return (
    <View style={styles.item}>
      <View style={[styles.ponto, cor ? { backgroundColor: cor } : styles.pontoVazado]} />
      <Text style={styles.itemTexto}>{rotulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: { borderRadius: 24, overflow: 'hidden', backgroundColor: cores.mapaFundo },
  abrir: {
    position: 'absolute',
    top: 10,
    right: 10,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: cores.milho,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  abrirTexto: { fontFamily: fontes.rotulo, fontSize: 14, lineHeight: 15, color: cores.sobreMilho },
  legenda: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: cores.cartao,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 12,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  pontoVazado: { borderWidth: 2, borderColor: cores.mapaFundo },
  itemTexto: { fontFamily: fontes.regular, fontSize: 11, lineHeight: 14, color: cores.textoMedio },
});
