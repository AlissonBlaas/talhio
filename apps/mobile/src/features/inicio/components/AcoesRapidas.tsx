import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone, type NomeIcone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

/** Duas ações grandes em pílula (a principal em milho) e dois atalhos discretos embaixo. */
export const AcoesRapidas = memo(function AcoesRapidas() {
  const router = useRouter();
  const aoNovoPlano = () => router.navigate('/novo-plano');
  const aoPerguntar = () => router.navigate('/assistente');
  const aoCriarTalhao = () => router.navigate('/novo-talhao');
  const aoImportar = () => router.navigate('/importar');
  return (
    <View style={styles.bloco}>
      <View style={styles.linha}>
        <Botao variant="primaria" rotulo="Novo plano" onPress={aoNovoPlano} />
        <Botao variant="secundaria" rotulo="Perguntar à IA" onPress={aoPerguntar} />
      </View>
      <View>
        <Atalho icone="mais" titulo="Novo talhão" detalhe="Desenhe no mapa" onPress={aoCriarTalhao} primeiro />
        <Atalho icone="enviar" titulo="Importar talhões e linhas" detalhe="Use os arquivos do monitor John Deere" onPress={aoImportar} />
      </View>
    </View>
  );
});

function Botao({ variant, rotulo, onPress }: { variant: 'primaria' | 'secundaria'; rotulo: string; onPress: () => void }) {
  const primaria = variant === 'primaria';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.botao, primaria ? styles.primaria : styles.secundaria]}>
      <Text style={[styles.rotulo, { color: primaria ? cores.sobreMilho : cores.mata }]}>{rotulo}</Text>
    </Pressable>
  );
}

function Atalho({ icone, titulo, detalhe, onPress, primeiro }: { icone: NomeIcone; titulo: string; detalhe: string; onPress: () => void; primeiro?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.atalho, primeiro && styles.atalhoPrimeiro]}>
      <Icone nome={icone} cor={cores.mata} tamanho={20} espessura={2} />
      <View style={styles.atalhoTextos}>
        <Text style={styles.atalhoTitulo}>{titulo}</Text>
        <Text style={styles.atalhoDetalhe}>{detalhe}</Text>
      </View>
      <Text style={styles.seta}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bloco: { gap: 14 },
  linha: { flexDirection: 'row', gap: 10 },
  botao: { flex: 1, minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  primaria: { backgroundColor: cores.milho },
  secundaria: { borderWidth: 2, borderColor: cores.mata },
  rotulo: { fontFamily: fontes.rotulo, fontSize: 18, lineHeight: 20 },
  atalho: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: cores.borda },
  atalhoPrimeiro: { borderTopWidth: 1, borderTopColor: cores.borda },
  atalhoTextos: { flex: 1, gap: 1 },
  atalhoTitulo: { fontFamily: fontes.rotulo, fontSize: 15, lineHeight: 17, color: cores.texto },
  atalhoDetalhe: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoSuave },
  seta: { fontFamily: fontes.regular, fontSize: 24, lineHeight: 26, color: cores.textoSuave },
});
