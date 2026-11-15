import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Surgir } from '@/shared/components/animacoes';
import { cores, fontes } from '@/shared/theme/tokens';

const SUGESTOES: { marca: string; pergunta: string }[] = [
  { marca: 'ha', pergunta: 'Quanto fizemos hoje?' },
  { marca: '!', pergunta: 'Qual máquina ficou mais tempo parada?' },
  { marca: 'L', pergunta: 'Como está o consumo de diesel na semana?' },
  { marca: '?', pergunta: 'Tem alguma máquina sem sinal?' },
];

function saudacao(): string {
  const hora = new Date().getHours();
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

/** Tela de entrada da conversa: saudação e perguntas prontas. */
export function Inicio({ aoPerguntar }: { aoPerguntar: (pergunta: string) => void }) {
  return (
    <View style={styles.caixa}>
      <Surgir style={styles.abertura}>
      <Text style={styles.titulo}>{saudacao()}! O que você quer saber da fazenda hoje?</Text>
      <Text style={styles.texto}>Pergunte do seu jeito, por texto ou áudio. Eu respondo com os dados das máquinas e dos talhões.</Text>
      </Surgir>
      <View style={styles.lista}>
        {SUGESTOES.map((sugestao, indice) => (
          <Surgir key={sugestao.pergunta} ordem={indice + 1}>
          <Pressable accessibilityRole="button" onPress={() => aoPerguntar(sugestao.pergunta)} style={styles.item}>
            <View style={styles.marca}>
              <Text style={styles.marcaTexto}>{sugestao.marca}</Text>
            </View>
            <Text style={styles.pergunta}>{sugestao.pergunta}</Text>
          </Pressable>
          </Surgir>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { gap: 14, paddingTop: 8 },
  abertura: { gap: 14 },
  titulo: { fontFamily: fontes.titulo, fontSize: 28, lineHeight: 32, color: cores.texto },
  texto: { fontFamily: fontes.regular, fontSize: 16, lineHeight: 23, color: cores.textoMedio },
  lista: { gap: 8 },
  item: { minHeight: 56, borderRadius: 28, borderWidth: 1, borderColor: cores.bordaForte, backgroundColor: cores.cartao, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  marca: { width: 34, height: 34, borderRadius: 17, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  marcaTexto: { fontFamily: fontes.rotulo, fontSize: 14, color: cores.sobreMilho },
  pergunta: { flex: 1, fontFamily: fontes.medio, fontSize: 15, lineHeight: 20, color: cores.texto },
});
