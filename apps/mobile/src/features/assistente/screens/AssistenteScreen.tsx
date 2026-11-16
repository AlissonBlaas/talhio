import type { Mensagem } from '@talhio/shared';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAlturaDaBarra } from '@/shared/components/BarraDeAbas';
import { Surgir } from '@/shared/components/animacoes';
import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

import { Balao, Pensando } from '../components/Balao';
import { Historico } from '../components/Historico';
import { CampoDePergunta } from '../components/CampoDePergunta';
import { Inicio } from '../components/Inicio';
import { useConversa } from '../hooks/useConversa';
import { useGravacaoDeVoz } from '../hooks/useGravacaoDeVoz';
import { useHistorico } from '../hooks/useHistorico';

type Fala = { chave: string; mensagem: Mensagem };

export function AssistenteScreen() {
  const alturaBarra = useAlturaDaBarra();
  const conversa = useConversa();
  const [rascunho, setRascunho] = useState('');
  const [verHistorico, setVerHistorico] = useState(false);
  const historico = useHistorico(verHistorico);
  const lista = useRef<ComponentRef<typeof FlatList<Fala>>>(null);
  // A lista é invertida (a mais nova fica embaixo, na posição zero). A chave de cada fala é o
  // número dela na conversa: não muda quando chegam falas mais antigas ou mais novas.
  const falas = useMemo<Fala[]>(
    () => conversa.mensagens.map((mensagem, i) => ({ chave: String(conversa.primeiraOrdem + i), mensagem })).reverse(),
    [conversa.mensagens, conversa.primeiraOrdem],
  );

  const enviar = (texto: string) => {
    setVerHistorico(false);
    conversa.perguntar(texto);
    setRascunho('');
    // Quem estava lendo lá em cima volta para o fim ao perguntar.
    lista.current?.scrollToOffset({ offset: 0, animated: true });
  };
  // Áudio como no WhatsApp: segura o microfone, fala e solta; o que foi dito vira a pergunta e já é enviado.
  const voz = useGravacaoDeVoz(enviar);
  const vazia = conversa.mensagens.length === 0 && !conversa.pensando && !conversa.abrindo;

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <CabecalhoTela
        titulo="Assistente"
        subtitulo="Conhece máquinas, talhões e relatórios"
        direita={
          <View style={styles.botoes}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={verHistorico ? 'Fechar o histórico' : 'Conversas anteriores'}
          accessibilityState={{ selected: verHistorico }}
          onPress={() => setVerHistorico((atual) => !atual)}
          style={[styles.nova, verHistorico && styles.novaAtiva]}>
          <Icone nome="historico" cor={verHistorico ? cores.sobreMilho : cores.textoSobreEscuro} tamanho={18} espessura={2} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nova conversa"
          disabled={vazia && !verHistorico}
          onPress={() => {
            setVerHistorico(false);
            conversa.novaConversa();
            setRascunho('');
            voz.limparAviso();
          }}
          style={[styles.nova, vazia && !verHistorico && styles.novaDesligada]}>
          <Icone nome="mais" cor={cores.textoSobreEscuro} tamanho={18} espessura={2} />
        </Pressable>
          </View>
        }
      />

      {verHistorico ? (
        <Historico
          conversas={historico.conversas}
          carregando={historico.carregando}
          erro={historico.erro?.message ?? null}
          abertaId={conversa.conversaId}
          aoAbrir={(id) => {
            setVerHistorico(false);
            conversa.abrir(id);
          }}
          aoApagar={(id) => void historico.apagar(id).then(() => conversa.aoApagar(id)).catch(() => undefined)}
          aoTentar={historico.atualizar}
          aoChegarAoFim={historico.carregarMais}
          carregandoMais={historico.carregandoMais}
        />
      ) : vazia ? (
        <ScrollView style={styles.rolagem} contentContainerStyle={styles.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Inicio aoPerguntar={enviar} />
        </ScrollView>
      ) : (
        // Só as falas visíveis são desenhadas; as mais antigas vêm do servidor aos poucos, ao subir.
        <FlatList
          ref={lista}
          inverted
          data={falas}
          keyExtractor={(fala) => fala.chave}
          renderItem={({ item, index }) => <Balao mensagem={item.mensagem} variant={index < conversa.novas ? 'nova' : 'antiga'} />}
          style={styles.rolagem}
          // Invertida: "flex-end" encosta uma conversa curta no alto da tela.
          contentContainerStyle={styles.conversa}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          onEndReached={conversa.carregarAnteriores}
          onEndReachedThreshold={0.3}
          // Em lista invertida, o "rodapé" fica no alto (falas antigas) e o "cabeçalho" embaixo (o que acabou de acontecer).
          ListFooterComponent={conversa.carregandoAnteriores ? <ActivityIndicator color={cores.folha} style={styles.anteriores} /> : undefined}
          ListHeaderComponent={
            <View style={styles.fim}>
              {conversa.pensando || conversa.abrindo ? <Pensando /> : null}

              {conversa.erro && !conversa.pensando ? (
                <View accessibilityRole="alert" style={styles.erro}>
                  <Text style={styles.erroTexto}>{conversa.erro.message}</Text>
                  <Pressable accessibilityRole="button" onPress={conversa.tentarDeNovo} hitSlop={8}>
                    <Text style={styles.erroAcao}>Tentar de novo</Text>
                  </Pressable>
                </View>
              ) : null}

              {conversa.sugestoes.length > 0 && !conversa.pensando ? (
                <Surgir modo="leve" style={styles.atalhos}>
                  {conversa.sugestoes.map((sugestao) => (
                    <Pressable key={sugestao} accessibilityRole="button" onPress={() => enviar(sugestao)} style={styles.atalho}>
                      <Text style={styles.atalhoTexto}>{sugestao}</Text>
                    </Pressable>
                  ))}
                </Surgir>
              ) : null}
            </View>
          }
        />
      )}

      <View style={[styles.rodape, { paddingBottom: alturaBarra + 10 }]}>
        {voz.aviso ? <Text style={styles.aviso}>{voz.aviso}</Text> : null}
        <CampoDePergunta texto={rascunho} aoMudar={setRascunho} aoEnviar={() => enviar(rascunho)} voz={voz} ocupado={conversa.ocupado} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  botoes: { flexDirection: 'row', gap: 8 },
  nova: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(241,242,236,0.35)', alignItems: 'center', justifyContent: 'center' },
  novaDesligada: { opacity: 0.4 },
  novaAtiva: { backgroundColor: cores.milho, borderColor: cores.milho },
  rolagem: { flex: 1 },
  conteudo: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, gap: 12 },
  conversa: { paddingHorizontal: 16, paddingVertical: 12, gap: 12, flexGrow: 1, justifyContent: 'flex-end' },
  fim: { gap: 12 },
  anteriores: { marginVertical: 12 },
  erro: { alignSelf: 'flex-start', maxWidth: 320, backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, gap: 6 },
  erroTexto: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.perigoTexto },
  erroAcao: { fontFamily: fontes.semi, fontSize: 13, color: cores.folha },
  atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  atalho: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: cores.atalhoBorda, backgroundColor: cores.cartao },
  atalhoTexto: { fontFamily: fontes.medio, fontSize: 13, color: cores.sucesso },
  rodape: { paddingHorizontal: 12, paddingTop: 8, gap: 6 },
  aviso: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 16, color: cores.perigo, paddingHorizontal: 8 },
});
