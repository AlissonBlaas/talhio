import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { cores, fontes } from '@/shared/theme/tokens';

import { useGruposWhatsapp } from '../hooks/useGruposWhatsapp';
import { useMudarWhatsapp } from '../hooks/useMudarWhatsapp';
import { Botao, Erro, estilosWhatsapp } from './elementos';

/** Lista os grupos do WhatsApp conectado; tocar em um define para onde as notificações vão. */
export const EscolherGrupo = memo(function EscolherGrupo({ aoCancelar, aoEscolher }: { aoCancelar?: () => void; aoEscolher?: () => void } = {}) {
  const { grupos, carregando, erro, atualizar } = useGruposWhatsapp(true);
  const { escolherGrupo, escolhendoGrupo, erro: erroEscolha } = useMudarWhatsapp();
  return (
    <View style={estilosWhatsapp.bloco}>
      <Text style={estilosWhatsapp.titulo}>Escolha o grupo</Text>
      <Text style={estilosWhatsapp.texto}>As notificações da fazenda vão chegar neste grupo do WhatsApp. O número conectado precisa estar nele.</Text>
      {carregando ? (
        <Carregando />
      ) : erro ? (
        <ErroComTentarDeNovo mensagem={erro.message} aoTentar={atualizar} />
      ) : grupos.length === 0 ? (
        <Text style={estilosWhatsapp.texto}>Esse número não está em nenhum grupo. Crie o grupo no WhatsApp, adicione a equipe e volte aqui.</Text>
      ) : (
        grupos.map((g) => (
          <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`Usar o grupo ${g.nome}`} disabled={escolhendoGrupo} onPress={() => escolherGrupo(g.id, { onSuccess: aoEscolher })} style={({ pressed }) => [styles.linha, pressed && styles.apertado]}>
            <Text style={styles.nome} numberOfLines={1}>
              {g.nome}
            </Text>
            <Text style={styles.pessoas}>{g.participantes} pessoas</Text>
          </Pressable>
        ))
      )}
      <Erro mensagem={erroEscolha?.message} />
      {aoCancelar ? <Botao rotulo="Cancelar" contorno aoTocar={aoCancelar} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  linha: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 24, paddingHorizontal: 18 },
  apertado: { opacity: 0.7 },
  nome: { flex: 1, fontFamily: fontes.rotulo, fontSize: 17, color: cores.texto },
  pessoas: { fontFamily: fontes.regular, fontSize: 13, color: cores.textoSuave },
});
