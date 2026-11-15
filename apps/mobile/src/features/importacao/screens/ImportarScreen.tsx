import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { Icone } from '@/shared/components/Icone';
import { hectares } from '@/shared/lib/format';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { useImportarArquivos } from '../hooks/useImportarArquivos';

const PASSOS = [
  'No programa onde os talhões e as linhas foram feitos, exporte para o monitor John Deere Geração 4.',
  'Compacte a pasta exportada em um arquivo .zip e deixe no celular (Arquivos, WhatsApp ou e-mail).',
  'Toque em "Escolher arquivo" e selecione o .zip.',
];

export function ImportarScreen() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { importar, importando, resultado, erro } = useImportarArquivos();

  return (
    <View style={styles.tela}>
      <CabecalhoTela titulo="Importar talhões e linhas" voltar />

      <ScrollView style={styles.rolagem} contentContainerStyle={[styles.conteudo, { paddingBottom: Math.max(bottom, 16) + 16 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.cabecalho}>
          <Text style={styles.titulo}>Comece com os talhões e as linhas que você já tem</Text>
          <Text style={styles.texto}>
            O Talhio lê os mesmos arquivos que vão para o monitor do trator: contorno dos talhões e linhas de plantio.
          </Text>
        </View>

        {resultado ? (
          <View style={styles.cartao}>
            <View style={styles.sucesso}>
              <Text style={styles.sucessoTitulo}>Importação concluída</Text>
              <Text style={styles.sucessoTexto}>
                {resultado.fazendaNome} · {resultado.talhoes.length} {resultado.talhoes.length === 1 ? 'talhão' : 'talhões'} · {resultado.totalPassadas} linhas de plantio
              </Text>
            </View>
            {resultado.talhoes.map((talhao) => (
              <View key={talhao.id} style={styles.item}>
                <Text style={styles.itemNome} numberOfLines={1}>
                  {talhao.nome}
                </Text>
                <Text style={styles.itemDetalhe}>
                  {hectares(talhao.areaHa)} · {talhao.passadas > 0 ? `${talhao.passadas} linhas` : 'sem linhas'}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.cartao}>
            {PASSOS.map((passo, indice) => (
              <View key={passo} style={styles.passo}>
                <View style={styles.numero}>
                  <Text style={styles.numeroTexto}>{indice + 1}</Text>
                </View>
                <Text style={styles.passoTexto}>{passo}</Text>
              </View>
            ))}
          </View>
        )}

        {erro ? (
          <View style={styles.erro}>
            <Icone nome="atencao" cor={cores.perigoTexto} tamanho={18} />
            <Text style={styles.erroTexto}>{erro.message}</Text>
          </View>
        ) : null}

        {resultado ? (
          <Pressable accessibilityRole="button" onPress={() => router.replace('/mapa')} style={[styles.botao, styles.primario]}>
            <Text style={[styles.botaoTexto, { color: cores.sobreMilho }]}>Ver no mapa</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: importando }}
          disabled={importando}
          onPress={importar}
          style={[styles.botao, resultado ? styles.secundario : styles.primario]}>
          {importando ? (
            <ActivityIndicator color={resultado ? cores.folha : cores.sobreMilho} />
          ) : (
            <Text style={[styles.botaoTexto, { color: resultado ? cores.texto : cores.sobreMilho }]}>{resultado ? 'Importar outro arquivo' : 'Escolher arquivo'}</Text>
          )}
        </Pressable>

        <Text style={styles.nota}>
          Cada importação substitui os talhões e as linhas importados antes. Por enquanto lemos o formato do monitor Geração 4; o do GS3 2630 ainda não.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, alignItems: 'center', justifyContent: 'center' },
  topoTitulo: { fontFamily: fontes.semi, fontSize: 16, color: cores.texto },
  rolagem: { flex: 1 },
  conteudo: { paddingHorizontal: MARGEM_TELA, paddingTop: 16, gap: 16 },
  cabecalho: { gap: 8, paddingTop: 4 },
  titulo: { fontFamily: fontes.titulo, fontSize: 24, lineHeight: 26, color: cores.texto },
  texto: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 20, color: cores.textoMedio },
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 22, padding: 16, gap: 14 },
  passo: { flexDirection: 'row', gap: 12 },
  numero: { width: 26, height: 26, borderRadius: 13, backgroundColor: cores.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  numeroTexto: { fontFamily: fontes.semi, fontSize: 13, color: cores.primario },
  passoTexto: { flex: 1, fontFamily: fontes.regular, fontSize: 14, lineHeight: 20, color: cores.textoMedio },
  sucesso: { backgroundColor: cores.sucessoFundo, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  sucessoTitulo: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 18, color: cores.sucesso },
  sucessoTexto: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.sucesso },
  item: { gap: 2 },
  itemNome: { fontFamily: fontes.semi, fontSize: 14, lineHeight: 18, color: cores.texto },
  itemDetalhe: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 16, color: cores.textoSuave },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
  erroTexto: { flex: 1, fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, color: cores.perigoTexto },
  botao: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  botaoTexto: { fontFamily: fontes.semi, fontSize: 15 },
  primario: { backgroundColor: cores.milho },
  secundario: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.bordaForte },
  nota: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 17, color: cores.textoSuave, textAlign: 'center' },
});
