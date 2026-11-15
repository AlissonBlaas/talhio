#!/bin/bash
# Dê dois cliques neste arquivo (no Finder) para publicar o Talhio na AWS.
# Ele abre o Terminal e roda o roteiro infra/publicar.sh, que pede confirmação antes de criar algo.
cd "$(dirname "$0")" || exit 1
./infra/publicar.sh "$@"
echo
read -r -p "Terminou. Aperte Enter para fechar esta janela. " _
