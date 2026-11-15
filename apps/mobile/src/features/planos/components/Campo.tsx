import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

type Props = Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'maxLength' | 'autoCapitalize'> & {
  rotulo: string;
  /** Unidade mostrada dentro do campo, à direita: "/ha", "cm". */
  sufixo?: string;
  /** Mensagem de erro; presente, o campo fica vermelho. */
  erro?: string | null;
  /** texto = uma linha; recado = caixa de três linhas. */
  variant?: 'texto' | 'recado';
};

/** Campo de texto do formulário, com rótulo, unidade e erro. */
export function Campo({ rotulo, sufixo, erro, variant = 'texto', ...entrada }: Props) {
  return (
    <View style={styles.campo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <View>
        <TextInput
          {...entrada}
          accessibilityLabel={rotulo}
          placeholderTextColor={cores.desabilitadoTexto}
          multiline={variant === 'recado'}
          returnKeyType={variant === 'recado' ? 'default' : 'done'}
          style={[styles.entrada, variant === 'recado' && styles.recado, sufixo ? styles.comSufixo : null, erro ? styles.entradaErro : null]}
        />
        {sufixo ? (
          <Text style={styles.sufixo} pointerEvents="none">
            {sufixo}
          </Text>
        ) : null}
      </View>
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
    </View>
  );
}

/** Rótulo + conteúdo qualquer (opções, por exemplo), no mesmo espaçamento dos campos. */
export function Grupo({ rotulo, erro, children }: { rotulo: string; erro?: string | null; children: ReactNode }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      {children}
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  campo: { gap: 6, flex: 1 },
  rotulo: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 16, color: cores.textoMedio },
  entrada: { height: 48, borderRadius: 22, borderWidth: 1, borderColor: cores.campoBorda, backgroundColor: cores.campoFundo, paddingHorizontal: 12, fontFamily: fontes.medio, fontSize: 15, color: cores.texto },
  recado: { height: 84, paddingVertical: 10, textAlignVertical: 'top', lineHeight: 21 },
  comSufixo: { paddingRight: 52 },
  entradaErro: { borderColor: cores.erroBorda },
  sufixo: { position: 'absolute', right: 12, top: 15, fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.textoSuave },
  erro: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.perigo },
});
