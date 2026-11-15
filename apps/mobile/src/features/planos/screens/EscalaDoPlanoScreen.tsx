import type { Plano } from '@talhio/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TURNOS } from '@/features/escala';
import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { Icone } from '@/shared/components/Icone';
import { Opcoes } from '@/shared/components/Opcoes';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { useEscalaDoPlano } from '../hooks/useEscalaDoPlano';
import { usePlano } from '../hooks/usePlano';
import { quandoComeca, tarefaDoPlano } from '../textos';

/** Passo 3: quem opera cada máquina do plano, e o envio da escala para a equipe. */
export function EscalaDoPlanoScreen() {
  const { planoId } = useLocalSearchParams<{ planoId: string }>();
  const { plano, carregando, erro, atualizar } = usePlano(planoId);
  if (carregando) return <View style={styles.espera}><Carregando /></View>;
  if (erro || !plano) return <View style={styles.espera}><ErroComTentarDeNovo mensagem={erro?.message ?? 'Plano não encontrado.'} aoTentar={atualizar} /></View>;
  return <Escala plano={plano} />;
}

function Escala({ plano }: { plano: Plano }) {
  const { bottom } = useSafeAreaInsets();
  const escala = useEscalaDoPlano(plano);
  const talhao = plano.talhoes[0];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.tela}>
      <CabecalhoTela voltar titulo="Quem vai operar" subtitulo="Passo 3 de 4 · Escala" progresso={[true, true, true, false]} />
      <ScrollView contentContainerStyle={[styles.conteudo, { paddingTop: 16, paddingBottom: Math.max(bottom, 16) + 20 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={styles.plano}>
          <Text style={styles.planoSelo}>Plano salvo</Text>
          <Text style={styles.planoTitulo}>
            {tarefaDoPlano(plano)} · {plano.talhoes.map((t) => t.nome).join(', ')}
          </Text>
          <Text style={styles.planoDetalhe}>
            Começa {quandoComeca(plano.dataInicio)} · {plano.maquinas.map((m) => m.nome).join(' e ')}
          </Text>
        </View>

        {escala.carregando ? (
          <View style={styles.esperaCurta}>
            <Carregando />
          </View>
        ) : escala.erroAoCarregar ? (
          <View style={styles.esperaCurta}>
            <ErroComTentarDeNovo mensagem={escala.erroAoCarregar.message} aoTentar={escala.atualizar} />
          </View>
        ) : (
          <>
            {escala.linhas.map((linha) => (
              <View key={linha.maquinaId} style={styles.cartao}>
                <View style={styles.maquina}>
                  <Text style={styles.maquinaNome} numberOfLines={1}>
                    {linha.maquinaNome}
                  </Text>
                  {linha.implemento ? <Text style={styles.maquinaDetalhe}>{linha.implemento}</Text> : null}
                </View>

                <View style={styles.campo}>
                  <Text style={styles.rotulo}>Operador</Text>
                  <TextInput
                    accessibilityLabel={`Operador de ${linha.maquinaNome}`}
                    value={linha.operador}
                    onChangeText={(texto) => escala.escolherOperador(linha.maquinaId, texto)}
                    placeholder="Nome de quem vai operar"
                    placeholderTextColor={cores.desabilitadoTexto}
                    autoCapitalize="words"
                    autoCorrect={false}
                    maxLength={40}
                    returnKeyType="done"
                    style={[styles.entrada, (linha.repetido || linha.faltando) && styles.entradaErro]}
                  />
                  {linha.repetido ? <Text style={styles.erroCampo}>Esse operador já está em outra máquina</Text> : null}
                  {linha.faltando ? <Text style={styles.erroCampo}>Escolha quem vai operar</Text> : null}
                  {escala.operadores.length > 0 ? (
                    <Opcoes
                      opcoes={escala.operadores.map((nome) => ({ valor: nome, rotulo: nome }))}
                      valor={escala.operadores.find((nome) => nome === linha.operador.trim())}
                      aoEscolher={(nome) => escala.escolherOperador(linha.maquinaId, nome)}
                    />
                  ) : null}
                </View>

                <View style={styles.campo}>
                  <Text style={styles.rotulo}>Turno</Text>
                  <Opcoes opcoes={TURNOS} valor={linha.turno} aoEscolher={(turno) => escala.escolherTurno(linha.maquinaId, turno)} />
                </View>

                {linha.enviada ? (
                  <View style={styles.enviada}>
                    <Icone nome="confere" cor={cores.primario} tamanho={16} espessura={2.4} />
                    <Text style={styles.enviadaTexto}>Escala enviada</Text>
                  </View>
                ) : null}
              </View>
            ))}

            <View style={styles.secao}>
              <Text style={styles.tituloSecao}>Como a equipe recebe</Text>
              <View style={styles.conversa}>
                <View style={styles.balao}>
                  <Text selectable style={styles.balaoTexto}>
                    {escala.mensagem.replace(/\*/g, '')}
                  </Text>
                </View>
                <Text style={styles.conversaNota}>Vai em uma mensagem só, pronta para o grupo da equipe. Áudio automático para cada operador entra depois.</Text>
              </View>
            </View>

            {escala.precisaAjustar || escala.erro ? (
              <Text accessibilityRole="alert" style={styles.erro}>
                {escala.erro?.message ?? 'Ajuste a escala antes de enviar.'}
              </Text>
            ) : null}

            <Pressable accessibilityRole="button" disabled={escala.enviando} onPress={() => void escala.enviar()} style={[styles.botao, escala.enviada && styles.botaoEnviado, escala.enviando && styles.botaoEsperando]}>
              <Icone nome="enviar" cor={escala.enviada ? cores.mata : cores.sobreMilho} tamanho={18} espessura={2} />
              <Text style={[styles.botaoTexto, escala.enviada && styles.botaoTextoEnviado]}>
                {escala.enviando ? 'Enviando...' : escala.enviada ? 'Escala enviada no WhatsApp' : escala.paraOGrupo ? 'Enviar escala ao grupo' : 'Enviar escala no WhatsApp'}
              </Text>
            </Pressable>

            {escala.enviada && talhao ? (
              <Pressable accessibilityRole="button" onPress={() => router.navigate({ pathname: '/ao-vivo', params: { talhaoId: talhao.id } })} style={styles.proximo}>
                <View style={styles.pontoAoVivo} />
                <Text style={styles.proximoTexto}>Próximo: acompanhar ao vivo</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  espera: { flex: 1, backgroundColor: cores.fundo, justifyContent: 'center' },
  esperaCurta: { minHeight: 240, justifyContent: 'center' },
  conteudo: { paddingHorizontal: MARGEM_TELA, gap: 16 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.bordaForte, alignItems: 'center', justifyContent: 'center' },
  titulos: { flex: 1, gap: 1 },
  passo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  titulo: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 25, color: cores.texto },
  progresso: { flexDirection: 'row', gap: 6 },
  traco: { flex: 1, height: 4, borderRadius: 2, backgroundColor: cores.alca },
  tracoFeito: { backgroundColor: cores.primario },
  plano: { backgroundColor: cores.escuro, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 4 },
  planoSelo: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 15, color: cores.destaqueSobreEscuro },
  planoTitulo: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20, color: cores.textoSobreEscuro },
  planoDetalhe: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.textoSobreEscuro, opacity: 0.8 },
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  maquina: { gap: 2 },
  maquinaNome: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 19, color: cores.texto },
  maquinaDetalhe: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  campo: { gap: 6 },
  rotulo: { fontFamily: fontes.medio, fontSize: 12, lineHeight: 15, color: cores.textoMedio },
  entrada: { height: 46, borderRadius: 22, borderWidth: 1, borderColor: cores.campoBorda, backgroundColor: cores.campoFundo, paddingHorizontal: 12, fontFamily: fontes.medio, fontSize: 14, color: cores.texto },
  entradaErro: { borderColor: cores.erroBorda },
  erroCampo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.perigo },
  enviada: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  enviadaTexto: { fontFamily: fontes.semi, fontSize: 12, lineHeight: 15, color: cores.sucesso },
  secao: { gap: 8 },
  tituloSecao: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 18, color: cores.texto },
  conversa: { backgroundColor: cores.primarioSuave, borderRadius: 22, padding: 14, gap: 8 },
  balao: { alignSelf: 'flex-start', maxWidth: 300, backgroundColor: cores.cartao, borderRadius: 22, borderTopLeftRadius: 4, paddingVertical: 10, paddingHorizontal: 12 },
  balaoTexto: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 19, color: cores.dicaTexto },
  conversaNota: { fontFamily: fontes.regular, fontSize: 11, lineHeight: 15, color: cores.textoSuave },
  erro: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.perigoTexto, backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, overflow: 'hidden' },
  botao: { height: 56, borderRadius: 999, backgroundColor: cores.milho, borderWidth: 1, borderColor: cores.milho, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  botaoEnviado: { backgroundColor: cores.cartao },
  botaoEsperando: { opacity: 0.6 },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
  botaoTextoEnviado: { color: cores.primario },
  proximo: { height: 52, borderRadius: 999, backgroundColor: cores.escuro, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pontoAoVivo: { width: 8, height: 8, borderRadius: 4, backgroundColor: cores.aoVivo },
  proximoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
});
