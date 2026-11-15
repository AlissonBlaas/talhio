import type { ConversaResumo } from '@talhio/shared';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

type Props = {
  conversas: ConversaResumo[];
  carregando: boolean;
  erro: string | null;
  abertaId: string | null;
  aoAbrir: (id: string) => void;
  aoApagar: (id: string) => void;
  aoTentar: () => void;
  /** Chamado quando a lista chega perto do fim: hora de buscar a próxima página. */
  aoChegarAoFim: () => void;
  carregandoMais: boolean;
};

/** "hoje, 09:41", "ontem, 17:20" ou "8 de nov." */
function quando(iso: string): string {
  const data = new Date(iso);
  const hoje = new Date();
  const dias = Math.round((new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime() - new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime()) / 86_400_000);
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (dias === 0) return `hoje, ${hora}`;
  if (dias === 1) return `ontem, ${hora}`;
  return data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

/** Lista das conversas anteriores, da mais recente para a mais antiga. */
export function Historico({ conversas, carregando, erro, abertaId, aoAbrir, aoApagar, aoTentar, aoChegarAoFim, carregandoMais }: Props) {
  if (carregando) return <ActivityIndicator color={cores.primario} style={styles.espera} />;
  const cabecalho = (
    <View style={styles.caixa}>
      <Text style={styles.titulo}>Conversas anteriores</Text>
      {erro ? (
        <Pressable accessibilityRole="button" onPress={aoTentar} style={styles.erro}>
          <Text style={styles.erroTexto}>{erro} Toque para tentar de novo.</Text>
        </Pressable>
      ) : null}
      {conversas.length === 0 && !erro ? <Text style={styles.vazio}>Você ainda não tem conversas guardadas. Cada pergunta que você faz fica aqui para consultar depois.</Text> : null}
    </View>
  );
  // Lista que só desenha o que está na tela e busca mais páginas ao chegar perto do fim.
  return (
    <FlatList
      data={conversas}
      keyExtractor={(conversa) => conversa.id}
      style={styles.lista}
      contentContainerStyle={styles.conteudo}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={cabecalho}
      ListFooterComponent={carregandoMais ? <ActivityIndicator color={cores.primario} style={styles.mais} /> : undefined}
      onEndReached={aoChegarAoFim}
      onEndReachedThreshold={0.4}
      renderItem={({ item: conversa }) => (
        <View style={[styles.item, conversa.id === abertaId && styles.itemAberto]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Abrir conversa: ${conversa.titulo}`} onPress={() => aoAbrir(conversa.id)} style={styles.itemTextos}>
            <Text style={styles.itemTitulo} numberOfLines={2}>
              {conversa.titulo}
            </Text>
            <Text style={styles.itemQuando}>{quando(conversa.atualizadaEm)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Apagar conversa: ${conversa.titulo}`}
            hitSlop={8}
            onPress={() =>
              Alert.alert('Apagar esta conversa?', 'Ela some do histórico e não dá para recuperar.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Apagar', style: 'destructive', onPress: () => aoApagar(conversa.id) },
              ])
            }
            style={styles.apagar}>
            <Text style={styles.apagarTexto}>Apagar</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  espera: { marginTop: 48 },
  lista: { flex: 1 },
  conteudo: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 8 },
  mais: { marginVertical: 12 },
  caixa: { gap: 8, paddingTop: 4 },
  titulo: { fontFamily: fontes.titulo, fontSize: 20, lineHeight: 22, color: cores.texto, marginBottom: 4 },
  vazio: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 21, color: cores.textoMedio },
  item: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 14, paddingLeft: 14, paddingRight: 6 },
  itemAberto: { borderColor: cores.primario },
  itemTextos: { flex: 1, paddingVertical: 10, gap: 2 },
  itemTitulo: { fontFamily: fontes.medio, fontSize: 14, lineHeight: 19, color: cores.texto },
  itemQuando: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  apagar: { minHeight: 44, paddingHorizontal: 10, justifyContent: 'center' },
  apagarTexto: { fontFamily: fontes.medio, fontSize: 13, color: cores.perigo },
  erro: { backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  erroTexto: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.perigoTexto },
});
