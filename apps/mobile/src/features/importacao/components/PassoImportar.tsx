import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

import { useImportarArquivos } from '../hooks/useImportarArquivos';

const PASSOS = [
  'No programa onde os talhões foram feitos, exporte para o monitor John Deere Geração 4.',
  'Compacte a pasta em um arquivo .zip e deixe no celular (Arquivos, WhatsApp ou e-mail).',
  'Toque em "Escolher arquivo" e selecione o .zip.',
];

/**
 * O passo de importar talhões e linhas, para caber dentro de outra tela (onboarding). Sozinho: abre o seletor de
 * arquivos, envia e mostra o que entrou. A tela `/importar` continua sendo o lugar para ver a lista completa.
 */
export function PassoImportar() {
  const { importar, importando, resultado, erro } = useImportarArquivos();
  return (
    <View style={styles.bloco}>
      {resultado ? (
        <View style={styles.sucesso}>
          <Text style={styles.sucessoTitulo}>Importação concluída</Text>
          <Text style={styles.sucessoTexto}>
            {resultado.fazendaNome} · {resultado.talhoes.length} {resultado.talhoes.length === 1 ? 'talhão' : 'talhões'} · {resultado.totalPassadas} linhas de plantio
          </Text>
        </View>
      ) : (
        PASSOS.map((passo, indice) => (
          <View key={passo} style={styles.passo}>
            <View style={styles.numero}>
              <Text style={styles.numeroTexto}>{indice + 1}</Text>
            </View>
            <Text style={styles.passoTexto}>{passo}</Text>
          </View>
        ))
      )}

      {erro ? (
        <View accessibilityRole="alert" style={styles.erro}>
          <Icone nome="atencao" cor={cores.perigoTexto} tamanho={18} />
          <Text style={styles.erroTexto}>{erro.message}</Text>
        </View>
      ) : null}

      <Pressable accessibilityRole="button" accessibilityState={{ busy: importando }} disabled={importando} onPress={importar} style={styles.botao}>
        {importando ? <ActivityIndicator color={cores.mata} /> : <Text style={styles.botaoTexto}>{resultado ? 'Importar outro arquivo' : 'Escolher arquivo'}</Text>}
      </Pressable>
      <Text style={styles.nota}>Por enquanto lemos o formato do monitor Geração 4. Cada importação substitui a anterior.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: 14 },
  passo: { flexDirection: 'row', gap: 12 },
  numero: { width: 26, height: 26, borderRadius: 13, backgroundColor: cores.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  numeroTexto: { fontFamily: fontes.semi, fontSize: 13, color: cores.primario },
  passoTexto: { flex: 1, fontFamily: fontes.regular, fontSize: 15, lineHeight: 21, color: cores.textoMedio },
  sucesso: { backgroundColor: cores.sucessoFundo, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14, gap: 2 },
  sucessoTitulo: { fontFamily: fontes.semi, fontSize: 15, lineHeight: 20, color: cores.sucesso },
  sucessoTexto: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 19, color: cores.sucesso },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.perigoFundo, borderWidth: 1, borderColor: cores.perigoBorda, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 14 },
  erroTexto: { flex: 1, fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, color: cores.perigoTexto },
  botao: { minHeight: 54, borderRadius: 27, borderWidth: 2, borderColor: cores.mata, alignItems: 'center', justifyContent: 'center' },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.mata },
  nota: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 17, color: cores.textoSuave },
});
