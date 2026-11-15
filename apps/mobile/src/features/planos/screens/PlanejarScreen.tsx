import type { Maquina, Talhao } from '@talhio/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLinhasDoTalhao } from '@/features/linhas';
import { useMaquinas } from '@/features/maquinas';
import { MapaDoTalhao, useTalhoes } from '@/features/talhoes';
import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { Icone } from '@/shared/components/Icone';
import { Opcoes } from '@/shared/components/Opcoes';
import { hectares, siglaTalhao } from '@/shared/lib/format';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { Campo, Grupo } from '../components/Campo';
import { MaquinasDoPlano } from '../components/MaquinasDoPlano';
import { PlanoSalvo } from '../components/PlanoSalvo';
import { SeletorDeOperacao } from '../components/SeletorDeOperacao';
import { useCriarPlano } from '../hooks/useCriarPlano';
import { useFormularioDoPlano } from '../hooks/useFormularioDoPlano';
import { CULTURAS, nomeDaOperacao, PRODUTO, proximosDias } from '../textos';

const DIAS = proximosDias();

export function PlanejarScreen() {
  const { talhaoId } = useLocalSearchParams<{ talhaoId: string }>();
  const talhoes = useTalhoes();
  const maquinas = useMaquinas();
  const talhao = talhoes.talhoes.find((t) => t.id === talhaoId);

  if (talhoes.carregando || maquinas.carregando) return <View style={styles.espera}><Carregando /></View>;
  const erro = talhoes.erro ?? maquinas.erro;
  if (erro || !talhao) {
    const tentar = () => {
      talhoes.atualizar();
      maquinas.atualizar();
    };
    return (
      <View style={styles.espera}>
        <ErroComTentarDeNovo mensagem={erro?.message ?? 'Talhão não encontrado.'} aoTentar={erro ? tentar : () => router.back()} />
      </View>
    );
  }
  return <Formulario talhao={talhao} outros={talhoes.talhoes.filter((t) => t.id !== talhao.id)} maquinas={maquinas.maquinas} />;
}

