# Scripts de Atualização Git

Este diretório contém scripts para atualizar automaticamente o repositório Git do projeto SGFP.

## Scripts Disponíveis

### 1. `atualiza_git.py` (Recomendado para Cursor IA)
Script Python que pode ser executado diretamente pelo Cursor IA.

**Como usar:**
```bash
# Na raiz do projeto
python "SGFP Web - Sistema Gestão Financeira Pessoal/Scripts git/atualiza_git.py"

# Ou navegando para o diretório
cd "SGFP Web - Sistema Gestão Financeira Pessoal/Scripts git"
python atualiza_git.py
```

### 2. `atualiza_git.ps1` (PowerShell para Windows)
Script PowerShell otimizado para Windows.

**Como usar:**
```powershell
# Na raiz do projeto
powershell -ExecutionPolicy Bypass -File "SGFP Web - Sistema Gestão Financeira Pessoal/Scripts git/atualiza_git.ps1"

# Ou navegando para o diretório
cd "SGFP Web - Sistema Gestão Financeira Pessoal/Scripts git"
.\atualiza_git.ps1
```

### 3. `atualiza_git.sh` (Bash para Linux/Mac)
Script Bash original.

**Como usar:**
```bash
# Na raiz do projeto
bash "SGFP Web - Sistema Gestão Financeira Pessoal/Scripts git/atualiza_git.sh"

# Ou navegando para o diretório
cd "SGFP Web - Sistema Gestão Financeira Pessoal/Scripts git"
bash atualiza_git.sh
```

## Como Executar no Cursor IA

### Opção 1: Comando Direto (Recomendado)
No terminal do Cursor IA, execute:
```bash
python "SGFP Web - Sistema Gestão Financeira Pessoal/Scripts git/atualiza_git.py"
```

### Opção 2: Usando PowerShell
```powershell
powershell -ExecutionPolicy Bypass -File "SGFP Web - Sistema Gestão Financeira Pessoal/Scripts git/atualiza_git.ps1"
```

### Opção 3: Atalho Personalizado
Você pode criar um alias ou atalho no seu sistema:

**Para Windows (PowerShell):**
```powershell
# Adicione ao seu perfil do PowerShell
function Update-Git {
    & "E:\OneDrive\OneDrive - p06g\_Projetos Python\SGFP Web - Sistema Gestão Financeira Pessoal\Scripts git\atualiza_git.ps1"
}
```

**Para Bash/Linux:**
```bash
# Adicione ao seu .bashrc ou .zshrc
alias update-git='python "SGFP Web - Sistema Gestão Financeira Pessoal/Scripts git/atualiza_git.py"'
```

## O que os Scripts Fazem

1. **Verificam alterações**: Detectam se há arquivos modificados, adicionados ou removidos
2. **Mostram status**: Exibem quais arquivos foram alterados
3. **Adicionam alterações**: Executam `git add .`
4. **Fazem commit**: Criam um commit com timestamp automático
5. **Fazem push**: Enviam as alterações para o GitHub

## Recursos dos Scripts

- ✅ **Detecção automática** do diretório do projeto
- ✅ **Feedback visual** com emojis e cores
- ✅ **Tratamento de erros** robusto
- ✅ **Mensagens informativas** em cada etapa
- ✅ **Compatibilidade** com diferentes sistemas operacionais

## Exemplo de Saída

```
🔄 Iniciando atualização do repositório Git...
📁 Diretório do projeto: E:\OneDrive\OneDrive - p06g\_Projetos Python\SGFP Web - Sistema Gestão Financeira Pessoal
🔍 Verificando alterações...
📝 Alterações detectadas:
M  core/models.py
A  templates/core/novo_template.html
🌿 Branch atual: main
📦 Adicionando alterações...
💾 Fazendo commit: Atualização automática: 2024-01-15 14:30:25
✅ Commit realizado: [main abc1234] Atualização automática: 2024-01-15 14:30:25
🚀 Enviando para o GitHub...
✅ Alterações enviadas para o GitHub na branch main!
📤 Push realizado com sucesso: To github.com:usuario/repositorio.git

🎉 Atualização concluída com sucesso!
```

## Troubleshooting

### Erro de Permissão (PowerShell)
Se receber erro de política de execução:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Git não encontrado
Certifique-se de que o Git está instalado e no PATH do sistema.

### Repositório não inicializado
Certifique-se de que o diretório contém um repositório Git válido (pasta `.git`).

## Contribuição

Para melhorar os scripts, você pode:
1. Adicionar mais opções de configuração
2. Implementar backup automático antes do push
3. Adicionar suporte a diferentes tipos de commit
4. Melhorar o tratamento de conflitos 