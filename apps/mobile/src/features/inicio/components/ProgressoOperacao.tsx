import type { Painel } from '@talhio/shared';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BarraAnimada } from '@/shared/components/animacoes';
import { cores, fontes } from '@/shared/theme/tokens';

import { usePainelParte } from '../hooks/usePainelParte';

const operacaoDe = (p: Painel) => p.operacaoAtual;

/** Andamento da operação em curso: a barra de milho é o que já foi feito, o resto do trilho é o que falta. */
export const ProgressoOperacao = memo(function ProgressoOperacao() {
  const operacao = usePainelParte(operacaoDe);
  if (!operacao) return null;
  const percentual = Math.round(operacao.percentual);
  return (
    <View style={styles.bloco}>
      <View style={styles.topo}>
        <Text style={styles.nome} numberOfLines={1}>
          {operacao.nome}
        </Text>
        <Text style={styles.percentual}>
          <Text style={styles.numero}>{percentual}%</Text> concluído
        </Text>
      </View>
      <View style={styles.trilho} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percentual }}>
        <BarraAnimada percentual={percentual} cor={cores.milho} altura={10} atrasoMs={250} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  bloco: { gap: 8 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  nome: { flexShrink: 1, fontFamily: fontes.titulo, fontSize: 22, lineHeight: 23, color: cores.texto },
  percentual: { fontFamily: fontes.regular, fontSize: 15, lineHeight: 20, color: cores.textoSuave },
  numero: { fontFamily: fontes.rotulo, fontSize: 18, color: cores.texto },
  trilho: { height: 10, borderRadius: 5, backgroundColor: cores.trilho, overflow: 'hidden' },
});
