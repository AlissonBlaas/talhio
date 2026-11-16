import { StyleSheet, Text, View } from 'react-native';

import { Carregando, ErroComTentarDeNovo, Vazio } from '@/shared/components/estado-tela';
import { cores, fontes } from '@/shared/theme/tokens';

import { useMaquinas } from '../hooks/useMaquinas';
import { LarguraDoImplemento } from './LarguraDoImplemento';

/**
 * Lista das máquinas da fazenda para informar, de uma vez, a largura do implemento que cada uma puxa. Sozinho: busca
 * as máquinas e cada linha salva a sua. Usado no onboarding; na tela da máquina o mesmo campo aparece de novo.
 */
export function PassoLarguras() {
  const { maquinas, carregando, erro, atualizar } = useMaquinas();
  if (carregando) return <Carregando />;
  if (erro) return <ErroComTentarDeNovo mensagem={erro.message} aoTentar={atualizar} />;
  if (maquinas.length === 0) return <Vazio>Nenhuma máquina apareceu ainda. Depois de conectar a John Deere, elas chegam em alguns minutos.</Vazio>;
  return (
    <View style={styles.lista}>
      {maquinas.map((maquina) => (
        <View key={maquina.id} style={styles.item}>
          <Text style={styles.nome} numberOfLines={1}>
            {maquina.nome}
          </Text>
          {maquina.implemento ? (
            <Text style={styles.implemento} numberOfLines={1}>
              {maquina.implemento}
            </Text>
          ) : null}
          <LarguraDoImplemento maquina={maquina} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { gap: 6 },
  item: { paddingTop: 10 },
  nome: { fontFamily: fontes.rotulo, fontSize: 16, lineHeight: 20, color: cores.texto },
  implemento: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoSuave },
});
