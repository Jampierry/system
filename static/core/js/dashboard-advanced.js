/**
 * Dashboard Avançado - Funcionalidades Extras
 * SGFP - Sistema de Gestão Financeira Pessoal
 */

class DashboardManager {
    constructor() {
        this.grid = null;
        this.charts = {};
        this.config = this.loadConfig();
        this.init();
    }

    init() {
        this.initGrid();
        this.initCharts();
        this.initEventListeners();
        this.applyConfig();
        this.startAutoRefresh();
    }

    initGrid() {
        // Inicializar GridStack se disponível
        if (typeof GridStack !== 'undefined') {
            this.grid = GridStack.init({
                column: 12,
                cellHeight: 60,
                animate: true,
                float: false,
                removable: false,
                disableOneColumnMode: true,
                resizable: {
                    handles: 'all'
                },
                draggable: {
                    handle: '.grid-stack-item-content'
                }
            });

            // Salvar layout quando mudar
            this.grid.on('change', (event, items) => {
                this.saveLayout();
            });

            // Redimensionar gráficos quando o grid mudar
            this.grid.on('resize', (event, element) => {
                setTimeout(() => {
                    this.resizeCharts();
                }, 100);
            });
        }
    }

    initCharts() {
        // Inicializar gráficos existentes
        const chartElements = document.querySelectorAll('canvas');
        chartElements.forEach(canvas => {
            const chartId = canvas.id;
            if (window[chartId]) {
                this.charts[chartId] = window[chartId];
            }
        });
    }

    initEventListeners() {
        // Event listeners para configurações
        document.addEventListener('DOMContentLoaded', () => {
            this.loadSavedLayout();
            this.initTooltips();
            this.initKeyboardShortcuts();
        });

        // Fechar painel de configuração ao clicar fora
        document.addEventListener('click', (event) => {
            const panel = document.getElementById('configPanel');
            const configBtn = event.target.closest('[onclick="toggleConfig()"]');
            
            if (panel && !panel.contains(event.target) && !configBtn && panel.classList.contains('show')) {
                panel.classList.remove('show');
            }
        });

        // Atalhos de teclado
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
    }

