import type { Notificacao } from '@talhio/shared';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { CartaoNotificacao } from '../components/CartaoNotificacao';
import { useMarcarLidas, useNotificacoes } from '../hooks/useNotificacoes';

/** A aba de notificações: os alertas das máquinas, do mais novo para o mais antigo. Abrir a tela marca tudo como visto. */
export function NotificacoesScreen() {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { itens, naoLidas, carregando, erro, atualizando, atualizar } = useNotificacoes();
  const marcar = useMarcarLidas();
  // Quais eram novas quando a tela abriu: ficam destacadas mesmo depois de marcadas como vistas.
  const novasAoAbrir = useRef<number | null>(null);
  if (novasAoAbrir.current === null && !carregando && !erro) novasAoAbrir.current = naoLidas;

  useEffect(() => {
    if (!carregando && !erro && naoLidas > 0) marcar.mutate();
    // Marca uma vez quando a lista chega; chegadas depois (com a tela aberta) entram na próxima abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, erro]);

  const abrir = (n: Notificacao) => {
    if (n.maquinaId) router.push({ pathname: '/maquina/[id]', params: { id: n.maquinaId } });
  };

  return (
    <View style={styles.tela}>
      <ScrollView
        contentContainerStyle={[styles.conteudo, { paddingBottom: Math.max(bottom, 16) + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={cores.milho} />}>
        <CabecalhoTela voltar titulo="Notificações" subtitulo="Alertas das máquinas da fazenda" />
        <View style={styles.corpo}>
          {carregando ? (
            <Carregando />
          ) : erro ? (
            <ErroComTentarDeNovo mensagem="Não consegui ver as notificações agora." aoTentar={atualizar} />
          ) : itens.length === 0 ? (
            <View style={styles.vazio}>
              <Text style={styles.vazioTitulo}>Nenhum alerta por enquanto</Text>
              <Text style={styles.vazioTexto}>Quando uma máquina parar no meio do trabalho, ficar sem sinal, estiver com o tanque baixo ou registrar uma falha, o aviso aparece aqui e no seu celular.</Text>
            </View>
          ) : (
            itens.map((n, indice) => <CartaoNotificacao key={n.id} notificacao={n} nova={indice < (novasAoAbrir.current ?? 0)} aoAbrir={abrir} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { flexGrow: 1 },
  corpo: { paddingHorizontal: MARGEM_TELA, paddingTop: 16, gap: 10 },
  vazio: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 24, padding: 22, gap: 8 },
  vazioTitulo: { fontFamily: fontes.titulo, fontSize: 19, lineHeight: 23, color: cores.texto },
  vazioTexto: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 20, color: cores.textoMedio },
});
