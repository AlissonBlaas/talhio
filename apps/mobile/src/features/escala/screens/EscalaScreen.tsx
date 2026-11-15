import { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTalhoes } from '@/features/talhoes';
import { Surgir } from '@/shared/components/animacoes';
import { useAlturaDaBarra } from '@/shared/components/BarraDeAbas';
import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { Icone } from '@/shared/components/Icone';
import { useEnviarAoGrupo } from '@/features/whatsapp';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { EditorDaEscala } from '../components/EditorDaEscala';
import { LinhaDaEscala } from '../components/LinhaDaEscala';
import { useEscala } from '../hooks/useEscala';
import { useMudarEscala } from '../hooks/useMudarEscala';
import { diaPorExtenso, itensComOperador, textoDaEscala } from '../textos';

export function EscalaScreen() {
  const alturaBarra = useAlturaDaBarra();
  const { escala, carregando, erro, atualizando, atualizar } = useEscala();
  const { talhoes } = useTalhoes();
  const mudar = useMudarEscala();
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const envio = useEnviarAoGrupo();

  const editando = escala?.itens.find((i) => i.maquinaId === editandoId) ?? null;
  const comOperador = escala ? itensComOperador(escala) : [];
  const sugeridas = comOperador.filter((i) => !i.definida);
  const enviada = comOperador.length > 0 && comOperador.every((i) => i.enviadaEm);
  const operadores = [...new Set((escala?.itens ?? []).flatMap((i) => (i.operador ? [i.operador] : [])))];

  const fechar = () => {
    mudar.limparErro();
    setEditandoId(null);
  };
  const enviar = async () => {
    if (!escala) return;
    // Só registra o envio se a mensagem saiu (no grupo da fazenda ou pelo WhatsApp do aparelho).
    if (await envio.enviar({ texto: textoDaEscala(escala) })) mudar.marcarEnviada(undefined);
  };

  return (
    <View style={styles.tela}>
      <ScrollView
        contentContainerStyle={[styles.conteudo, { paddingBottom: alturaBarra + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={cores.milho} />}>
        <CabecalhoTela titulo="Escala de hoje" subtitulo={escala ? `${diaPorExtenso(escala.dia)} · quem vai em qual máquina e talhão` : 'Quem vai em qual máquina e talhão'} />

        {carregando ? (
          <View style={styles.espera}>
            <Carregando />
          </View>
        ) : erro || !escala ? (
          <View style={styles.espera}>
            <ErroComTentarDeNovo mensagem={erro?.message ?? 'Não deu para carregar a escala.'} aoTentar={atualizar} />
          </View>
        ) : (
          <View style={styles.corpo}>
            <View style={styles.lista}>
              {escala.itens.map((item, i) => (
                <Surgir key={item.maquinaId} ordem={i}>
                  <LinhaDaEscala item={item} aoTocar={() => setEditandoId(item.maquinaId)} />
                </Surgir>
              ))}
            </View>

            <View style={styles.aviso}>
              <View style={styles.avisoIcone}>
                <Icone nome="enviar" cor={cores.textoSobreSuave} tamanho={18} espessura={2} />
              </View>
              <Text style={styles.avisoTexto}>Toque em uma máquina para mudar. A escala vai em uma mensagem só, pronta para o grupo da equipe no WhatsApp.</Text>
            </View>

            {sugeridas.length > 0 ? (
              <View style={styles.sugestao}>
                <Text style={styles.sugestaoTexto}>
                  {sugeridas.length === 1 ? '1 máquina com a escala sugerida' : `${sugeridas.length} máquinas com a escala sugerida`} (a de ontem ou o operador que a máquina informa). Confira e confirme tudo de uma vez.
                </Text>
                {mudar.erroAoConfirmar ? <Text style={styles.sugestaoErro}>Não deu para confirmar. Tente de novo.</Text> : null}
                <Pressable accessibilityRole="button" disabled={mudar.confirmando} onPress={() => mudar.confirmar()} style={styles.botao}>
                  <Text style={styles.botaoTexto}>{mudar.confirmando ? 'Confirmando…' : 'Confirmar escala sugerida'}</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={comOperador.length === 0 || envio.enviando}
              onPress={() => void enviar()}
              style={[styles.botao, enviada && styles.botaoEnviada, comOperador.length === 0 && styles.botaoDesabilitado]}>
              <Text style={[styles.botaoTexto, enviada && styles.botaoTextoEnviada, comOperador.length === 0 && styles.botaoTextoDesabilitado]}>
                {comOperador.length === 0 ? 'Escolha os operadores para enviar' : envio.enviando ? 'Enviando ao grupo…' : enviada ? 'Escala enviada · enviar de novo' : envio.paraOGrupo ? 'Enviar escala ao grupo' : 'Enviar escala no WhatsApp'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={editando !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={fechar}>
        {editando ? (
          <EditorDaEscala
            // Cada máquina abre com os próprios dados.
            key={editando.maquinaId}
            item={editando}
            operadores={operadores}
            talhoes={talhoes}
            salvando={mudar.salvando}
            erro={mudar.erro?.message ?? null}
            aoSalvar={(dados) => mudar.definir({ maquinaId: editando.maquinaId, dados }, { onSuccess: fechar })}
            aoTirar={() => mudar.tirar(editando.maquinaId, { onSuccess: fechar })}
            aoFechar={fechar}
          />
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { gap: 16, flexGrow: 1 },
  corpo: { paddingHorizontal: MARGEM_TELA, gap: 16 },
  espera: { flex: 1, minHeight: 320 },
  lista: { gap: 10 },
  aviso: { backgroundColor: cores.primarioSuave, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  avisoIcone: { marginTop: 2 },
  avisoTexto: { flex: 1, fontFamily: fontes.regular, fontSize: 13, lineHeight: 19, color: cores.textoSobreSuave },
  sugestao: { gap: 10 },
  sugestaoTexto: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 20, color: cores.textoMedio },
  sugestaoErro: { fontFamily: fontes.regular, fontSize: 13, color: cores.aviso },
  botao: { height: 54, borderRadius: 27, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: cores.milho },
  botaoEnviada: { backgroundColor: 'transparent', borderColor: cores.mata },
  botaoDesabilitado: { backgroundColor: cores.desabilitado, borderColor: cores.desabilitado },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
  botaoTextoEnviada: { color: cores.mata },
  botaoTextoDesabilitado: { color: cores.desabilitadoTexto },
});
