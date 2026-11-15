import { PedirCodigoSchema } from '@talhio/shared';
import { memo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { useSessao } from '@/shared/lib/sessao';
import { cores, fontes } from '@/shared/theme/tokens';

import { useMudarWhatsapp } from '../hooks/useMudarWhatsapp';
import { useWhatsapp } from '../hooks/useWhatsapp';
import { Aviso, Botao, Erro, estilosWhatsapp } from './elementos';
import { EscolherGrupo } from './EscolherGrupo';

/** "ABCD1234" vira "ABCD-1234", como o WhatsApp mostra. */
const agrupar = (codigo: string) => (codigo.length === 8 ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : codigo);

/** "5547999990000" vira "+55 47 99999-0000". */
const formatarNumero = (n: string) => (/^55\d{11}$/.test(n) ? `+55 ${n.slice(2, 4)} ${n.slice(4, 9)}-${n.slice(9)}` : `+${n}`);

/**
 * O passo em que a ligação com o WhatsApp está: número, código para digitar no celular, escolha do grupo.
 * Sozinho: lê o estado no servidor e não recebe props. Quem não é administrador só vê o estado.
 */
export const PassoWhatsapp = memo(function PassoWhatsapp() {
  const { whatsapp, carregando, erro, atualizar } = useWhatsapp();
  const sessao = useSessao();
  const admin = sessao.status === 'logado' && sessao.usuario.papel === 'admin';
  if (carregando) return <Carregando />;
  if (erro || !whatsapp) return <ErroComTentarDeNovo mensagem={erro?.message ?? 'Não consegui ver a conexão do WhatsApp.'} aoTentar={atualizar} />;

  switch (whatsapp.estado) {
    case 'indisponivel':
      return <Aviso icone="atencao" titulo="WhatsApp ainda não está ligado" texto="Este servidor ainda não tem o WhatsApp ativado. Fale com o suporte do Talhio." />;
    case 'desconectado':
      return admin ? <PedirNumero /> : <Aviso icone="atencao" titulo="WhatsApp não conectado" texto="Peça para um administrador conectar o WhatsApp da fazenda." />;
    case 'aguardando-codigo':
      return <DigitarCodigo />;
    case 'reconectando':
      return (
        <View style={styles.espera}>
          <ActivityIndicator color={cores.mata} />
          <Text style={estilosWhatsapp.texto}>Reconectando o WhatsApp…</Text>
        </View>
      );
    default:
      return <Conectado numero={whatsapp.numero} grupo={whatsapp.grupo} admin={admin} />;
  }
});

function PedirNumero() {
  const { pedirCodigo, pedindoCodigo, erro } = useMudarWhatsapp();
  const [telefone, setTelefone] = useState('');
  const [tentou, setTentou] = useState(false);
  const validacao = PedirCodigoSchema.safeParse({ telefone });
  const enviar = () => {
    setTentou(true);
    if (validacao.success) pedirCodigo(validacao.data.telefone);
  };
  return (
    <View style={estilosWhatsapp.bloco}>
      <Text style={estilosWhatsapp.titulo}>Conecte o WhatsApp da fazenda</Text>
      <Text style={estilosWhatsapp.texto}>
        Informe o número do WhatsApp que vai mandar as notificações. Vamos gerar um código para você digitar no celular, sem ler QR code. Use um número da fazenda, de preferência não o pessoal.
      </Text>
      <TextInput
        value={telefone}
        onChangeText={setTelefone}
        placeholder="(47) 99999-0000"
        placeholderTextColor={cores.textoSuave}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        editable={!pedindoCodigo}
        returnKeyType="go"
        onSubmitEditing={enviar}
        accessibilityLabel="Número do WhatsApp"
        style={[styles.campo, tentou && !validacao.success && styles.campoErro]}
      />
      {tentou && !validacao.success ? <Erro mensagem="Informe o número com DDD, ex.: (47) 99999-0000" /> : null}
      <Erro mensagem={erro?.message} />
      <Botao rotulo="Gerar código" ocupado={pedindoCodigo} aoTocar={enviar} />
    </View>
  );
}

function DigitarCodigo() {
  const { codigo, desconectar, desconectando, pedindoCodigo } = useMudarWhatsapp();
  return (
    <View style={estilosWhatsapp.bloco}>
      <Text style={estilosWhatsapp.titulo}>Digite o código no WhatsApp</Text>
      {codigo ? (
        <View style={styles.codigoCaixa}>
          <Text selectable accessibilityLabel={`Código ${codigo.split('').join(' ')}`} style={styles.codigo}>
            {agrupar(codigo)}
          </Text>
        </View>
      ) : (
        <Text style={estilosWhatsapp.texto}>O código gerado já não está nesta tela. Cancele e gere outro.</Text>
      )}
      <Text style={estilosWhatsapp.texto}>
        {'No celular com esse número:\n1. Abra o WhatsApp e toque em Configurações > Aparelhos conectados.\n2. Toque em Conectar um aparelho e depois em Conectar com número de telefone.\n3. Digite o código acima.'}
      </Text>
      <View style={styles.espera}>
        <ActivityIndicator color={cores.mata} />
        <Text style={estilosWhatsapp.texto}>Esperando a confirmação…</Text>
      </View>
      <Botao rotulo="Cancelar" contorno ocupado={desconectando || pedindoCodigo} aoTocar={desconectar} />
    </View>
  );
}

function Conectado({ numero, grupo, admin }: { numero: string | null; grupo: { id: string; nome: string } | null; admin: boolean }) {
  const { testar, testando, testeEnviado, desconectar, desconectando, erro } = useMudarWhatsapp();
  const [trocando, setTrocando] = useState(false);
  const confirmarDesconexao = () =>
    Alert.alert('Desconectar o WhatsApp?', 'O Talhio deixa de mandar notificações ao grupo até você conectar de novo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desconectar', style: 'destructive', onPress: desconectar },
    ]);

  if (!grupo) {
    return admin ? (
      <View style={estilosWhatsapp.bloco}>
        <Aviso icone="confere" titulo="WhatsApp conectado" texto={numero ? `Número ${formatarNumero(numero)}.` : 'Conectado.'} />
        <EscolherGrupo />
      </View>
    ) : (
      <Aviso icone="atencao" titulo="Falta escolher o grupo" texto="Peça para um administrador escolher o grupo que recebe as notificações." />
    );
  }

  return (
    <View style={estilosWhatsapp.bloco}>
      <Aviso icone="confere" titulo="WhatsApp conectado" texto={numero ? `Número ${formatarNumero(numero)}.` : 'Conectado.'} />
      <View style={styles.grupo}>
        <Text style={styles.grupoRotulo}>Notificações vão para o grupo</Text>
        <Text style={styles.grupoNome}>{grupo.nome}</Text>
      </View>
      {admin ? (
        trocando ? (
          <EscolherGrupo aoCancelar={() => setTrocando(false)} aoEscolher={() => setTrocando(false)} />
        ) : (
          <>
            <Botao rotulo={testeEnviado ? 'Mensagem enviada. Enviar outra' : 'Enviar mensagem de teste'} ocupado={testando} aoTocar={testar} />
            <Botao rotulo="Trocar de grupo" contorno aoTocar={() => setTrocando(true)} />
            <Botao rotulo="Desconectar o WhatsApp" contorno ocupado={desconectando} aoTocar={confirmarDesconexao} />
          </>
        )
      ) : null}
      <Erro mensagem={erro?.message} />
    </View>
  );
}

const styles = StyleSheet.create({
  espera: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  campo: { minHeight: 54, borderRadius: 27, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.cartao, paddingHorizontal: 20, fontFamily: fontes.medio, fontSize: 17, color: cores.texto },
  campoErro: { borderColor: cores.perigoBorda, borderWidth: 2 },
  codigoCaixa: { alignItems: 'center', paddingVertical: 20, borderRadius: 26, backgroundColor: cores.mata },
  codigo: { fontFamily: fontes.titulo, fontSize: 40, lineHeight: 46, letterSpacing: 4, color: cores.milho },
  grupo: { gap: 2, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 24, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda },
  grupoRotulo: { fontFamily: fontes.regular, fontSize: 13, color: cores.textoSuave },
  grupoNome: { fontFamily: fontes.titulo, fontSize: 20, lineHeight: 24, color: cores.texto },
});
