from django.contrib import admin
from django.utils.html import format_html
from .models import Categoria, Conta, Receita, Despesa, Transferencia, Meta, Configuracao, Notificacao, Fatura
from django.utils import timezone

@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ['nome', 'tipo', 'cor_display', 'usuario', 'ativo', 'data_criacao']
    list_filter = ['tipo', 'ativo', 'data_criacao']
    search_fields = ['nome', 'descricao']
    list_editable = ['ativo']
    readonly_fields = ['id', 'data_criacao', 'data_atualizacao']
    
    def cor_display(self, obj):
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            obj.cor, obj.cor
        )
    cor_display.short_description = 'Cor'

@admin.register(Conta)
class ContaAdmin(admin.ModelAdmin):
    list_display = ['nome', 'tipo', 'saldo_atual', 'usuario', 'ativo', 'data_criacao']
    list_filter = ['tipo', 'ativo', 'data_criacao']
    search_fields = ['nome', 'descricao']
    list_editable = ['ativo']
    readonly_fields = ['id', 'saldo_atual', 'data_criacao', 'data_atualizacao']
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('nome', 'tipo', 'descricao')
        }),
        ('Saldo', {
            'fields': ('saldo_inicial', 'saldo_atual')
        }),
        ('Personalização', {
            'fields': ('cor', 'icone')
        }),
        ('Status', {
            'fields': ('usuario', 'ativo')
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Receita)
class ReceitaAdmin(admin.ModelAdmin):
    list_display = ['descricao', 'valor', 'data', 'categoria', 'conta', 'usuario', 'ativo']
    list_filter = ['data', 'categoria', 'conta', 'recorrente', 'ativo', 'data_criacao']
    search_fields = ['descricao', 'observacoes']
    list_editable = ['ativo']
    readonly_fields = ['id', 'data_criacao', 'data_atualizacao']
    date_hierarchy = 'data'
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('descricao', 'valor', 'data')
        }),
        ('Classificação', {
            'fields': ('categoria', 'conta')
        }),
        ('Recorrência', {
            'fields': ('recorrente', 'frequencia')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
        ('Status', {
            'fields': ('usuario', 'ativo')
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Despesa)
class DespesaAdmin(admin.ModelAdmin):
    list_display = ['descricao', 'valor', 'data', 'categoria', 'conta', 'usuario', 'ativo']
    list_filter = ['data', 'categoria', 'conta', 'recorrente', 'ativo', 'data_criacao']
    search_fields = ['descricao', 'observacoes']
    list_editable = ['ativo']
    readonly_fields = ['id', 'data_criacao', 'data_atualizacao']
    date_hierarchy = 'data'
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('descricao', 'valor', 'data')
        }),
        ('Classificação', {
            'fields': ('categoria', 'conta')
        }),
        ('Recorrência', {
            'fields': ('recorrente', 'frequencia')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
        ('Status', {
            'fields': ('usuario', 'ativo')
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Transferencia)
class TransferenciaAdmin(admin.ModelAdmin):
    list_display = ['descricao', 'valor', 'data', 'conta_origem', 'conta_destino', 'usuario', 'ativo']
    list_filter = ['data', 'conta_origem', 'conta_destino', 'ativo', 'data_criacao']
    search_fields = ['descricao', 'observacoes']
    list_editable = ['ativo']
    readonly_fields = ['id', 'data_criacao', 'data_atualizacao']
    date_hierarchy = 'data'
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('descricao', 'valor', 'data')
        }),
        ('Contas', {
            'fields': ('conta_origem', 'conta_destino')
        }),
        ('Taxa', {
            'fields': ('taxa',)
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
        ('Status', {
            'fields': ('usuario', 'ativo')
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Meta)
class MetaAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'valor_meta', 'valor_atual', 'percentual_display', 'data_fim', 'tipo', 'usuario', 'ativo']
    list_filter = ['tipo', 'ativo', 'data_inicio', 'data_fim', 'data_criacao']
    search_fields = ['titulo', 'descricao']
    list_editable = ['ativo']
    readonly_fields = ['id', 'percentual_concluido', 'valor_restante', 'data_criacao', 'data_atualizacao']
    date_hierarchy = 'data_fim'
    
    def percentual_display(self, obj):
        return f"{obj.percentual_concluido:.1f}%"
    percentual_display.short_description = 'Progresso'
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('titulo', 'descricao', 'tipo')
        }),
        ('Valores', {
            'fields': ('valor_meta', 'valor_atual', 'percentual_concluido', 'valor_restante')
        }),
        ('Período', {
            'fields': ('data_inicio', 'data_fim')
        }),
        ('Classificação', {
            'fields': ('categoria', 'conta')
        }),
        ('Status', {
            'fields': ('usuario', 'ativo')
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Configuracao)
class ConfiguracaoAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'dashboard_tipo', 'dashboard_layout', 'dashboard_tema', 'dashboard_refresh']
    list_filter = ['dashboard_tipo', 'dashboard_layout', 'dashboard_tema', 'dashboard_refresh', 'dashboard_animations', 'dashboard_dragdrop']
    search_fields = ['usuario__username', 'usuario__email']
    readonly_fields = ['data_criacao', 'data_atualizacao']
    fieldsets = (
        ('Usuário', {
            'fields': ('usuario',)
        }),
        ('Dashboard', {
            'fields': ('dashboard_tipo', 'dashboard_layout', 'dashboard_tema', 'dashboard_refresh', 'dashboard_animations', 'dashboard_dragdrop')
        }),
        ('Configurações Gerais', {
            'fields': ('moeda_padrao', 'formato_data', 'tema_escuro', 'notificacoes_email', 'backup_automatico')
        }),
        ('Informações do Sistema', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        }),
    )

@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'titulo', 'tipo', 'lida', 'data_criacao']
    list_filter = ['tipo', 'lida', 'data_criacao']
    search_fields = ['usuario__username', 'titulo', 'mensagem']
    readonly_fields = ['data_criacao', 'data_leitura']
    list_per_page = 20
    
    actions = ['marcar_como_lidas', 'marcar_como_nao_lidas']
    
    def marcar_como_lidas(self, request, queryset):
        queryset.update(lida=True, data_leitura=timezone.now())
        self.message_user(request, f'{queryset.count()} notificações marcadas como lidas.')
    marcar_como_lidas.short_description = 'Marcar como lidas'
    
    def marcar_como_nao_lidas(self, request, queryset):
        queryset.update(lida=False, data_leitura=None)
        self.message_user(request, f'{queryset.count()} notificações marcadas como não lidas.')
    marcar_como_nao_lidas.short_description = 'Marcar como não lidas'

@admin.register(Fatura)
class FaturaAdmin(admin.ModelAdmin):
    list_display = ('cartao', 'mes', 'ano', 'valor', 'vencimento', 'paga', 'ajustada', 'data_pagamento')
    list_filter = ('cartao', 'paga', 'ajustada', 'ano', 'mes')
    search_fields = ('cartao__nome',)
