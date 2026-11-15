import type { Painel } from '@talhio/shared';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { duracaoDesde, horaDoDia } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { usePainelParte } from '../hooks/usePainelParte';

const alertaDe = (p: Painel) => p.alerta;

/** Máquina parada: uma linha entre dois fios, com o ícone em milho. Sem cartão. */
export const CartaoAlerta = memo(function CartaoAlerta() {
  const alerta = usePainelParte(alertaDe);
  const router = useRouter();
  const aoVer = () => router.navigate('/maquinas');
  if (!alerta) return null;
  const onde = alerta.talhaoNome ? `No ${alerta.talhaoNome.toLowerCase()}` : 'Fora de talhão';
  const motor = alerta.motorLigado ? 'com o motor ligado' : 'com o motor desligado';
  return (
    <View style={styles.linha}>
      <View style={styles.icone}>
        <Icone nome="atencao" cor={cores.milho} tamanho={26} espessura={2.4} />
      </View>
      <View style={styles.textos}>
        <Text style={styles.titulo}>
          {alerta.maquinaNome} parado há {duracaoDesde(alerta.desde)}
        </Text>
        <Text style={styles.descricao}>
          {onde} desde {horaDoDia(alerta.desde)}, {motor}.
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Ver máquina parada" hitSlop={8} onPress={aoVer} style={styles.ver}>
        <Text style={styles.verTexto}>Ver</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 28, backgroundColor: cores.milho },
  icone: { width: 48, height: 48, borderRadius: 24, backgroundColor: cores.mata, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
  titulo: { fontFamily: fontes.titulo, fontSize: 19, lineHeight: 22, color: cores.sobreMilho },
  descricao: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, color: cores.sobreMilho },
  ver: { minHeight: 44, minWidth: 56, paddingHorizontal: 16, borderRadius: 22, backgroundColor: cores.mata, alignItems: 'center', justifyContent: 'center' },
  verTexto: { fontFamily: fontes.rotulo, fontSize: 16, color: cores.milho },
});
