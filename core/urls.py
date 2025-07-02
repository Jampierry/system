from django.urls import path
from . import views
from .views import conta_atualizar_cor, categoria_atualizar_cor

app_name = 'core'

urlpatterns = [
    # Dashboard
    path('', views.dashboard, name='dashboard'),
    
    # Categorias
    path('categorias/', views.categoria_list, name='categoria_list'),
    path('categorias/nova/', views.categoria_create, name='categoria_create'),
    path('categorias/<uuid:pk>/editar/', views.categoria_update, name='categoria_update'),
    path('categorias/<uuid:pk>/remover/', views.categoria_delete, name='categoria_delete'),
    path('categoria/<uuid:pk>/atualizar_cor/', categoria_atualizar_cor, name='categoria_atualizar_cor'),
    
    # Contas
    path('contas/', views.conta_list, name='conta_list'),
    path('contas/nova/', views.conta_create, name='conta_create'),
    path('contas/<uuid:pk>/editar/', views.conta_update, name='conta_update'),
    path('contas/<uuid:pk>/remover/', views.conta_delete, name='conta_delete'),
    path('conta/<uuid:pk>/atualizar_cor/', conta_atualizar_cor, name='conta_atualizar_cor'),
    
    # Receitas
    path('receitas/', views.receita_list, name='receita_list'),
    path('receitas/nova/', views.receita_create, name='receita_create'),
    path('receitas/<uuid:pk>/editar/', views.receita_update, name='receita_update'),
    path('receitas/<uuid:pk>/remover/', views.receita_delete, name='receita_delete'),
    
    # Despesas
    path('despesas/', views.despesa_list, name='despesa_list'),
    path('despesas/nova/', views.despesa_create, name='despesa_create'),
    path('despesas/<uuid:pk>/editar/', views.despesa_edit, name='despesa_edit'),
    path('despesas/<uuid:pk>/remover/', views.despesa_delete, name='despesa_delete'),
    
    # Transferências
    path('transferencias/', views.transferencia_list, name='transferencia_list'),
    path('transferencias/nova/', views.transferencia_create, name='transferencia_create'),
    path('transferencias/<uuid:pk>/editar/', views.transferencia_update, name='transferencia_update'),
    path('transferencias/<uuid:pk>/remover/', views.transferencia_delete, name='transferencia_delete'),
    
    # Metas
    path('metas/', views.meta_list, name='meta_list'),
    path('metas/nova/', views.meta_create, name='meta_create'),
    path('metas/<uuid:pk>/editar/', views.meta_update, name='meta_update'),
    path('metas/<uuid:pk>/remover/', views.meta_delete, name='meta_delete'),
    
    # Relatórios
    path('relatorios/', views.relatorio_financeiro, name='relatorio_financeiro'),
    
    # Configurações
    path('configuracoes/', views.configuracoes, name='configuracoes'),
    
    # URLs para Notificações
    path('notificacoes/', views.notificacoes_list, name='notificacoes_list'),
    path('notificacoes/<int:pk>/', views.notificacao_detail, name='notificacao_detail'),
    path('notificacoes/<int:pk>/marcar-lida/', views.notificacao_marcar_lida, name='notificacao_marcar_lida'),
    path('notificacoes/marcar-todas-lidas/', views.notificacao_marcar_todas_lidas, name='notificacao_marcar_todas_lidas'),
    path('notificacoes/<int:pk>/excluir/', views.notificacao_delete, name='notificacao_delete'),
    path('api/notificacoes/count/', views.notificacoes_count, name='notificacoes_count'),
    path('api/notificacoes/recentes/', views.notificacoes_recentes, name='notificacoes_recentes'),
    
    # API endpoints
    path('api/conta/<uuid:pk>/saldo/', views.api_saldo_conta, name='api_saldo_conta'),
    path('api/dashboard/dados/', views.api_dados_dashboard, name='api_dados_dashboard'),
    
    # Backup
    path('backup/exportar/', views.exportar_backup, name='exportar_backup'),
    path('backup/importar/', views.importar_backup, name='importar_backup'),
    path('backup/listar/', views.listar_backups, name='listar_backups'),
    path('backup/baixar/<str:filename>/', views.baixar_backup, name='baixar_backup'),
    path('backup/excluir/<str:filename>/', views.excluir_backup, name='excluir_backup'),
    path('backup/importar-arquivo/<str:filename>/', views.importar_backup_arquivo, name='importar_backup_arquivo'),
    path('excluir_dados_ficticios/', views.excluir_dados_ficticios, name='excluir_dados_ficticios'),
    path('exportar_banco_completo/', views.exportar_banco_completo, name='exportar_banco_completo'),
    path('importar_banco_completo/', views.importar_banco_completo, name='importar_banco_completo'),
    
    # Cartões de Crédito
    path('cartoes/', views.cartao_credito_list, name='cartao_credito_list'),
    path('cartoes/novo/', views.cartao_credito_create, name='cartao_credito_create'),
    path('cartoes/<uuid:pk>/editar/', views.cartao_credito_update, name='cartao_credito_update'),
    path('cartoes/<uuid:pk>/remover/', views.cartao_credito_delete, name='cartao_credito_delete'),
    path('cartoes/<uuid:pk>/inativar/', views.cartao_credito_inativar, name='cartao_credito_inativar'),
    path('cartoes/<uuid:pk>/reativar/', views.cartao_credito_reativar, name='cartao_credito_reativar'),
    path('cartao/<uuid:pk>/', views.cartao_detalhe, name='cartao_detalhe'),
    path('cartoes-dashboard/', views.cartoes_dashboard, name='cartoes_dashboard'),
    path('fatura/<int:fatura_id>/pagar/', views.pagar_fatura, name='pagar_fatura'),
    path('fatura/<int:fatura_id>/reabrir/', views.reabrir_fatura, name='reabrir_fatura'),
    path('fatura/<int:fatura_id>/ajustar/', views.ajustar_fatura, name='ajustar_fatura'),
    path('fatura/nova/', views.nova_fatura, name='nova_fatura'),
] 