function Formulario({ talhao, outros, maquinas }: { talhao: Talhao; outros: Talhao[]; maquinas: Maquina[] }) {
  const { top, bottom } = useSafeAreaInsets();
  const form = useFormularioDoPlano(talhao.id, maquinas);
  const linhas = useLinhasDoTalhao(talhao);
  const { criar, salvando, salvo, erro, recomecar } = useCriarPlano();
  const produto = PRODUTO[form.operacao];
  const plantio = form.operacao === 'plantio';
  const pedeCultura = plantio || form.operacao === 'colheita';

  const salvar = () => {
    const dados = form.conferir();
    if (dados) criar(dados);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.tela}>
      <CabecalhoTela voltar titulo={`${talhao.nome} · ${hectares(talhao.areaHa)}`} subtitulo="Passo 2 de 4 · Planejar e enviar ao trator" progresso={[true, true, false, false]} />
      <ScrollView contentContainerStyle={[styles.conteudo, { paddingTop: 16, paddingBottom: Math.max(bottom, 16) + 20 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <MapaDoTalhao talhao={talhao} altura={150} />

        {salvo ? (
          <>
            <PlanoSalvo plano={salvo} />
            <Pressable accessibilityRole="button" onPress={() => router.navigate({ pathname: '/escala-do-plano', params: { planoId: salvo.id } })} style={styles.botao}>
              <Text style={styles.botaoTexto}>Próximo: enviar a escala</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={recomecar} style={styles.botaoSecundario}>
              <Text style={styles.botaoSecundarioTexto}>Fazer outro plano para este talhão</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.secao}>
              <Text style={styles.tituloSecao}>1. Operação</Text>
              <SeletorDeOperacao valor={form.operacao} aoMudar={form.trocarOperacao} />
            </View>

            <View style={styles.cartao}>
              <Text style={styles.tituloSecao}>2. Dados {plantio ? 'do plantio' : `da ${nomeDaOperacao(form.operacao).toLowerCase()}`}</Text>

              <Pressable accessibilityRole="button" onPress={() => router.navigate({ pathname: '/linha-ab', params: { talhaoId: talhao.id, origem: 'plano' } })} style={styles.linhaAb}>
                <View style={styles.linhaAbTextos}>
                  <Text style={styles.linhaAbRotulo}>Linha AB</Text>
                  <Text style={styles.linhaAbValor} numberOfLines={1}>
                    {linhas.direcaoGraus === null
                      ? 'Sem linha neste talhão'
                      : linhas.tipo === 'curva'
                        ? `${linhas.nome ?? 'Linha curva'} · ${linhas.total} passadas`
                        : `${linhas.propria ? (linhas.nome ?? 'Linha do talhão') : 'Padrão da fazenda'} · ${Math.round(linhas.direcaoGraus)}°`}
                  </Text>
                </View>
                <Text style={styles.linhaAbAcao}>{linhas.direcaoGraus === null ? 'Criar' : 'Trocar'}</Text>
              </Pressable>

              {pedeCultura ? (
                <Grupo rotulo={plantio ? 'Cultura *' : 'Cultura'} erro={form.falta('cultura') ? 'Escolha a cultura' : null}>
                  <Opcoes opcoes={CULTURAS.map((c) => ({ valor: c, rotulo: c }))} valor={form.cultura ?? undefined} aoEscolher={form.setCultura} />
                </Grupo>
              ) : null}

              {plantio ? (
                <>
                  <Campo rotulo="Variedade / híbrido *" value={form.textos.variedade} onChangeText={(v) => form.escrever('variedade', v)} placeholder="Ex.: nome do híbrido" maxLength={60} erro={form.falta('variedade') ? 'Informe a variedade' : null} />
                  <View style={styles.dupla}>
                    <Campo rotulo="Sementes por ha *" sufixo="/ha" value={form.textos.sementesPorHa} onChangeText={(v) => form.escrever('sementesPorHa', v)} placeholder="65.000" keyboardType="decimal-pad" maxLength={10} erro={form.falta('sementesPorHa') ? 'Informe a taxa' : null} />
                    <Campo rotulo="Espaçamento" sufixo="cm" value={form.textos.espacamentoCm} onChangeText={(v) => form.escrever('espacamentoCm', v)} placeholder="50" keyboardType="decimal-pad" maxLength={6} />
                  </View>
                </>
              ) : null}

              {produto ? (
                <View style={styles.dupla}>
                  <Campo rotulo={produto.rotulo} value={form.textos.produto} onChangeText={(v) => form.escrever('produto', v)} placeholder={produto.exemplo} maxLength={60} autoCapitalize="none" />
                  <Campo rotulo="Dose" sufixo={produto.unidade} value={form.textos.doseProduto} onChangeText={(v) => form.escrever('doseProduto', v)} placeholder={produto.unidade === 'L/ha' ? '2,5' : '300'} keyboardType="decimal-pad" maxLength={8} />
                </View>
              ) : null}

              <Grupo rotulo="Data de início *">
                <Opcoes opcoes={DIAS} valor={form.dataInicio} aoEscolher={form.setDataInicio} />
              </Grupo>

              <Campo rotulo="Recado para o operador" variant="recado" value={form.textos.recado} onChangeText={(v) => form.escrever('recado', v)} placeholder="Ex.: começar pela cabeceira perto da estrada" maxLength={300} />
            </View>

            <View style={styles.cartao}>
              <View style={styles.secaoTitulos}>
                <Text style={styles.tituloSecao}>3. Máquinas que vão receber *</Text>
                <Text style={styles.dica}>
                  {form.maquinasQueServem.length > 0 ? 'Já marcamos as que servem para a operação e estão online. Você pode trocar.' : 'Escolha outra operação ou conecte uma máquina compatível.'}
                </Text>
              </View>
              {form.maquinasQueServem.length > 0 ? (
                <MaquinasDoPlano maquinas={form.maquinasQueServem} marcadas={form.marcadas} sugeridas={form.sugeridas} aoAlternar={form.alternarMaquina} />
              ) : (
                <Text style={styles.semMaquina}>Nenhuma máquina conectada serve para essa operação.</Text>
              )}
              {form.maquinasOcultas > 0 ? (
                <Text style={styles.dica}>
                  {form.maquinasOcultas} {form.maquinasOcultas === 1 ? 'máquina oculta' : 'máquinas ocultas'}: não {form.maquinasOcultas === 1 ? 'serve' : 'servem'} para {nomeDaOperacao(form.operacao).toLowerCase()}.
                </Text>
              ) : null}
              {form.falta('maquinaIds') ? <Text style={styles.erroCampo}>Escolha pelo menos uma máquina</Text> : null}
            </View>

            {outros.length > 0 ? (
              <View style={styles.secao}>
                <Text style={styles.tituloSecao}>Aplicar o mesmo plano também em</Text>
                <Opcoes opcoes={outros.map((t) => ({ valor: t.id, rotulo: siglaTalhao(t.nome) }))} marcadas={form.outrosTalhoes} aoEscolher={form.alternarTalhao} />
              </View>
            ) : null}

            {form.temErro || erro ? (
              <Text accessibilityRole="alert" style={styles.erro}>
                {erro?.message ?? 'Falta preencher os campos marcados antes de salvar.'}
              </Text>
            ) : null}

            <Pressable accessibilityRole="button" disabled={salvando} onPress={salvar} style={[styles.botao, salvando && styles.botaoEsperando]}>
              <Icone nome="enviar" cor={cores.sobreMilho} tamanho={18} espessura={2.2} />
              <Text style={styles.botaoTexto}>{salvando ? 'Salvando...' : 'Salvar plano'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  espera: { flex: 1, backgroundColor: cores.fundo, justifyContent: 'center' },
  conteudo: { paddingHorizontal: MARGEM_TELA, gap: 16 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  voltar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.bordaForte, alignItems: 'center', justifyContent: 'center' },
  titulos: { flex: 1, gap: 1 },
  passo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  titulo: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 25, color: cores.texto },
  progresso: { flexDirection: 'row', gap: 6 },
  traco: { flex: 1, height: 4, borderRadius: 2, backgroundColor: cores.alca },
  tracoFeito: { backgroundColor: cores.primario },
  secao: { gap: 8 },
  secaoTitulos: { gap: 4 },
  tituloSecao: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 18, color: cores.texto },
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 20, paddingVertical: 18, paddingHorizontal: 16, gap: 16 },
  linhaAb: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 22, backgroundColor: cores.fundo, minHeight: 56 },
  linhaAbTextos: { flex: 1, gap: 1 },
  linhaAbRotulo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  linhaAbValor: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 18, color: cores.texto },
  linhaAbAcao: { fontFamily: fontes.semi, fontSize: 13, color: cores.primario },
  dupla: { flexDirection: 'row', gap: 12 },
  dica: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 17, color: cores.textoSuave },
  semMaquina: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.textoMedio, backgroundColor: cores.fundo, borderRadius: 22, padding: 12, overflow: 'hidden' },
  erroCampo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.perigo },
  erro: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.perigoTexto, backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, overflow: 'hidden' },
  botao: { height: 56, borderRadius: 999, backgroundColor: cores.milho, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  botaoEsperando: { opacity: 0.6 },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.sobreMilho },
  botaoSecundario: { height: 48, alignItems: 'center', justifyContent: 'center' },
  botaoSecundarioTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.primario },
});
