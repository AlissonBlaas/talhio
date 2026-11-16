import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { cores, fontes } from '@/shared/theme/tokens';

import { useEnviarAoGrupo } from '../hooks/useEnviarAoGrupo';

/**
 * Embaixo de um botão de enviar desligado: o caminho para ligar o WhatsApp da fazenda (ou escolher o grupo), na
 * Config. Não aparece quando já dá para enviar, nem para quem não pode resolver (acesso de leitura).
 */
export function ConectarWhatsapp() {
  const router = useRouter();
  const { falta, resolveNaConfig } = useEnviarAoGrupo();
  if (!falta || !resolveNaConfig) return null;
  return (
    <Pressable accessibilityRole="link" onPress={() => router.navigate('/config')} style={styles.link}>
      <Text style={styles.texto}>{falta === 'Escolha o grupo do WhatsApp' ? 'Escolher o grupo na Config' : 'Conectar o WhatsApp na Config'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  texto: { fontFamily: fontes.rotulo, fontSize: 15, color: cores.folha },
});
