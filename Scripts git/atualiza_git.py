#!/usr/bin/env python3
"""
Script Python para atualizar o repositório Git automaticamente
Execute na raiz do projeto: python atualiza_git.py
Ou use o comando: python "SGFP Web - Sistema Gestão Financeira Pessoal/Scripts git/atualiza_git.py"
"""

import subprocess
import sys
import os
from datetime import datetime

def run_command(command, cwd=None):
    """Executa um comando e retorna o resultado"""
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            capture_output=True, 
            text=True, 
            cwd=cwd
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return False, "", str(e)

def get_project_root():
    """Obtém o diretório raiz do projeto"""
    # Tenta encontrar o diretório que contém .git
    current_dir = os.getcwd()
    while current_dir != os.path.dirname(current_dir):
        if os.path.exists(os.path.join(current_dir, '.git')):
            return current_dir
        current_dir = os.path.dirname(current_dir)
    
    # Se não encontrar, usa o diretório atual
    return os.getcwd()

def main():
    """Função principal do script"""
    print("🔄 Iniciando atualização do repositório Git...")
    
    # Obtém o diretório raiz do projeto
    project_root = get_project_root()
    print(f"📁 Diretório do projeto: {project_root}")
    
    # Verifica se há alterações
    success, output, error = run_command("git status --porcelain", cwd=project_root)
    
    if not success:
        print(f"❌ Erro ao verificar status do Git: {error}")
        return False
    
    if not output.strip():
        print("✅ Nenhuma alteração para enviar.")
        return True
    
    print("📝 Alterações detectadas:")
    print(output)
    
    # Obtém a branch atual
    success, branch, error = run_command("git rev-parse --abbrev-ref HEAD", cwd=project_root)
    if not success:
        print(f"❌ Erro ao obter branch atual: {error}")
        return False
    
    print(f"🌿 Branch atual: {branch}")
    
    # Adiciona todas as alterações
    print("📦 Adicionando alterações...")
    success, output, error = run_command("git add .", cwd=project_root)
    if not success:
        print(f"❌ Erro ao adicionar alterações: {error}")
        return False
    
    # Cria a mensagem de commit
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    commit_message = f"Atualização automática: {timestamp}"
    
    # Faz o commit
    print(f"💾 Fazendo commit: {commit_message}")
    success, output, error = run_command(f'git commit -m "{commit_message}"', cwd=project_root)
    if not success:
        print(f"❌ Erro ao fazer commit: {error}")
        return False
    
    print(f"✅ Commit realizado: {output}")
    
    # Faz o push
    print(f"🚀 Enviando para o GitHub...")
    success, output, error = run_command(f"git push origin {branch}", cwd=project_root)
    if not success:
        print(f"❌ Erro ao fazer push: {error}")
        return False
    
    print(f"✅ Alterações enviadas para o GitHub na branch {branch}!")
    print(f"📤 Push realizado com sucesso: {output}")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        if success:
            print("\n🎉 Atualização concluída com sucesso!")
        else:
            print("\n💥 Falha na atualização!")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n⏹️ Operação cancelada pelo usuário.")
        sys.exit(1)
    except Exception as e:
        print(f"\n💥 Erro inesperado: {e}")
        sys.exit(1) 