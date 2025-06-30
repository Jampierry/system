#!/usr/bin/env python3
"""
Script de atalho para atualizar o repositório Git
Execute diretamente: python update_git.py
"""

import sys
import os

# Adiciona o diretório dos scripts ao path
script_dir = os.path.join(os.path.dirname(__file__), "Scripts git")
sys.path.insert(0, script_dir)

# Importa e executa o script principal
try:
    import atualiza_git
    print("🚀 Executando script de atualização Git...")
    atualiza_git.main()
except ImportError:
    print("❌ Erro: Não foi possível importar o script de atualização.")
    print("📁 Verifique se o arquivo 'Scripts git/atualiza_git.py' existe.")
    sys.exit(1)
except Exception as e:
    print(f"💥 Erro inesperado: {e}")
    sys.exit(1) 