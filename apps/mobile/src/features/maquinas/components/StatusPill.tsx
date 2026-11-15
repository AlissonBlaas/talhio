import type { Maquina } from '@talhio/shared';
import { StyleSheet, Text, View } from 'react-native';

import { duracaoDesde } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

const VISUAL = {
  trabalhando: { texto: cores.sucesso, fundo: cores.sucessoFundo },
  parada: { texto: cores.alerta, fundo: cores.alertaFundo },
  'sem-sinal': { texto: cores.neutro, fundo: cores.neutroFundo },
} as const;

export function StatusPill({ maquina }: { maquina: Pick<Maquina, 'status' | 'paradaDesde'> }) {
  const visual = VISUAL[maquina.status];
  const rotulo =
    maquina.status === 'trabalhando'
      ? 'Trabalhando'
      : maquina.status === 'sem-sinal'
        ? 'Sem sinal'
        : maquina.paradaDesde
          ? `Parada ${duracaoDesde(maquina.paradaDesde)}`
          : 'Parada';
  return (
    <View style={[styles.pill, { backgroundColor: visual.fundo }]}>
      <Text style={[styles.texto, { color: visual.texto }]}>{rotulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  texto: { fontFamily: fontes.rotuloLeve, fontSize: 13, lineHeight: 16 },
});
