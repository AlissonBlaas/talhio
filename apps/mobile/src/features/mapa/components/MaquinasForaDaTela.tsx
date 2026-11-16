import type { Maquina } from '@talhio/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { cores } from '@/shared/theme/tokens';

import type { Indicador } from '../foraDaTela';

const TAMANHO = 44;
/** A seta fica para fora do círculo; a caixa que gira precisa caber as duas coisas. */
const CAIXA = 68;

type Props = { indicadores: Indicador<Maquina>[]; aoTocar: (id: string) => void };

/**
 * Avisos na borda do mapa: um por máquina com sinal que está fora da tela, com a cor do estado dela e uma seta
 * para o lado onde ela está. Tocar leva o mapa até a máquina. Parado: não acompanha o dedo, aparece quando o mapa para.
 */
export function MaquinasForaDaTela({ indicadores, aoTocar }: Props) {
  return (
    <>
      {indicadores.map(({ alvo, x, y, anguloGraus }) => {
        const trabalhando = alvo.status === 'trabalhando';
        const cor = trabalhando ? cores.folha : cores.parada;
        const icone = alvo.tipo === 'colheitadeira' || alvo.tipo === 'pulverizador' ? alvo.tipo : 'trator';
        return (
          <Pressable
            key={alvo.id}
            accessibilityRole="button"
            accessibilityLabel={`${alvo.nome}, ${trabalhando ? 'trabalhando' : 'parada'}, fora da tela. Ir até a máquina`}
            onPress={() => aoTocar(alvo.id)}
            style={[styles.caixa, { left: x - CAIXA / 2, top: y - CAIXA / 2, transform: [{ rotate: `${anguloGraus}deg` }] }]}>
            <View style={[styles.seta, { borderLeftColor: '#FFFFFF' }]} />
            <View style={[styles.circulo, { backgroundColor: cor }, trabalhando && styles.circuloTrabalhando]}>
              {/* O desenho da máquina fica em pé, mesmo com a caixa girada para apontar. */}
              <View style={{ transform: [{ rotate: `${-anguloGraus}deg` }] }}>
                <Icone nome={icone} cor={trabalhando ? '#FFFFFF' : cores.sobreMilho} tamanho={22} espessura={2} />
              </View>
            </View>
          </Pressable>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  caixa: { position: 'absolute', width: CAIXA, height: CAIXA, alignItems: 'center', justifyContent: 'center' },
  circulo: {
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: TAMANHO / 2,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  circuloTrabalhando: { borderWidth: 3 },
  // Triângulo feito de borda, encostado no lado direito da caixa (que gira para apontar o alvo).
  seta: { position: 'absolute', right: 0, width: 0, height: 0, borderTopWidth: 8, borderBottomWidth: 8, borderLeftWidth: 11, borderTopColor: 'transparent', borderBottomColor: 'transparent' },
});
