# Script PowerShell para atualizar o repositório Git automaticamente
# Execute na raiz do projeto: .\atualiza_git.ps1
# Ou use o comando: powershell -ExecutionPolicy Bypass -File "atualiza_git.ps1"

param(
    [string]$ProjectPath = ""
)

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Get-ProjectRoot {
    # Tenta encontrar o diretório que contém .git
    $currentDir = Get-Location
    while ($currentDir.Path -ne (Split-Path $currentDir.Path -Parent)) {
        if (Test-Path (Join-Path $currentDir.Path ".git")) {
            return $currentDir.Path
        }
        $currentDir = Split-Path $currentDir.Path -Parent
    }
    
    # Se não encontrar, usa o diretório atual
    return (Get-Location).Path
}

function Invoke-GitCommand {
    param(
        [string]$Command,
        [string]$WorkingDirectory = ""
    )
    
    try {
        if ($WorkingDirectory) {
            $result = Invoke-Expression "git -C '$WorkingDirectory' $Command" 2>&1
        } else {
            $result = Invoke-Expression "git $Command" 2>&1
        }
        
        $success = $LASTEXITCODE -eq 0
        return @{
            Success = $success
            Output = if ($success) { $result } else { "" }
            Error = if (-not $success) { $result } else { "" }
        }
    }
    catch {
        return @{
            Success = $false
            Output = ""
            Error = $_.Exception.Message
        }
    }
}

# Função principal
function Main {
    Write-ColorOutput "🔄 Iniciando atualização do repositório Git..." "Cyan"
    
    # Define o diretório do projeto
    if ($ProjectPath) {
        $projectRoot = $ProjectPath
    } else {
        $projectRoot = Get-ProjectRoot
    }
    
    Write-ColorOutput "📁 Diretório do projeto: $projectRoot" "Yellow"
    
    # Verifica se há alterações
    Write-ColorOutput "🔍 Verificando alterações..." "Cyan"
    $statusResult = Invoke-GitCommand "status --porcelain" $projectRoot
    
    if (-not $statusResult.Success) {
        Write-ColorOutput "❌ Erro ao verificar status do Git: $($statusResult.Error)" "Red"
        return $false
    }
    
    if (-not $statusResult.Output.Trim()) {
        Write-ColorOutput "✅ Nenhuma alteração para enviar." "Green"
        return $true
    }
    
    Write-ColorOutput "📝 Alterações detectadas:" "Yellow"
    Write-ColorOutput $statusResult.Output "Gray"
    
    # Obtém a branch atual
    $branchResult = Invoke-GitCommand "rev-parse --abbrev-ref HEAD" $projectRoot
    if (-not $branchResult.Success) {
        Write-ColorOutput "❌ Erro ao obter branch atual: $($branchResult.Error)" "Red"
        return $false
    }
    
    $branch = $branchResult.Output.Trim()
    Write-ColorOutput "🌿 Branch atual: $branch" "Yellow"
    
    # Adiciona todas as alterações
    Write-ColorOutput "📦 Adicionando alterações..." "Cyan"
    $addResult = Invoke-GitCommand "add ." $projectRoot
    if (-not $addResult.Success) {
        Write-ColorOutput "❌ Erro ao adicionar alterações: $($addResult.Error)" "Red"
        return $false
    }
    
    # Cria a mensagem de commit
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMessage = "Atualização automática: $timestamp"
    
    # Faz o commit
    Write-ColorOutput "💾 Fazendo commit: $commitMessage" "Cyan"
    $commitResult = Invoke-GitCommand "commit -m `"$commitMessage`"" $projectRoot
    if (-not $commitResult.Success) {
        Write-ColorOutput "❌ Erro ao fazer commit: $($commitResult.Error)" "Red"
        return $false
    }
    
    Write-ColorOutput "✅ Commit realizado: $($commitResult.Output)" "Green"
    
    # Faz o push
    Write-ColorOutput "🚀 Enviando para o GitHub..." "Cyan"
    $pushResult = Invoke-GitCommand "push origin $branch" $projectRoot
    if (-not $pushResult.Success) {
        Write-ColorOutput "❌ Erro ao fazer push: $($pushResult.Error)" "Red"
        return $false
    }
    
    Write-ColorOutput "✅ Alterações enviadas para o GitHub na branch $branch!" "Green"
    Write-ColorOutput "📤 Push realizado com sucesso: $($pushResult.Output)" "Green"
    
    return $true
}

# Execução principal
try {
    $success = Main
    if ($success) {
        Write-ColorOutput "`n🎉 Atualização concluída com sucesso!" "Green"
    } else {
        Write-ColorOutput "`n💥 Falha na atualização!" "Red"
        exit 1
    }
}
catch {
    Write-ColorOutput "`n💥 Erro inesperado: $($_.Exception.Message)" "Red"
    exit 1
} 