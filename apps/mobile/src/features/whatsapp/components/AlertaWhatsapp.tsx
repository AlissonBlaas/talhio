import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { useSessao } from '@/shared/lib/sessao';
import { cores, fontes } from '@/shared/theme/tokens';

import { useWhatsapp } from '../hooks/useWhatsapp';

/**
 * Faixa do Início, em cima do mapa: aparece enquanto o administrador não terminou de ligar o WhatsApp
 * (sem conexão, esperando o código, ou conectado sem grupo escolhido) e some sozinha quando termina.
 */
export const AlertaWhatsapp = memo(function AlertaWhatsapp() {
  const router = useRouter();
  const sessao = useSessao();
  const { whatsapp } = useWhatsapp();
  const admin = sessao.status === 'logado' && sessao.usuario.papel === 'admin';
  if (!admin || !whatsapp || whatsapp.estado === 'indisponivel' || whatsapp.estado === 'reconectando') return null;
  const semGrupo = whatsapp.estado === 'conectado' && !whatsapp.grupo;
  if (whatsapp.estado === 'conectado' && !semGrupo) return null;

  const titulo = semGrupo ? 'Escolha o grupo do WhatsApp' : whatsapp.estado === 'aguardando-codigo' ? 'Falta digitar o código no WhatsApp' : 'Conecte seu WhatsApp';
  const texto = semGrupo ? 'Diga em qual grupo o Talhio manda as notificações.' : whatsapp.estado === 'aguardando-codigo' ? 'Abra a conexão para ver o código.' : 'Conecte seu WhatsApp para enviar as notificações ao grupo.';
  const botao = semGrupo ? 'Escolher' : whatsapp.estado === 'aguardando-codigo' ? 'Ver código' : 'Conectar';

  return (
    <View style={styles.faixa}>
      <View style={styles.icone}>
        <Icone nome="sino" cor={cores.milho} tamanho={24} espessura={2.2} />
      </View>
      <View style={styles.textos}>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.descricao}>{texto}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={botao} hitSlop={8} onPress={() => router.push('/config')} style={styles.botao}>
        <Text style={styles.botaoTexto}>{botao}</Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  faixa: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 28, backgroundColor: cores.mata },
  icone: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 2 },
  titulo: { fontFamily: fontes.titulo, fontSize: 17, lineHeight: 20, color: cores.textoSobreEscuro },
  descricao: { fontFamily: fontes.medio, fontSize: 13, lineHeight: 18, color: cores.suaveSobreEscuro },
  botao: { minHeight: 44, minWidth: 56, paddingHorizontal: 16, borderRadius: 22, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 16, color: cores.sobreMilho },
});