    initTooltips() {
        // Inicializar tooltips personalizados
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target, e.target.dataset.tooltip);
            });
            
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'custom-tooltip';
        tooltip.textContent = text;
        document.body.appendChild(tooltip);

        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 10 + 'px';
        
        setTimeout(() => tooltip.classList.add('show'), 10);
        
        element.tooltip = tooltip;
    }

    hideTooltip() {
        const tooltip = document.querySelector('.custom-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    initKeyboardShortcuts() {
        // Adicionar tooltips para atalhos de teclado
        const shortcuts = {
            'F5': 'Atualizar Dashboard',
            'Ctrl+Shift+C': 'Abrir Configurações',
            'Ctrl+Shift+R': 'Resetar Layout',
            'Ctrl+Shift+S': 'Salvar Configurações'
        };

        Object.entries(shortcuts).forEach(([key, description]) => {
            const elements = document.querySelectorAll(`[data-shortcut="${key}"]`);
            elements.forEach(element => {
                element.setAttribute('data-tooltip', `${description} (${key})`);
            });
        });
    }

    handleKeyboardShortcuts(event) {
        // F5 - Atualizar dashboard
        if (event.key === 'F5') {
            event.preventDefault();
            this.refreshDashboard();
        }
        
        // Ctrl+Shift+C - Abrir configurações
        if (event.ctrlKey && event.shiftKey && event.key === 'C') {
            event.preventDefault();
            this.toggleConfig();
        }
        
        // Ctrl+Shift+R - Resetar layout
        if (event.ctrlKey && event.shiftKey && event.key === 'R') {
            event.preventDefault();
            this.resetLayout();
        }
        
        // Ctrl+Shift+S - Salvar configurações
        if (event.ctrlKey && event.shiftKey && event.key === 'S') {
            event.preventDefault();
            this.saveConfig();
        }
    }

    loadConfig() {
        const saved = localStorage.getItem('dashboardConfig');
        return saved ? JSON.parse(saved) : {
            layout: 'default',
            theme: 'default',
            refreshInterval: 5,
            animations: true,
            dragDrop: true,
            showTooltips: true,
            enableShortcuts: true,
            dashboardType: 'responsive'
        };
    }

    saveConfig() {
        localStorage.setItem('dashboardConfig', JSON.stringify(this.config));
        this.showNotification('Configurações salvas com sucesso!', 'success');
    }

    applyConfig() {
        // Aplicar tema
        this.applyTheme(this.config.theme);
        
        // Aplicar layout
        this.applyLayout(this.config.layout);
        
        // Aplicar animações
        this.toggleAnimations(this.config.animations);
        
        // Aplicar drag & drop
        this.toggleDragDrop(this.config.dragDrop);
        
        // Aplicar tooltips
        this.toggleTooltips(this.config.showTooltips);
        
        // Aplicar atalhos
        this.toggleShortcuts(this.config.enableShortcuts);
        
        // Aplicar tipo de dashboard
        this.applyDashboardType(this.config.dashboardType);
    }

    applyTheme(theme) {
        document.body.className = document.body.className.replace(/theme-\w+/g, '');
        if (theme !== 'default') {
            document.body.classList.add('theme-' + theme);
        }
    }

    applyLayout(layout) {
        if (!this.grid) return;
        
        switch(layout) {
            case 'compact':
                this.grid.column(8);
                break;
            case 'wide':
                this.grid.column(16);
                break;
            case 'tall':
                this.grid.column(6);
                break;
            default:
                this.grid.column(12);
        }
    }

    applyDashboardType(type) {
        const dashboardTypeSelect = document.getElementById('dashboardType');
        if (dashboardTypeSelect) {
            dashboardTypeSelect.value = type;
        }
    }

    toggleAnimations(enabled) {
        if (enabled) {
            document.body.classList.remove('no-animations');
        } else {
            document.body.classList.add('no-animations');
        }
    }

    toggleDragDrop(enabled) {
        if (!this.grid) return;
        
        if (enabled) {
            this.grid.enable();
        } else {
            this.grid.disable();
        }
    }

    toggleTooltips(enabled) {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            if (enabled) {
                element.style.pointerEvents = 'auto';
            } else {
                element.style.pointerEvents = 'none';
            }
        });
    }

    toggleShortcuts(enabled) {
        this.config.enableShortcuts = enabled;
    }

    saveLayout() {
        if (this.grid) {
            const layout = this.grid.save();
            localStorage.setItem('dashboardLayout', JSON.stringify(layout));
        }
    }

    loadSavedLayout() {
        if (this.grid) {
            const savedLayout = localStorage.getItem('dashboardLayout');
            if (savedLayout) {
                this.grid.load(JSON.parse(savedLayout));
            }
        }
    }

    resetLayout() {
        if (this.grid) {
            this.grid.removeAll();
            localStorage.removeItem('dashboardLayout');
            location.reload();
        }
    }

    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }

    refreshDashboard() {
        this.showLoadingOverlay();
        location.reload();
    }

    showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
                <p class="mt-2">Atualizando dashboard...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    startAutoRefresh() {
        if (this.config.refreshInterval > 0) {
            setInterval(() => {
                this.refreshDashboard();
            }, this.config.refreshInterval * 60 * 1000);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Métodos públicos para uso externo
    toggleConfig() {
        const panel = document.getElementById('configPanel');
        if (panel) {
            panel.classList.toggle('show');
        }
    }

    changeLayout(layout) {
        this.config.layout = layout;
        this.applyLayout(layout);
    }

    changeTheme(theme) {
        this.config.theme = theme;
        this.applyTheme(theme);
    }

    changeRefreshInterval(interval) {
        this.config.refreshInterval = parseInt(interval);
        this.startAutoRefresh();
    }

    toggleAnimations(enabled) {
        this.config.animations = enabled;
        this.toggleAnimations(enabled);
    }

    toggleDragDrop(enabled) {
        this.config.dragDrop = enabled;
        this.toggleDragDrop(enabled);
    }

    resetConfig() {
        this.config = {
            layout: 'default',
            theme: 'default',
            refreshInterval: 5,
            animations: true,
            dragDrop: true,
            showTooltips: true,
            enableShortcuts: true,
            dashboardType: 'responsive'
        };
        this.applyConfig();
        this.saveConfig();
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});

// Funções globais para compatibilidade
function toggleConfig() {
    if (window.dashboardManager) {
        window.dashboardManager.toggleConfig();
    }
}

function changeLayout() {
    if (window.dashboardManager) {
        const layout = document.getElementById('layoutSelect').value;
        window.dashboardManager.changeLayout(layout);
    }
}

function changeTheme() {
    if (window.dashboardManager) {
        const theme = document.getElementById('themeSelect').value;
        window.dashboardManager.changeTheme(theme);
    }
}

function changeRefreshInterval() {
    if (window.dashboardManager) {
        const interval = document.getElementById('refreshInterval').value;
        window.dashboardManager.changeRefreshInterval(interval);
    }
}

function toggleAnimations() {
    if (window.dashboardManager) {
        const enabled = document.getElementById('enableAnimations').checked;
        window.dashboardManager.toggleAnimations(enabled);
    }
}

function toggleDragDrop() {
    if (window.dashboardManager) {
        const enabled = document.getElementById('enableDragDrop').checked;
        window.dashboardManager.toggleDragDrop(enabled);
    }
}

function saveConfig() {
    if (window.dashboardManager) {
        window.dashboardManager.saveConfig();
    }
}

function resetConfig() {
    if (window.dashboardManager) {
        window.dashboardManager.resetConfig();
    }
}

function atualizarDashboard() {
    if (window.dashboardManager) {
        window.dashboardManager.refreshDashboard();
    } else {
        location.reload();
    }
}

function changeDashboardType() {
    if (window.dashboardManager) {
        const dashboardType = document.getElementById('dashboardType').value;
        window.dashboardManager.config.dashboardType = dashboardType;
        
        if (dashboardType === 'classic') {
            window.location.href = window.location.pathname + '?type=classic';
        } else {
            window.location.href = window.location.pathname + '?type=responsive';
        }
    }
} 