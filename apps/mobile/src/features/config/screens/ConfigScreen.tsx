import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSair } from '@/features/auth';
import { PassoConexao, useConexaoDeere, useMudarConexao } from '@/features/conexao';
import { PassoWhatsapp } from '@/features/whatsapp';
import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { Icone } from '@/shared/components/Icone';
import { useSessao } from '@/shared/lib/sessao';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

const PAPEL = { admin: 'Administrador', leitura: 'Só consulta' } as const;

export function ConfigScreen() {
  // Tela empilhada por cima das abas (aberta pelo menu da conta): sem barra de baixo para reservar espaço.
  const { bottom } = useSafeAreaInsets();
  const sessao = useSessao();
  const sair = useSair();
  const { conexao, atualizar } = useConexaoDeere();
  const { desconectar, desconectando } = useMudarConexao();
  const usuario = sessao.status === 'logado' ? sessao.usuario : null;
  const admin = usuario?.papel === 'admin';
  const podeDesconectar = admin && conexao?.modo === 'deere' && conexao.estado !== 'desconectado';

  const confirmarDesconexao = () =>
    Alert.alert('Desconectar a John Deere?', 'O Talhio deixa de ler as máquinas e os talhões desta fazenda até você conectar de novo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desconectar', style: 'destructive', onPress: desconectar },
    ]);
  const confirmarSaida = () =>
    Alert.alert('Sair da conta?', 'Você vai precisar entrar de novo com e-mail e senha.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: sair }]);

  return (
    <View style={styles.tela}>
      <ScrollView
        contentContainerStyle={[styles.conteudo, { paddingBottom: Math.max(bottom, 16) + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={atualizar} tintColor={cores.milho} />}>
        <CabecalhoTela voltar titulo="Configurações" subtitulo="Conta e conexões da fazenda" />
        <View style={styles.corpo}>
          <Secao titulo="Conta">
            <Linha rotulo="Nome" valor={usuario?.nome ?? '—'} />
            <Linha rotulo="E-mail" valor={usuario?.email ?? '—'} />
            <Linha rotulo="Acesso" valor={usuario ? PAPEL[usuario.papel] : '—'} ultima />
          </Secao>

          <Secao titulo="WhatsApp">
            <PassoWhatsapp />
          </Secao>

          <Secao titulo="John Deere">
            <PassoConexao />
            {podeDesconectar ? (
              <Pressable accessibilityRole="button" disabled={desconectando} onPress={confirmarDesconexao} style={styles.perigo}>
                <Text style={styles.perigoTexto}>{desconectando ? 'Desconectando…' : 'Desconectar a John Deere'}</Text>
              </Pressable>
            ) : null}
          </Secao>

          <Pressable accessibilityRole="button" onPress={confirmarSaida} style={styles.sair}>
            <Icone nome="sair" cor={cores.mata} tamanho={20} />
            <Text style={styles.sairTexto}>Sair da conta</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={styles.secao}>
      <Text style={styles.secaoTitulo}>{titulo}</Text>
      <View style={styles.cartao}>{children}</View>
    </View>
  );
}

function Linha({ rotulo, valor, ultima }: { rotulo: string; valor: string; ultima?: boolean }) {
  return (
    <View style={[styles.linha, !ultima && styles.linhaBorda]}>
      <Text style={styles.linhaRotulo}>{rotulo}</Text>
      <Text style={styles.linhaValor} numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { gap: 18, flexGrow: 1 },
  corpo: { paddingHorizontal: MARGEM_TELA, gap: 20 },
  secao: { gap: 8 },
  secaoTitulo: { fontFamily: fontes.titulo, fontSize: 20, lineHeight: 24, color: cores.texto },
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 26, padding: 18, gap: 14 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingBottom: 12 },
  linhaBorda: { borderBottomWidth: 1, borderBottomColor: cores.borda },
  linhaRotulo: { fontFamily: fontes.regular, fontSize: 15, color: cores.textoSuave },
  linhaValor: { flex: 1, textAlign: 'right', fontFamily: fontes.rotuloLeve, fontSize: 15, color: cores.texto },
  perigo: { minHeight: 48, borderRadius: 24, borderWidth: 2, borderColor: cores.perigo, alignItems: 'center', justifyContent: 'center' },
  perigoTexto: { fontFamily: fontes.rotulo, fontSize: 16, color: cores.perigoTexto },
  sair: { minHeight: 54, borderRadius: 27, borderWidth: 2, borderColor: cores.mata, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sairTexto: { fontFamily: fontes.rotulo, fontSize: 17, color: cores.mata },
});
