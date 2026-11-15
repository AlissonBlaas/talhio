import type { Plano } from '@talhio/shared';
import { StyleSheet, Text, View } from 'react-native';

import { Surgir } from '@/shared/components/animacoes';
import { cores, fontes } from '@/shared/theme/tokens';

import { quandoEOnde, resumoDoPlano } from '../textos';

/** Confirmação depois de salvar: o que ficou no plano e em que pé está o envio a cada máquina. */
export function PlanoSalvo({ plano }: { plano: Plano }) {
  return (
    <Surgir style={styles.cartao}>
      <Text style={styles.selo}>Plano salvo</Text>
      <Text style={styles.resumo}>{resumoDoPlano(plano)}</Text>
      <Text style={styles.quando}>{quandoEOnde(plano)}</Text>
      <View style={styles.maquinas}>
        {plano.maquinas.map((maquina) => (
          <View key={maquina.id} style={styles.maquina}>
            <Text style={styles.maquinaNome} numberOfLines={1}>
              {maquina.nome}
            </Text>
            <Text style={styles.estado}>Aguardando John Deere</Text>
          </View>
        ))}
      </View>
      <Text style={styles.nota}>
        O envio direto ao monitor depende de a John Deere liberar o acesso. Até lá, o plano chega à equipe pela escala: se começa hoje, a tarefa e o talhão já entraram na escala de hoje.
      </Text>
    </Surgir>
  );
}

const styles = StyleSheet.create({
  cartao: { backgroundColor: cores.escuro, borderRadius: 22, padding: 16, gap: 6 },
  selo: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 15, color: cores.destaqueSobreEscuro },
  resumo: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20, color: cores.textoSobreEscuro },
  quando: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoSobreEscuro, opacity: 0.8 },
  maquinas: { gap: 8, marginTop: 8 },
  maquina: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  maquinaNome: { flex: 1, fontFamily: fontes.medio, fontSize: 14, lineHeight: 18, color: cores.textoSobreEscuro },
  estado: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 15, color: cores.alerta, backgroundColor: cores.alertaFundo, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, overflow: 'hidden' },
  nota: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 17, color: cores.textoSobreEscuro, opacity: 0.8, marginTop: 8 },
});
