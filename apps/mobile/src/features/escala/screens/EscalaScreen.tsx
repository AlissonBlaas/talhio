import type { EscalaItem } from '@talhio/shared';
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
import { MaquinaNaEscala } from '../components/MaquinaNaEscala';
import { useEscala } from '../hooks/useEscala';
import { useMudarEscala } from '../hooks/useMudarEscala';
import { diaPorExtenso, itensComOperador, porMaquina, textoDaEscala, textoDaTroca, turnoLivre } from '../textos';

export function EscalaScreen() {
  const alturaBarra = useAlturaDaBarra();
  const { escala, carregando, erro, atualizando, atualizar } = useEscala();
  const { talhoes } = useTalhoes();
  const mudar = useMudarEscala();
  // O que está aberto para editar: a linha de um turno que existe, ou um turno NOVO para a máquina.
  const [editandoId, setEditandoId] = useState<{ maquinaId: string; turno: EscalaItem['turno']; novo: boolean } | null>(null);
  const envio = useEnviarAoGrupo();
  // Trocou o operador (ou pôs/tirou um turno): o aviso fica pronto para mandar à equipe com um toque.
  const [troca, setTroca] = useState<string | null>(null);
  const [avisando, setAvisando] = useState(false);
  const mesmo = (a: string | null, b: string | null) => (a ?? '').trim().localeCompare((b ?? '').trim(), 'pt-BR', { sensitivity: 'base' }) === 0;
  const avisar = async () => {
    if (!troca || avisando) return;
    setAvisando(true);
    try {
      if (await envio.enviar({ texto: troca })) setTroca(null);
    } finally {
      setAvisando(false);
    }
  };

  const maquinas = escala ? porMaquina(escala) : [];
  const daMaquina = maquinas.find((m) => m.maquinaId === editandoId?.maquinaId) ?? null;
  const existente = daMaquina?.linhas.find((l) => l.turno === editandoId?.turno) ?? null;
  // Turno novo: começa em branco, com a tarefa e o talhão do turno que a máquina já tem (o mais comum é só trocar o operador).
  const modelo = daMaquina?.linhas[0] ?? null;
  const editando: EscalaItem | null = !editandoId ? null : editandoId.novo ? (modelo ? { ...modelo, operador: null, turno: editandoId.turno, definida: false, enviadaEm: null } : null) : existente;
  const outrosTurnos = (daMaquina?.linhas ?? []).filter((l) => l.definida && (editandoId?.novo || l.turno !== editandoId?.turno)).map((l) => l.turno);
  const comOperador = escala ? itensComOperador(escala) : [];
  const sugeridas = comOperador.filter((i) => !i.definida);
  const enviada = comOperador.length > 0 && comOperador.every((i) => i.enviadaEm);
  const jaFoiEnviada = comOperador.some((i) => i.enviadaEm);
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
        <CabecalhoTela titulo="Escala de hoje" subtitulo={escala ? `${diaPorExtenso(escala.dia)} · quem vai em qual máquina, por turno` : 'Quem vai em qual máquina, por turno'} />

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
              {maquinas.map((maquina, i) => (
                <Surgir key={maquina.maquinaId} ordem={i}>
                  <MaquinaNaEscala
                    maquina={maquina}
                    aoTocar={(item) => setEditandoId({ maquinaId: item.maquinaId, turno: item.turno, novo: false })}
                    aoAdicionar={() => setEditandoId({ maquinaId: maquina.maquinaId, turno: turnoLivre(maquina.linhas) ?? 'manha', novo: true })}
                  />
                </Surgir>
              ))}
            </View>

            <View style={styles.aviso}>
              <View style={styles.avisoIcone}>
                <Icone nome="enviar" cor={cores.textoSobreSuave} tamanho={18} espessura={2} />
              </View>
              <Text style={styles.avisoTexto}>Toque em um turno para mudar o operador, ou em "Adicionar turno" para pôr outra pessoa na mesma máquina. A escala vai em uma mensagem só, pronta para o grupo da equipe no WhatsApp.</Text>
            </View>

            {troca ? (
              <View style={styles.troca}>
                <Text style={styles.trocaTitulo}>Avisar a equipe da mudança?</Text>
                <Text style={styles.trocaTexto}>{troca.replace(/\*/g, '')}</Text>
                <View style={styles.trocaBotoes}>
                  <Pressable accessibilityRole="button" disabled={avisando} onPress={() => setTroca(null)} style={styles.trocaNao}>
                    <Text style={styles.trocaNaoTexto}>Não avisar</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={avisando} onPress={() => void avisar()} style={styles.trocaSim}>
                    <Text style={styles.botaoTexto}>{avisando ? 'Enviando…' : envio.paraOGrupo ? 'Avisar no grupo' : 'Avisar no WhatsApp'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

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
        {editando && editandoId ? (
          <EditorDaEscala
            // Cada máquina e turno abre com os próprios dados.
            key={`${editando.maquinaId}/${editandoId.turno}/${editandoId.novo}`}
            item={editando}
            operadores={operadores}
            talhoes={talhoes}
            outrosTurnos={outrosTurnos}
            salvando={mudar.salvando}
            erro={mudar.erro?.message ?? null}
            // Editando uma linha gravada e trocando o turno: a linha antiga sai (`substitui`).
            aoSalvar={(dados) =>
              mudar.definir(
                { maquinaId: editando.maquinaId, dados: { ...dados, substitui: !editandoId.novo && editando.definida ? editandoId.turno : undefined } },
                {
                  onSuccess: () => {
                    // Quem sai é quem estava GRAVADO naquela linha; sugestão que ninguém confirmou não é troca.
                    const sai = !editandoId.novo && editando.definida ? editando.operador : null;
                    const turno = dados.turno ?? 'dia-todo';
                    // Só é mudança para avisar se trocou quem já estava gravado, ou se a escala já tinha ido para a equipe.
                    // Montar a escala pela primeira vez não gera aviso: ela vai inteira no "Enviar escala".
                    const mudou = sai !== null ? !mesmo(sai, dados.operador) || turno !== editandoId.turno : jaFoiEnviada;
                    if (mudou) {
                      setTroca(textoDaTroca({ maquinaNome: editando.maquinaNome, implemento: editando.implemento, turno, sai: mesmo(sai, dados.operador) ? null : sai, entra: dados.operador, tarefa: dados.tarefa ?? null, talhaoNome: talhoes.find((t) => t.id === dados.talhaoId)?.nome ?? null }));
                    }
                    fechar();
                  },
                },
              )
            }
            aoTirar={() =>
              mudar.tirar(
                { maquinaId: editando.maquinaId, turno: editandoId.turno },
                {
                  onSuccess: () => {
                    if (editando.operador && editando.definida) setTroca(textoDaTroca({ maquinaNome: editando.maquinaNome, implemento: editando.implemento, turno: editandoId.turno, sai: editando.operador, entra: null, tarefa: null, talhaoNome: null }));
                    fechar();
                  },
                },
              )
            }
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
  troca: { backgroundColor: cores.alertaFundo, borderRadius: 24, padding: 16, gap: 10 },
  trocaTitulo: { fontFamily: fontes.rotulo, fontSize: 17, lineHeight: 21, color: cores.texto },
  trocaTexto: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 20, color: cores.textoMedio },
  trocaBotoes: { flexDirection: 'row', gap: 10 },
  trocaNao: { flex: 1, height: 48, borderRadius: 24, borderWidth: 2, borderColor: cores.mata, alignItems: 'center', justifyContent: 'center' },
  trocaNaoTexto: { fontFamily: fontes.rotulo, fontSize: 15, color: cores.mata },
  trocaSim: { flex: 1.3, height: 48, borderRadius: 24, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
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
