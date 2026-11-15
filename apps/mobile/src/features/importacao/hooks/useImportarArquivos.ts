import { useMutation, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';

import { importacaoApi } from '../api/importacaoApi';

/** Maior tamanho somado dos arquivos de uma importação (o servidor aceita 30 MB já em base64). */
const LIMITE_BYTES = 15 * 1024 * 1024;

/**
 * Abre o seletor de arquivos do aparelho, envia o que foi escolhido e devolve o que entrou.
 * Devolve `null` se a pessoa fechou o seletor sem escolher nada.
 */
async function escolherEImportar() {
  const escolha = await File.pickFileAsync({ multipleFiles: true });
  if (escolha.canceled) return null;

  const total = escolha.result.reduce((soma, arquivo) => soma + (arquivo.size ?? 0), 0);
  if (total > LIMITE_BYTES) throw new Error('Os arquivos somam mais de 15 MB. Envie só a pasta do monitor, sem outros arquivos.');

  const arquivos = await Promise.all(escolha.result.map(async (arquivo) => ({ nome: arquivo.name, conteudoBase64: await arquivo.base64() })));
  return importacaoApi.gen4({ arquivos });
}

export function useImportarArquivos() {
  const queryClient = useQueryClient();
  const mutacao = useMutation({
    mutationFn: escolherEImportar,
    // Talhões, linhas, máquinas e painel mudam juntos: tudo é buscado de novo.
    onSuccess: (resultado) => (resultado ? queryClient.invalidateQueries() : undefined),
  });
  return {
    importar: () => mutacao.mutate(),
    importando: mutacao.isPending,
    resultado: mutacao.data ?? null,
    erro: mutacao.error,
  };
}
