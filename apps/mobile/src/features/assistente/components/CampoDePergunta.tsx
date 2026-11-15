import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AnelPulsante } from '@/shared/components/animacoes';
import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

type Props = {
  texto: string;
  aoMudar: (texto: string) => void;
  aoEnviar: () => void;
  aoTocarMicrofone: () => void;
  ouvindo: boolean;
  ocupado: boolean;
};

export function CampoDePergunta({ texto, aoMudar, aoEnviar, aoTocarMicrofone, ouvindo, ocupado }: Props) {
  const podeEnviar = texto.trim().length > 0 && !ocupado;
  return (
    <View style={[styles.caixa, ouvindo && styles.caixaOuvindo]}>
      <TextInput
        value={texto}
        onChangeText={aoMudar}
        accessibilityLabel="Pergunte sobre a fazenda"
        placeholder={ouvindo ? 'Ouvindo… pode falar' : 'Pergunte sobre a fazenda…'}
        placeholderTextColor={ouvindo ? cores.perigo : cores.textoSuave}
        multiline
        maxLength={4000}
        returnKeyType="send"
        submitBehavior="submit"
        onSubmitEditing={() => podeEnviar && aoEnviar()}
        style={styles.entrada}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ouvindo ? 'Parar de ouvir' : 'Falar por áudio'}
        accessibilityState={{ selected: ouvindo }}
        onPress={aoTocarMicrofone}
        style={[styles.botao, ouvindo ? styles.microfoneOuvindo : styles.microfone]}>
        {ouvindo ? <AnelPulsante cor={cores.perigo} tamanho={44} /> : null}
        <Icone nome={ouvindo ? 'parar' : 'microfone'} cor={ouvindo ? cores.textoSobreEscuro : cores.texto} tamanho={20} espessura={2} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Enviar pergunta" accessibilityState={{ disabled: !podeEnviar }} disabled={!podeEnviar} onPress={aoEnviar} style={[styles.botao, podeEnviar ? styles.enviar : styles.enviarDesligado]}>
        {ocupado ? <ActivityIndicator color={cores.sobreMilho} size="small" /> : <Icone nome="enviar" cor={podeEnviar ? cores.sobreMilho : cores.desabilitadoTexto} tamanho={18} espessura={2} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.bordaForte, borderRadius: 26, paddingVertical: 4, paddingRight: 4, paddingLeft: 16 },
  caixaOuvindo: { borderColor: cores.perigo },
  entrada: { flex: 1, minHeight: 44, maxHeight: 120, paddingTop: 12, paddingBottom: 12, fontFamily: fontes.regular, fontSize: 16, lineHeight: 21, color: cores.texto },
  botao: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  microfone: { backgroundColor: cores.fundo },
  microfoneOuvindo: { backgroundColor: cores.perigo },
  enviar: { backgroundColor: cores.milho },
  enviarDesligado: { backgroundColor: cores.desabilitado },
});
