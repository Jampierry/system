// SGFP - Sistema de Gestão Financeira Pessoal
// JavaScript principal

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Inicializar popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Formatação de valores monetários
    window.formatCurrency = function(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    // Formatação de datas
    window.formatDate = function(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    // Função para mostrar loading
    window.showLoading = function(element) {
        if (element) {
            element.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Carregando...';
            element.disabled = true;
        }
    };

    // Função para esconder loading
    window.hideLoading = function(element, originalText) {
        if (element) {
            element.innerHTML = originalText;
            element.disabled = false;
        }
    };

    // Função para mostrar notificações
    window.showNotification = function(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const container = document.querySelector('.container-fluid') || document.querySelector('.container');
        if (container) {
            container.insertBefore(alertDiv, container.firstChild);
            
            // Auto-remover após 5 segundos
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                }
            }, 5000);
        }
    };

    // Função para confirmar ações
    window.confirmAction = function(message, callback) {
        if (confirm(message)) {
            callback();
        }
    };

    // Função para validar formulários
    window.validateForm = function(formElement) {
        const inputs = formElement.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (!input.value.trim()) {
                input.classList.add('is-invalid');
                isValid = false;
            } else {
                input.classList.remove('is-invalid');
            }
        });

        return isValid;
    };

    // Função para limpar formulários
    window.clearForm = function(formElement) {
        const inputs = formElement.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.value = '';
            input.classList.remove('is-invalid');
        });
    };

    // Função para atualizar saldo da conta via AJAX
    window.updateAccountBalance = function(accountId) {
        fetch(`/api/conta/${accountId}/saldo/`)
            .then(response => response.json())
            .then(data => {
                const balanceElement = document.querySelector(`[data-account-id="${accountId}"]`);
                if (balanceElement) {
                    balanceElement.textContent = formatCurrency(data.saldo);
                    balanceElement.className = data.saldo >= 0 ? 'text-success' : 'text-danger';
                }
            })
            .catch(error => {
                console.error('Erro ao atualizar saldo:', error);
            });
    };

    // Função para exportar dados
    window.exportData = function(data, filename, type = 'csv') {
        let content = '';
        let mimeType = '';

        if (type === 'csv') {
            content = convertToCSV(data);
            mimeType = 'text/csv';
        } else if (type === 'json') {
            content = JSON.stringify(data, null, 2);
            mimeType = 'application/json';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Função para converter dados para CSV
    function convertToCSV(data) {
        if (!data || data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
        ].join('\n');

        return csvContent;
    }

    // Função para filtrar tabelas
    window.filterTable = function(tableId, searchTerm) {
        const table = document.getElementById(tableId);
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr');
        const term = searchTerm.toLowerCase();

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    };

    // Função para ordenar tabelas
    window.sortTable = function(tableId, columnIndex, type = 'string') {
        const table = document.getElementById(tableId);
        if (!table) return;

        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.sort((a, b) => {
            let aValue = a.cells[columnIndex].textContent.trim();
            let bValue = b.cells[columnIndex].textContent.trim();

            if (type === 'number') {
                aValue = parseFloat(aValue.replace(/[^\d.-]/g, '')) || 0;
                bValue = parseFloat(bValue.replace(/[^\d.-]/g, '')) || 0;
            } else if (type === 'date') {
                aValue = new Date(aValue.split('/').reverse().join('-'));
                bValue = new Date(bValue.split('/').reverse().join('-'));
            }

            if (aValue < bValue) return -1;
            if (aValue > bValue) return 1;
            return 0;
        });

        // Limpar tbody e adicionar linhas ordenadas
        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
    };

    // Função para alternar tema escuro
    window.toggleDarkTheme = function() {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        // Atualizar ícone se existir
        const themeIcon = document.getElementById('theme-icon');
        if (themeIcon) {
            themeIcon.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    };

    // Carregar tema salvo
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
    }

    // Função para fazer backup dos dados
    window.backupData = function() {
        showNotification('Iniciando backup dos dados...', 'info');
        
        fetch('/api/backup/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('Backup realizado com sucesso!', 'success');
            } else {
                showNotification('Erro ao realizar backup: ' + data.error, 'danger');
            }
        })
        .catch(error => {
            showNotification('Erro ao realizar backup: ' + error.message, 'danger');
        });
    };

    // Função para obter cookie CSRF
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Event listeners para formulários
    document.addEventListener('submit', function(e) {
        const form = e.target;
        if (form.classList.contains('needs-validation')) {
            if (!validateForm(form)) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    });

    // Event listeners para botões de loading
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('btn-loading')) {
            const originalText = e.target.innerHTML;
            showLoading(e.target);
            
            // Simular operação assíncrona
            setTimeout(() => {
                hideLoading(e.target, originalText);
            }, 2000);
        }
    });

    // Event listeners para filtros de tabela
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('table-filter')) {
            const tableId = e.target.getAttribute('data-table');
            const searchTerm = e.target.value;
            filterTable(tableId, searchTerm);
        }
    });

    // Event listeners para ordenação de tabela
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('sortable')) {
            const tableId = e.target.closest('table').id;
            const columnIndex = Array.from(e.target.parentNode.children).indexOf(e.target);
            const dataType = e.target.getAttribute('data-type') || 'string';
            sortTable(tableId, columnIndex, dataType);
        }
    });

    console.log('SGFP JavaScript carregado com sucesso!');
}); 