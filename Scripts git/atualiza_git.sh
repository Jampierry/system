#!/bin/bash
# Script Bash para atualizar o repositório Git automaticamente
# Execute na raiz do projeto: bash ./atualiza_git.sh

if [[ -n $(git status --porcelain) ]]; then
    branch=$(git rev-parse --abbrev-ref HEAD)
    git add .
    msg="Atualização automática: $(date '+%Y-%m-%d %H:%M:%S')"
    git commit -m "$msg"
    git push origin "$branch"
    echo "Alterações enviadas para o GitHub na branch $branch."
else
    echo "Nenhuma alteração para enviar."
fi 