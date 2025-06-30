# Script PowerShell para atualizar o repositório Git automaticamente
# Execute na raiz do projeto: powershell -ExecutionPolicy Bypass -File .\atualiza_git.ps1

$gitStatus = git status --porcelain

if ($gitStatus) {
    $branch = git rev-parse --abbrev-ref HEAD
    git add .
    $msg = "Atualização automática: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git commit -m "$msg"
    git push origin $branch
    Write-Host "Alterações enviadas para o GitHub na branch $branch."
} else {
    Write-Host "Nenhuma alteração para enviar."
} 