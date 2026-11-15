import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

type Props<T> = {
  opcoes: { valor: T; rotulo: string }[];
  /** A opção marcada, se alguma. */
  valor?: T | undefined;
  /** Para escolha múltipla: as opções marcadas (use no lugar de `valor`). */
  marcadas?: T[];
  aoEscolher: (valor: T) => void;
};

/** Fileira de opções de toque único, que quebra de linha quando não cabe. */
export function Opcoes<T extends string | null>({ opcoes, valor, marcadas, aoEscolher }: Props<T>) {
  return (
    <View style={styles.fileira}>
      {opcoes.map((opcao) => {
        const marcada = marcadas ? marcadas.includes(opcao.valor) : opcao.valor === valor;
        return (
          <Pressable
            key={String(opcao.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: marcada }}
            onPress={() => aoEscolher(opcao.valor)}
            style={[styles.opcao, marcada && styles.marcada]}>
            <Text style={[styles.texto, marcada && styles.textoMarcado]} numberOfLines={1}>
              {opcao.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fileira: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: { minHeight: 44, maxWidth: '100%', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: cores.campoBorda, backgroundColor: cores.campoFundo, justifyContent: 'center' },
  marcada: { backgroundColor: cores.milho, borderColor: cores.milho },
  texto: { fontFamily: fontes.medio, fontSize: 14, color: cores.texto },
  textoMarcado: { color: cores.sobreMilho },
});
