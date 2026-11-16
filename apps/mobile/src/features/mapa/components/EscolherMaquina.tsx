import type { Maquina } from '@talhio/shared';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

const ESTADO = { trabalhando: 'Operando', parada: 'Parada', 'sem-sinal': 'Sem sinal' } as const;
const COR = { trabalhando: cores.folha, parada: cores.parada, 'sem-sinal': cores.semSinalNoMapa } as const;
const ORDEM: Maquina['status'][] = ['trabalhando', 'parada', 'sem-sinal'];

type Props = { maquinas: Maquina[]; aoEscolher: (id: string) => void; aoFechar: () => void };

/** Máquinas que estão no mesmo lugar do mapa: a pessoa escolhe qual quer ver. Vazio = fechado. */
export function EscolherMaquina({ maquinas, aoEscolher, aoFechar }: Props) {
  const { bottom } = useSafeAreaInsets();
  const naOrdem = [...maquinas].sort((a, b) => ORDEM.indexOf(a.status) - ORDEM.indexOf(b.status));
  return (
    <Modal visible={maquinas.length > 0} transparent animationType="fade" onRequestClose={aoFechar}>
      <Pressable accessibilityLabel="Fechar" onPress={aoFechar} style={styles.fundo}>
        {/* O toque dentro da folha não fecha. */}
        <Pressable style={[styles.folha, { paddingBottom: Math.max(bottom, 16) }]}>
          <View style={styles.cabeca}>
            <Text style={styles.titulo}>{maquinas.length} máquinas neste ponto</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={aoFechar} style={styles.fechar}>
              <Icone nome="fechar" cor={cores.texto} tamanho={18} espessura={2} />
            </Pressable>
          </View>
          <ScrollView style={styles.lista} showsVerticalScrollIndicator={false}>
            {naOrdem.map((maquina) => (
              <Pressable key={maquina.id} accessibilityRole="button" accessibilityLabel={`${maquina.nome}, ${ESTADO[maquina.status]}`} onPress={() => aoEscolher(maquina.id)} style={({ pressed }) => [styles.linha, pressed && styles.apertada]}>
                <View style={[styles.ponto, { backgroundColor: COR[maquina.status] }]} />
                <View style={styles.textos}>
                  <Text style={styles.nome} numberOfLines={1}>
                    {maquina.nome}
                  </Text>
                  <Text style={styles.detalhe} numberOfLines={1}>
                    {[ESTADO[maquina.status], maquina.operador].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(21,50,31,0.35)' },
  folha: { backgroundColor: cores.cartao, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 16, paddingHorizontal: 20, maxHeight: '60%' },
  cabeca: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  titulo: { fontFamily: fontes.titulo, fontSize: 20, lineHeight: 24, color: cores.texto },
  fechar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo },
  lista: { flexGrow: 0 },
  linha: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: cores.borda },
  apertada: { opacity: 0.6 },
  ponto: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF' },
  textos: { flex: 1, gap: 2, minWidth: 0 },
  nome: { fontFamily: fontes.rotulo, fontSize: 17, lineHeight: 21, color: cores.texto },
  detalhe: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoSuave },
});
