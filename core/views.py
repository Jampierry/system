from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login, authenticate
from django.contrib import messages
from django.http import JsonResponse, FileResponse
from django.db.models import Sum, Count, Q, Avg, Case, When, F, DecimalField
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
import json
import io
import json as pyjson
from django.core.files.uploadedfile import UploadedFile
import uuid
import os
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import logging
from django.urls import reverse
from .models import Categoria, Conta, Receita, Despesa, Transferencia, Meta, Configuracao, Notificacao, CartaoCredito, Fatura
from .forms import (
    UserRegistrationForm, CategoriaForm, ContaForm, ReceitaForm, DespesaForm,
    TransferenciaForm, MetaForm, ConfiguracaoForm, FiltroRelatorioForm, ReceitaFiltroForm, DespesaFiltroForm,
    CartaoCreditoForm, FaturaForm
)

def register(request):
    if request.method == 'POST':
        form = UserRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            # Criar configuração padrão para o usuário
            Configuracao.objects.create(usuario=user)
            # Criar categorias padrão
            categorias_padrao = [
                {'nome': 'Salário', 'tipo': 'receita', 'cor': '#28a745', 'icone': 'fas fa-money-bill-wave'},
                {'nome': 'Freelance', 'tipo': 'receita', 'cor': '#17a2b8', 'icone': 'fas fa-laptop-code'},
                {'nome': 'Investimentos', 'tipo': 'receita', 'cor': '#ffc107', 'icone': 'fas fa-chart-line'},
                {'nome': 'Alimentação', 'tipo': 'despesa', 'cor': '#dc3545', 'icone': 'fas fa-utensils'},
                {'nome': 'Transporte', 'tipo': 'despesa', 'cor': '#fd7e14', 'icone': 'fas fa-car'},
                {'nome': 'Moradia', 'tipo': 'despesa', 'cor': '#6f42c1', 'icone': 'fas fa-home'},
                {'nome': 'Saúde', 'tipo': 'despesa', 'cor': '#e83e8c', 'icone': 'fas fa-heartbeat'},
                {'nome': 'Educação', 'tipo': 'despesa', 'cor': '#20c997', 'icone': 'fas fa-graduation-cap'},
                {'nome': 'Lazer', 'tipo': 'despesa', 'cor': '#6c757d', 'icone': 'fas fa-gamepad'},
            ]
            for cat in categorias_padrao:
                Categoria.objects.create(usuario=user, **cat)
            
            # Criar conta padrão
            Conta.objects.create(
                usuario=user,
                nome='Conta Principal',
                tipo='corrente',
                saldo_inicial=0,
                cor='#007bff',
                icone='fas fa-wallet'
            )
            
            messages.success(request, 'Conta criada com sucesso! Faça login para continuar.')
            return redirect('login')
    else:
        form = UserRegistrationForm()
    
    return render(request, 'registration/register.html', {'form': form})

@login_required
def dashboard(request):
    # Obter configurações do usuário
    configuracao, created = Configuracao.objects.get_or_create(usuario=request.user)
    
    # Verificar tipo de dashboard solicitado (prioridade para parâmetro GET)
    dashboard_type = request.GET.get('type', configuracao.dashboard_tipo)
    
    # Se for dashboard clássico, renderizar template diferente
    if dashboard_type == 'classico':
        return dashboard_classic(request)
    
    # Dashboard moderno (padrão)
    return dashboard_responsive(request)

@login_required
def dashboard_responsive(request):
    # Dados básicos do mês atual
    hoje = timezone.now()
    mes_atual = hoje.month
    ano_atual = hoje.year
    
    # Configuração do usuário
    configuracao, _ = Configuracao.objects.get_or_create(usuario=request.user)
    tema_escuro = configuracao.tema_escuro
    dashboard_animations = configuracao.dashboard_animations
    dashboard_dragdrop = configuracao.dashboard_dragdrop
    dashboard_refresh = configuracao.dashboard_refresh
    dashboard_tema = configuracao.dashboard_tema
    dashboard_layout = configuracao.dashboard_layout
    
    # Receitas e despesas do mês atual
    receitas_mes = Receita.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0
    
    despesas_mes = Despesa.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0
    
    saldo_mes = receitas_mes - despesas_mes
    
    # Contadores
    receitas_count = Receita.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        ativo=True
    ).count()
    
    despesas_count = Despesa.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        ativo=True
    ).count()
    
    # Metas
    metas_ativas = Meta.objects.filter(usuario=request.user, ativo=True)
    metas_ativas_count = metas_ativas.count()
    metas_total_count = Meta.objects.filter(usuario=request.user).count()
    metas_concluidas_count = metas_ativas.filter(valor_atual__gte=F('valor_meta')).count()
    
    # Cálculo de tendências (comparação com mês anterior)
    mes_anterior = hoje.replace(day=1) - timedelta(days=1)
    receitas_mes_anterior = Receita.objects.filter(
        usuario=request.user,
        data__month=mes_anterior.month,
        data__year=mes_anterior.year,
        ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0
    
    despesas_mes_anterior = Despesa.objects.filter(
        usuario=request.user,
        data__month=mes_anterior.month,
        data__year=mes_anterior.year,
        ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0
    
    saldo_mes_anterior = receitas_mes_anterior - despesas_mes_anterior
    
    # Cálculo de percentuais de tendência
    receitas_trend = ((receitas_mes - receitas_mes_anterior) / receitas_mes_anterior * 100) if receitas_mes_anterior > 0 else 0
    despesas_trend = ((despesas_mes - despesas_mes_anterior) / despesas_mes_anterior * 100) if despesas_mes_anterior > 0 else 0
    saldo_trend = ((saldo_mes - saldo_mes_anterior) / abs(saldo_mes_anterior) * 100) if saldo_mes_anterior != 0 else 0
    
    # Análise de tendências
    receitas_tendencia = 'crescendo' if receitas_trend > 5 else 'decrescendo' if receitas_trend < -5 else 'estavel'
    despesas_tendencia = 'crescendo' if despesas_trend > 5 else 'decrescendo' if despesas_trend < -5 else 'estavel'
    
    # Previsões baseadas na média dos últimos 3 meses
    previsao_receitas = Receita.objects.filter(
        usuario=request.user,
        data__gte=hoje - timedelta(days=90),
        ativo=True
    ).aggregate(avg=Avg('valor'))['avg'] or 0
    
    previsao_despesas = Despesa.objects.filter(
        usuario=request.user,
        data__gte=hoje - timedelta(days=90),
        ativo=True
    ).aggregate(avg=Avg('valor'))['avg'] or 0
    
    previsao_receitas = Decimal(previsao_receitas or 0)
    previsao_despesas = Decimal(previsao_despesas or 0)
    
    previsao_proximo_mes = previsao_despesas * Decimal('1.1')  # 10% de sazonalidade
    previsao_trimestre = previsao_despesas * Decimal('3') * Decimal('1.05')  # 5% de crescimento trimestral
    previsao_ano = previsao_despesas * Decimal('12') * Decimal('1.15')  # 15% de crescimento anual
    
    # Dados para gráficos
    labels_evolucao = []
    dados_receitas = []
    dados_despesas = []
    dados_saldo = []
    
    # Últimos 6 meses
    for i in range(5, -1, -1):
        data = hoje - timedelta(days=30*i)
        mes = data.month
        ano = data.year
        
        receitas = Receita.objects.filter(
            usuario=request.user,
            data__month=mes,
            data__year=ano,
            ativo=True
        ).aggregate(total=Sum('valor'))['total'] or 0
        
        despesas = Despesa.objects.filter(
            usuario=request.user,
            data__month=mes,
            data__year=ano,
            ativo=True
        ).aggregate(total=Sum('valor'))['total'] or 0
        
        saldo = receitas - despesas
        
        labels_evolucao.append(data.strftime('%b/%Y'))
        dados_receitas.append(float(receitas))
        dados_despesas.append(float(despesas))
        dados_saldo.append(float(saldo))
    
    # Dados para gráfico de categorias
    categorias_despesas = Despesa.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        ativo=True
    ).values('categoria__nome', 'categoria__cor').annotate(
        total=Sum('valor')
    ).order_by('-total')[:8]
    
    labels_categorias = [cat['categoria__nome'] for cat in categorias_despesas]
    dados_categorias = [float(cat['total']) for cat in categorias_despesas]
    cores_categorias = [cat['categoria__cor'] or '#007bff' for cat in categorias_despesas]
    
    # Cartões de crédito
    cartoes_credito = CartaoCredito.objects.filter(usuario=request.user, ativo=True)
    total_limite_cartoes = cartoes_credito.aggregate(total=Sum('limite_total'))['total'] or 0
    total_utilizado_cartoes = sum(cartao.limite_utilizado for cartao in cartoes_credito)
    total_disponivel_cartoes = total_limite_cartoes - total_utilizado_cartoes
    percentual_utilizacao = (total_utilizado_cartoes / total_limite_cartoes * 100) if total_limite_cartoes > 0 else 0
    
    # Despesas no cartão no mês atual
    despesas_cartao_mes = Despesa.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        cartao__isnull=False,
        ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0
    
    # Alertas e notificações
    alertas = []
    if saldo_mes < 0:
        alertas.append({
            'tipo': 'danger',
            'titulo': 'Saldo Negativo',
            'mensagem': f'Seu saldo este mês está negativo em R$ {abs(saldo_mes):.2f}',
            'data': hoje
        })
    if receitas_mes > 0 and despesas_mes > receitas_mes * Decimal('0.9'):
        alertas.append({
            'tipo': 'warning',
            'titulo': 'Despesas Elevadas',
            'mensagem': 'Suas despesas estão consumindo mais de 90% das suas receitas',
            'data': hoje
        })
    metas_vencendo = Meta.objects.filter(
        usuario=request.user,
        ativo=True,
        data_fim__lte=hoje.date() + timedelta(days=30),
        data_fim__gt=hoje.date()
    )
    for meta in metas_vencendo:
        percentual = (meta.valor_atual / meta.valor_meta * 100) if meta.valor_meta > 0 else 0
        dias_restantes = (meta.data_fim - hoje.date()).days
        if percentual < 80:
            alertas.append({
                'tipo': 'warning',
                'titulo': f'Meta: {meta.titulo}',
                'mensagem': f'Meta vence em {dias_restantes} dias. Progresso: {percentual:.1f}%',
                'data': hoje
            })
    
    # Metas em destaque (top 3)
    metas_destaque = metas_ativas.annotate(
        percentual=Case(
            When(valor_meta__gt=0, then=F('valor_atual') * Decimal('100') / F('valor_meta')),
            default=0,
            output_field=DecimalField(max_digits=10, decimal_places=2)
        )
    ).order_by('-percentual')[:3]
    
    # Transações recentes (receitas, despesas e transferências)
    receitas_recentes = Receita.objects.filter(
        usuario=request.user,
        ativo=True
    ).select_related('categoria', 'conta').order_by('-data')[:5]
    despesas_recentes = Despesa.objects.filter(
        usuario=request.user,
        ativo=True
    ).select_related('categoria', 'conta').order_by('-data')[:5]
    transferencias_recentes = Transferencia.objects.filter(
        usuario=request.user,
        ativo=True
    ).select_related('conta_origem', 'conta_destino').order_by('-data')[:5]

    transacoes_recentes = []
    for receita in receitas_recentes:
        transacoes_recentes.append({
            'data': receita.data,
            'descricao': receita.descricao,
            'categoria': receita.categoria,
            'conta': receita.conta,
            'valor': receita.valor,
            'tipo': 'receita'
        })
    for despesa in despesas_recentes:
        transacoes_recentes.append({
            'data': despesa.data,
            'descricao': despesa.descricao,
            'categoria': despesa.categoria,
            'conta': despesa.conta,
            'valor': despesa.valor,
            'tipo': 'despesa'
        })
    for transferencia in transferencias_recentes:
        transacoes_recentes.append({
            'data': transferencia.data,
            'descricao': transferencia.descricao,
            'categoria': None,
            'conta': transferencia.conta_origem,
            'conta_destino': transferencia.conta_destino,
            'valor': transferencia.valor,
            'tipo': 'transferencia'
        })
    transacoes_recentes.sort(key=lambda x: x['data'], reverse=True)
    transacoes_recentes = transacoes_recentes[:10]
    
    context = {
        'receitas_mes': receitas_mes,
        'despesas_mes': despesas_mes,
        'saldo_mes': saldo_mes,
        'receitas_count': receitas_count,
        'despesas_count': despesas_count,
        'receitas_trend': receitas_trend,
        'despesas_trend': despesas_trend,
        'saldo_trend': saldo_trend,
        'receitas_tendencia': receitas_tendencia,
        'despesas_tendencia': despesas_tendencia,
        'metas_ativas_count': metas_ativas_count,
        'metas_total_count': metas_total_count,
        'metas_concluidas_count': metas_concluidas_count,
        'previsao_proximo_mes': previsao_proximo_mes,
        'previsao_trimestre': previsao_trimestre,
        'previsao_ano': previsao_ano,
        'labels_evolucao': json.dumps(labels_evolucao),
        'dados_receitas': json.dumps(dados_receitas),
        'dados_despesas': json.dumps(dados_despesas),
        'dados_saldo': json.dumps(dados_saldo),
        'labels_categorias': json.dumps(labels_categorias),
        'dados_categorias': json.dumps(dados_categorias),
        'cores_categorias': json.dumps(cores_categorias),
        'cartoes_credito': cartoes_credito,
        'total_limite_cartoes': total_limite_cartoes,
        'total_utilizado_cartoes': total_utilizado_cartoes,
        'total_disponivel_cartoes': total_disponivel_cartoes,
        'percentual_utilizacao': percentual_utilizacao,
        'despesas_cartao_mes': despesas_cartao_mes,
        'cartoes_vencendo': [],
        'alertas': alertas,
        'metas_destaque': metas_destaque,
        'transacoes_recentes': transacoes_recentes,
        'tema_escuro': tema_escuro,
        'dashboard_animations': dashboard_animations,
        'dashboard_dragdrop': dashboard_dragdrop,
        'dashboard_refresh': dashboard_refresh,
        'dashboard_tema': dashboard_tema,
        'dashboard_layout': dashboard_layout,
    }
    
    return render(request, 'core/dashboard.html', context)

@login_required
def dashboard_classic(request):
    hoje = timezone.now().date()
    mes_atual = hoje.month
    ano_atual = hoje.year

    # Dados financeiros principais
    receitas_mes = Receita.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0

    despesas_mes = Despesa.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0

    saldo_mes = receitas_mes - despesas_mes

    receitas_count = Receita.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        ativo=True
    ).count()

    despesas_count = Despesa.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        ativo=True
    ).count()

    metas_ativas = Meta.objects.filter(usuario=request.user, ativo=True)
    metas_ativas_count = metas_ativas.count()
    metas_total_count = Meta.objects.filter(usuario=request.user).count()
    metas_concluidas_count = metas_ativas.filter(valor_atual__gte=F('valor_meta')).count()

    mes_anterior = hoje.replace(day=1) - timedelta(days=1)
    receitas_mes_anterior = Receita.objects.filter(
        usuario=request.user,
        data__month=mes_anterior.month,
        data__year=mes_anterior.year,
        ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0

    despesas_mes_anterior = Despesa.objects.filter(
        usuario=request.user,
        data__month=mes_anterior.month,
        data__year=mes_anterior.year,
        ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0

    saldo_mes_anterior = receitas_mes_anterior - despesas_mes_anterior

    receitas_trend = ((receitas_mes - receitas_mes_anterior) / receitas_mes_anterior * 100) if receitas_mes_anterior > 0 else 0
    despesas_trend = ((despesas_mes - despesas_mes_anterior) / despesas_mes_anterior * 100) if despesas_mes_anterior > 0 else 0
    saldo_trend = ((saldo_mes - saldo_mes_anterior) / abs(saldo_mes_anterior) * 100) if saldo_mes_anterior != 0 else 0

    receitas_tendencia = 'crescendo' if receitas_trend > 5 else 'decrescendo' if receitas_trend < -5 else 'estavel'
    despesas_tendencia = 'crescendo' if despesas_trend > 5 else 'decrescendo' if despesas_trend < -5 else 'estavel'

    previsao_receitas = Receita.objects.filter(
        usuario=request.user,
        data__gte=hoje - timedelta(days=90),
        ativo=True
    ).aggregate(avg=Avg('valor'))['avg'] or 0

    previsao_despesas = Despesa.objects.filter(
        usuario=request.user,
        data__gte=hoje - timedelta(days=90),
        ativo=True
    ).aggregate(avg=Avg('valor'))['avg'] or 0

    previsao_receitas = Decimal(previsao_receitas or 0)
    previsao_despesas = Decimal(previsao_despesas or 0)

    previsao_proximo_mes = previsao_despesas * Decimal('1.1')
    previsao_trimestre = previsao_despesas * Decimal('3') * Decimal('1.05')
    previsao_ano = previsao_despesas * Decimal('12') * Decimal('1.15')

    labels_evolucao = []
    dados_receitas = []
    dados_despesas = []
    dados_saldo = []
    for i in range(5, -1, -1):
        data = hoje - timedelta(days=30*i)
        mes = data.month
        ano = data.year
        receitas = Receita.objects.filter(
            usuario=request.user,
            data__month=mes,
            data__year=ano,
            ativo=True
        ).aggregate(total=Sum('valor'))['total'] or 0
        despesas = Despesa.objects.filter(
            usuario=request.user,
            data__month=mes,
            data__year=ano,
            ativo=True
        ).aggregate(total=Sum('valor'))['total'] or 0
        saldo = receitas - despesas
        labels_evolucao.append(data.strftime('%b/%Y'))
        dados_receitas.append(float(receitas))
        dados_despesas.append(float(despesas))
        dados_saldo.append(float(saldo))

    categorias_despesas = Despesa.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        ativo=True
    ).values('categoria__nome', 'categoria__cor').annotate(
        total=Sum('valor')
    ).order_by('-total')[:8]
    labels_categorias = [cat['categoria__nome'] for cat in categorias_despesas]
    dados_categorias = [float(cat['total']) for cat in categorias_despesas]
    cores_categorias = [cat['categoria__cor'] or '#007bff' for cat in categorias_despesas]

    # Cartões de crédito
    cartoes_credito = CartaoCredito.objects.filter(usuario=request.user, ativo=True)
    total_limite_cartoes = cartoes_credito.aggregate(total=Sum('limite_total'))['total'] or 0
    total_utilizado_cartoes = sum(cartao.limite_utilizado for cartao in cartoes_credito)
    total_disponivel_cartoes = total_limite_cartoes - total_utilizado_cartoes
    percentual_utilizacao = (total_utilizado_cartoes / total_limite_cartoes * 100) if total_limite_cartoes > 0 else 0
    despesas_cartao_mes = Despesa.objects.filter(
        usuario=request.user,
        data__month=mes_atual,
        data__year=ano_atual,
        cartao__isnull=False,
        ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0

    # Cartões próximos do vencimento (próximos 7 dias)
    cartoes_vencendo = []
    for cartao in cartoes_credito:
        dias_ate_vencimento = (cartao.data_vencimento - hoje).days
        if 0 <= dias_ate_vencimento <= 7:
            cartoes_vencendo.append({
                'nome': cartao.nome,
                'data_vencimento': cartao.data_vencimento,
                'dias_restantes': dias_ate_vencimento,
                'valor_fatura': cartao.limite_utilizado
            })

    # Notificações reais do usuário (últimas 5 não lidas)
    notificacoes_recentes = Notificacao.objects.filter(
        usuario=request.user,
        lida=False
    ).order_by('-data_criacao')[:5]

    # Alertas inteligentes
    alertas = []
    if saldo_mes < 0:
        alertas.append({
            'tipo': 'danger',
            'titulo': 'Saldo Negativo',
            'mensagem': f'Seu saldo este mês está negativo em R$ {abs(saldo_mes):.2f}',
            'data': hoje
        })
    if receitas_mes > 0 and despesas_mes > receitas_mes * Decimal('0.9'):
        alertas.append({
            'tipo': 'warning',
            'titulo': 'Despesas Elevadas',
            'mensagem': 'Suas despesas estão consumindo mais de 90% das suas receitas',
            'data': hoje
        })
    metas_vencendo = Meta.objects.filter(
        usuario=request.user,
        ativo=True,
        data_fim__lte=hoje + timedelta(days=30),
        data_fim__gt=hoje
    )
    for meta in metas_vencendo:
        percentual = (meta.valor_atual / meta.valor_meta * 100) if meta.valor_meta > 0 else 0
        dias_restantes = (meta.data_fim - hoje).days
        if percentual < 80:
            alertas.append({
                'tipo': 'warning',
                'titulo': f'Meta: {meta.titulo}',
                'mensagem': f'Meta vence em {dias_restantes} dias. Progresso: {percentual:.1f}%',
                'data': hoje
            })
    # Adicionar notificações aos alertas
    for notif in notificacoes_recentes:
        alertas.append({
            'tipo': notif.tipo,
            'titulo': notif.titulo,
            'mensagem': notif.mensagem,
            'data': notif.data_criacao.date(),
            'link': notif.link,
            'icone': notif.icone
        })

    metas_destaque = metas_ativas.annotate(
        percentual=Case(
            When(valor_meta__gt=0, then=F('valor_atual') * Decimal('100') / F('valor_meta')),
            default=0,
            output_field=DecimalField(max_digits=10, decimal_places=2)
        )
    ).order_by('-percentual')[:3]

    # Transações recentes (receitas, despesas e transferências)
    receitas_recentes = Receita.objects.filter(
        usuario=request.user,
        ativo=True
    ).select_related('categoria', 'conta').order_by('-data')[:5]
    despesas_recentes = Despesa.objects.filter(
        usuario=request.user,
        ativo=True
    ).select_related('categoria', 'conta').order_by('-data')[:5]
    transferencias_recentes = Transferencia.objects.filter(
        usuario=request.user,
        ativo=True
    ).select_related('conta_origem', 'conta_destino').order_by('-data')[:5]

    transacoes_recentes = []
    for receita in receitas_recentes:
        transacoes_recentes.append({
            'data': receita.data,
            'descricao': receita.descricao,
            'categoria': receita.categoria,
            'conta': receita.conta,
            'valor': receita.valor,
            'tipo': 'receita'
        })
    for despesa in despesas_recentes:
        transacoes_recentes.append({
            'data': despesa.data,
            'descricao': despesa.descricao,
            'categoria': despesa.categoria,
            'conta': despesa.conta,
            'valor': despesa.valor,
            'tipo': 'despesa'
        })
    for transferencia in transferencias_recentes:
        transacoes_recentes.append({
            'data': transferencia.data,
            'descricao': transferencia.descricao,
            'categoria': None,
            'conta': transferencia.conta_origem,
            'conta_destino': transferencia.conta_destino,
            'valor': transferencia.valor,
            'tipo': 'transferencia'
        })
    transacoes_recentes.sort(key=lambda x: x['data'], reverse=True)
    transacoes_recentes = transacoes_recentes[:10]

    context = {
        'receitas_mes': receitas_mes,
        'despesas_mes': despesas_mes,
        'saldo_mes': saldo_mes,
        'receitas_count': receitas_count,
        'despesas_count': despesas_count,
        'receitas_trend': receitas_trend,
        'despesas_trend': despesas_trend,
        'saldo_trend': saldo_trend,
        'receitas_tendencia': receitas_tendencia,
        'despesas_tendencia': despesas_tendencia,
        'metas_ativas_count': metas_ativas_count,
        'metas_total_count': metas_total_count,
        'metas_concluidas_count': metas_concluidas_count,
        'previsao_proximo_mes': previsao_proximo_mes,
        'previsao_trimestre': previsao_trimestre,
        'previsao_ano': previsao_ano,
        'labels_evolucao': json.dumps(labels_evolucao),
        'dados_evolucao_receitas': json.dumps(dados_receitas),
        'dados_evolucao_despesas': json.dumps(dados_despesas),
        'dados_evolucao_saldo': json.dumps(dados_saldo),
        'labels_categorias': json.dumps(labels_categorias),
        'dados_categorias': json.dumps(dados_categorias),
        'cores_categorias': json.dumps(cores_categorias),
        'cartoes_credito': cartoes_credito,
        'total_limite_cartoes': total_limite_cartoes,
        'total_utilizado_cartoes': total_utilizado_cartoes,
        'total_disponivel_cartoes': total_disponivel_cartoes,
        'percentual_utilizacao': percentual_utilizacao,
        'despesas_cartao_mes': despesas_cartao_mes,
        'cartoes_vencendo': cartoes_vencendo,
        'alertas': alertas,
        'notificacoes_recentes': notificacoes_recentes,
        'metas_destaque': metas_destaque,
        'transacoes_recentes': transacoes_recentes,
    }
    return render(request, 'core/dashboard_classic.html', context)

# Views para Categorias
@login_required
def categoria_list(request):
    categorias = Categoria.objects.filter(usuario=request.user, ativo=True)
    return render(request, 'core/categorias_list.html', {'categorias': categorias})

@login_required
def categoria_create(request):
    if request.method == 'POST':
        form = CategoriaForm(request.POST, user=request.user)
        if form.is_valid():
            categoria = form.save(commit=False)
            categoria.usuario = request.user
            categoria.save()
            messages.success(request, 'Categoria criada com sucesso!')
            return redirect('core:categoria_list')
    else:
        form = CategoriaForm(user=request.user)
    
    return render(request, 'core/categoria_form.html', {'form': form, 'title': 'Nova Categoria'})

@login_required
def categoria_update(request, pk):
    categoria = get_object_or_404(Categoria, pk=pk, usuario=request.user)
    if request.method == 'POST':
        form = CategoriaForm(request.POST, instance=categoria, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Categoria atualizada com sucesso!')
            return redirect('core:categoria_list')
    else:
        form = CategoriaForm(instance=categoria, user=request.user)
    
    return render(request, 'core/categoria_form.html', {'form': form, 'title': 'Editar Categoria'})

@login_required
def categoria_delete(request, pk):
    categoria = get_object_or_404(Categoria, pk=pk, usuario=request.user)
    if request.method == 'POST':
        categoria.ativo = False
        categoria.save()
        messages.success(request, 'Categoria removida com sucesso!')
        return redirect('core:categoria_list')
    
    return render(request, 'core/categoria_confirmar_remocao.html', {'categoria': categoria})

@csrf_exempt
@require_POST
@login_required
def categoria_atualizar_cor(request, pk):
    import json
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Tentando atualizar cor da categoria {pk}")
        categoria = get_object_or_404(Categoria, pk=pk, usuario=request.user)
        data = json.loads(request.body)
        nova_cor = data.get('cor')
        logger.info(f"Nova cor recebida: {nova_cor}")
        
        if nova_cor and isinstance(nova_cor, str) and nova_cor.startswith('#'):
            categoria.cor = nova_cor
            categoria.save()
            logger.info(f"Cor da categoria {pk} atualizada para {nova_cor}")
            return JsonResponse({'success': True, 'cor': nova_cor})
        else:
            logger.error(f"Cor inválida recebida: {nova_cor}")
            return JsonResponse({'success': False, 'error': 'Cor inválida'}, status=400)
    except Exception as e:
        logger.error(f"Erro ao atualizar cor da categoria {pk}: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# Views para Contas
@login_required
def conta_list(request):
    contas = Conta.objects.filter(usuario=request.user, ativo=True)
    for conta in contas:
        conta.atualizar_saldo()
    return render(request, 'core/contas_list.html', {'contas': contas})

@login_required
def conta_create(request):
    if request.method == 'POST':
        form = ContaForm(request.POST, user=request.user)
        if form.is_valid():
            conta = form.save(commit=False)
            conta.usuario = request.user
            conta.save()
            messages.success(request, 'Conta criada com sucesso!')
            return redirect('core:conta_list')
    else:
        form = ContaForm(user=request.user)
    
    return render(request, 'core/conta_form.html', {'form': form, 'title': 'Nova Conta'})

@login_required
def conta_update(request, pk):
    conta = get_object_or_404(Conta, pk=pk, usuario=request.user)
    if request.method == 'POST':
        form = ContaForm(request.POST, instance=conta, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Conta atualizada com sucesso!')
            return redirect('core:conta_list')
    else:
        form = ContaForm(instance=conta, user=request.user)
    
    return render(request, 'core/conta_form.html', {'form': form, 'title': 'Editar Conta'})

@login_required
def conta_delete(request, pk):
    conta = get_object_or_404(Conta, pk=pk, usuario=request.user)
    if request.method == 'POST':
        conta.ativo = False
        conta.save()
        messages.success(request, 'Conta removida com sucesso!')
        return redirect('core:conta_list')
    
    return render(request, 'core/conta_confirmar_remocao.html', {'conta': conta})

@csrf_exempt
@require_POST
@login_required
def conta_atualizar_cor(request, pk):
    import json
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Tentando atualizar cor da conta {pk}")
        conta = get_object_or_404(Conta, pk=pk, usuario=request.user)
        data = json.loads(request.body)
        nova_cor = data.get('cor')
        logger.info(f"Nova cor recebida: {nova_cor}")
        
        if nova_cor and isinstance(nova_cor, str) and nova_cor.startswith('#'):
            conta.cor = nova_cor
            conta.save()
            logger.info(f"Cor da conta {pk} atualizada para {nova_cor}")
            return JsonResponse({'success': True, 'cor': nova_cor})
        else:
            logger.error(f"Cor inválida recebida: {nova_cor}")
            return JsonResponse({'success': False, 'error': 'Cor inválida'}, status=400)
    except Exception as e:
        logger.error(f"Erro ao atualizar cor da conta {pk}: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)}, status=500)

# Views para Receitas
@login_required
def receita_list(request):
    receitas = Receita.objects.filter(usuario=request.user, ativo=True).order_by('-data')
    form = ReceitaFiltroForm(request.GET or None, user=request.user)
    if form.is_valid():
        data_inicial = form.cleaned_data.get('data_inicial')
        data_final = form.cleaned_data.get('data_final')
        categoria = form.cleaned_data.get('categoria')
        conta = form.cleaned_data.get('conta')
        valor_min = form.cleaned_data.get('valor_min')
        valor_max = form.cleaned_data.get('valor_max')
        recorrente = form.cleaned_data.get('recorrente')
        busca_texto = form.cleaned_data.get('busca_texto')
        if data_inicial:
            receitas = receitas.filter(data__gte=data_inicial)
        if data_final:
            receitas = receitas.filter(data__lte=data_final)
        if categoria:
            receitas = receitas.filter(categoria=categoria)
        if conta:
            receitas = receitas.filter(conta=conta)
        if valor_min is not None:
            receitas = receitas.filter(valor__gte=valor_min)
        if valor_max is not None:
            receitas = receitas.filter(valor__lte=valor_max)
        if recorrente is not None:
            receitas = receitas.filter(recorrente=recorrente)
        if busca_texto:
            receitas = receitas.filter(descricao__icontains=busca_texto)
    
    return render(request, 'core/receitas_list.html', {
        'receitas': receitas, 
        'form_filtro': form
    })

@login_required
def receita_create(request):
    if request.method == 'POST':
        form = ReceitaForm(request.POST, user=request.user)
        if form.is_valid():
            receita = form.save(commit=False)
            receita.usuario = request.user
            receita.save()
            messages.success(request, 'Receita registrada com sucesso!')
            return redirect('core:receita_list')
    else:
        form = ReceitaForm(user=request.user)
    
    return render(request, 'core/receita_form.html', {'form': form, 'title': 'Nova Receita'})

@login_required
def receita_update(request, pk):
    receita = get_object_or_404(Receita, pk=pk, usuario=request.user)
    if request.method == 'POST':
        form = ReceitaForm(request.POST, instance=receita, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Receita atualizada com sucesso!')
            return redirect('core:receita_list')
    else:
        form = ReceitaForm(instance=receita, user=request.user)
    
    return render(request, 'core/receita_form.html', {'form': form, 'title': 'Editar Receita'})

@login_required
def receita_delete(request, pk):
    receita = get_object_or_404(Receita, pk=pk, usuario=request.user)
    if request.method == 'POST':
        receita.delete()
        messages.success(request, 'Receita removida com sucesso!')
        return redirect('core:receita_list')
    return render(request, 'core/receita_confirmar_remocao.html', {'receita': receita})

# Views para Despesas
@login_required
def despesa_list(request):
    despesas = Despesa.objects.filter(usuario=request.user, ativo=True).order_by('-data')
    form = DespesaFiltroForm(request.GET or None, user=request.user)
    if form.is_valid():
        data_inicial = form.cleaned_data.get('data_inicial')
        data_final = form.cleaned_data.get('data_final')
        categoria = form.cleaned_data.get('categoria')
        conta = form.cleaned_data.get('conta')
        valor_min = form.cleaned_data.get('valor_min')
        valor_max = form.cleaned_data.get('valor_max')
        recorrente = form.cleaned_data.get('recorrente')
        busca_texto = form.cleaned_data.get('busca_texto')
        if data_inicial:
            despesas = despesas.filter(data__gte=data_inicial)
        if data_final:
            despesas = despesas.filter(data__lte=data_final)
        if categoria:
            despesas = despesas.filter(categoria=categoria)
        if conta:
            despesas = despesas.filter(conta=conta)
        if valor_min is not None:
            despesas = despesas.filter(valor__gte=valor_min)
        if valor_max is not None:
            despesas = despesas.filter(valor__lte=valor_max)
        if recorrente is not None:
            despesas = despesas.filter(recorrente=recorrente)
        if busca_texto:
            despesas = despesas.filter(descricao__icontains=busca_texto)
    
    return render(request, 'core/despesas_list.html', {
        'despesas': despesas, 
        'form_filtro': form
    })

@login_required
def despesa_create(request):
    if request.method == 'POST':
        form = DespesaForm(request.POST, user=request.user)
        if form.is_valid():
            despesa = form.save(commit=False)
            despesa.usuario = request.user
            despesa.save()
            messages.success(request, 'Despesa registrada com sucesso!')
            return redirect('core:despesa_list')
    else:
        form = DespesaForm(user=request.user)
    
    return render(request, 'core/despesa_form.html', {'form': form, 'title': 'Nova Despesa'})

@login_required
def despesa_update(request, pk):
    despesa = get_object_or_404(Despesa, pk=pk, usuario=request.user)
    if request.method == 'POST':
        form = DespesaForm(request.POST, instance=despesa, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Despesa atualizada com sucesso!')
            return redirect('core:despesa_list')
    else:
        form = DespesaForm(instance=despesa, user=request.user)
    
    return render(request, 'core/despesa_form.html', {'form': form, 'title': 'Editar Despesa'})

@login_required
def despesa_delete(request, pk):
    despesa = get_object_or_404(Despesa, pk=pk, usuario=request.user)
    if request.method == 'POST':
        despesa.delete()
        messages.success(request, 'Despesa removida com sucesso!')
        return redirect('core:despesa_list')
    return render(request, 'core/despesa_confirmar_remocao.html', {'despesa': despesa})

@login_required
def despesa_edit(request, pk):
    despesa = get_object_or_404(Despesa, pk=pk, usuario=request.user)
    if request.method == 'POST':
        form = DespesaForm(request.POST, instance=despesa, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Despesa atualizada com sucesso!')
            return redirect('core:despesa_list')
    else:
        form = DespesaForm(instance=despesa, user=request.user)
    
    return render(request, 'core/despesa_form.html', {'form': form, 'title': 'Editar Despesa'})

# Views para Transferências
@login_required
def transferencia_list(request):
    transferencias = Transferencia.objects.filter(usuario=request.user, ativo=True).order_by('-data')
    
    # Aplicar filtros se fornecidos
    conta_origem = request.GET.get('conta_origem')
    conta_destino = request.GET.get('conta_destino')
    data_inicio = request.GET.get('data_inicio')
    data_fim = request.GET.get('data_fim')
    
    if conta_origem:
        transferencias = transferencias.filter(conta_origem_id=conta_origem)
    if conta_destino:
        transferencias = transferencias.filter(conta_destino_id=conta_destino)
    if data_inicio:
        transferencias = transferencias.filter(data__gte=data_inicio)
    if data_fim:
        transferencias = transferencias.filter(data__lte=data_fim)
    
    # Adicionar contas para os filtros
    contas = Conta.objects.filter(usuario=request.user, ativo=True).order_by('nome')
    
    return render(request, 'core/transferencias_list.html', {
        'transferencias': transferencias,
        'contas': contas
    })

@login_required
def transferencia_create(request):
    if request.method == 'POST':
        form = TransferenciaForm(request.POST, user=request.user)
        if form.is_valid():
            transferencia = form.save(commit=False)
            transferencia.usuario = request.user
            transferencia.save()
            messages.success(request, 'Transferência registrada com sucesso!')
            return redirect('core:transferencia_list')
    else:
        form = TransferenciaForm(user=request.user)
    
    return render(request, 'core/transferencia_form.html', {'form': form, 'title': 'Nova Transferência'})

@login_required
def transferencia_update(request, pk):
    transferencia = get_object_or_404(Transferencia, pk=pk, usuario=request.user)
    if request.method == 'POST':
        form = TransferenciaForm(request.POST, instance=transferencia, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Transferência atualizada com sucesso!')
            return redirect('core:transferencia_list')
    else:
        form = TransferenciaForm(instance=transferencia, user=request.user)
    
    return render(request, 'core/transferencia_form.html', {'form': form, 'title': 'Editar Transferência'})

@login_required
def transferencia_delete(request, pk):
    transferencia = get_object_or_404(Transferencia, pk=pk, usuario=request.user)
    if request.method == 'POST':
        transferencia.delete()
        messages.success(request, 'Transferência removida com sucesso!')
        return redirect('core:transferencia_list')
    return render(request, 'core/transferencia_confirmar_remocao.html', {'transferencia': transferencia})

# Views para Metas
@login_required
def meta_list(request):
    metas = Meta.objects.filter(usuario=request.user, ativo=True).order_by('data_fim')
    return render(request, 'core/metas_list.html', {'metas': metas})

@login_required
def meta_create(request):
    if request.method == 'POST':
        form = MetaForm(request.POST, user=request.user)
        if form.is_valid():
            meta = form.save(commit=False)
            meta.usuario = request.user
            meta.save()
            messages.success(request, 'Meta criada com sucesso!')
            return redirect('core:meta_list')
    else:
        form = MetaForm(user=request.user)
    
    return render(request, 'core/meta_form.html', {'form': form, 'title': 'Nova Meta'})

@login_required
def meta_update(request, pk):
    meta = get_object_or_404(Meta, pk=pk, usuario=request.user)
    if request.method == 'POST':
        form = MetaForm(request.POST, instance=meta, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Meta atualizada com sucesso!')
            return redirect('core:meta_list')
    else:
        form = MetaForm(instance=meta, user=request.user)
    
    return render(request, 'core/meta_form.html', {'form': form, 'title': 'Editar Meta'})

@login_required
def meta_delete(request, pk):
    meta = get_object_or_404(Meta, pk=pk, usuario=request.user)
    if request.method == 'POST':
        meta.ativo = False
        meta.save()
        messages.success(request, 'Meta removida com sucesso!')
        return redirect('core:meta_list')
    
    return render(request, 'core/meta_confirmar_remocao.html', {'meta': meta})

# Views para Relatórios
@login_required
def relatorio_financeiro(request):
    form = FiltroRelatorioForm(request.GET, user=request.user)
    
    # Definir período padrão
    hoje = timezone.now().date()
    data_inicio = hoje - timedelta(days=30)
    data_fim = hoje
    
    if form.is_valid():
        periodo = form.cleaned_data.get('periodo')
        data_inicio_form = form.cleaned_data.get('data_inicio')
        data_fim_form = form.cleaned_data.get('data_fim')
        categoria = form.cleaned_data.get('categoria')
        conta = form.cleaned_data.get('conta')
        
        # Definir período
        if periodo == '7d':
            data_inicio = hoje - timedelta(days=7)
            data_fim = hoje
        elif periodo == '30d':
            data_inicio = hoje - timedelta(days=30)
            data_fim = hoje
        elif periodo == '90d':
            data_inicio = hoje - timedelta(days=90)
            data_fim = hoje
        elif periodo == '6m':
            data_inicio = hoje - timedelta(days=180)
            data_fim = hoje
        elif periodo == '1y':
            data_inicio = hoje - timedelta(days=365)
            data_fim = hoje
        elif periodo == 'custom' and data_inicio_form and data_fim_form:
            data_inicio = data_inicio_form
            data_fim = data_fim_form
        else:
            data_inicio = hoje - timedelta(days=30)
            data_fim = hoje
    
    # Filtrar dados
    receitas = Receita.objects.filter(
        usuario=request.user,
        data__gte=data_inicio,
        data__lte=data_fim,
        ativo=True
    )
    despesas = Despesa.objects.filter(
        usuario=request.user,
        data__gte=data_inicio,
        data__lte=data_fim,
        ativo=True
    )
    
    if form.is_valid():
        categoria = form.cleaned_data.get('categoria')
        conta = form.cleaned_data.get('conta')
        
        if categoria:
            receitas = receitas.filter(categoria=categoria)
            despesas = despesas.filter(categoria=categoria)
        
        if conta:
            receitas = receitas.filter(conta=conta)
            despesas = despesas.filter(conta=conta)
    
    # Calcular totais
    total_receitas = receitas.aggregate(total=Sum('valor'))['total'] or 0
    total_despesas = despesas.aggregate(total=Sum('valor'))['total'] or 0
    saldo = total_receitas - total_despesas
    
    # Contadores
    receitas_count = receitas.count()
    despesas_count = despesas.count()
    
    # Metas
    metas_ativas = Meta.objects.filter(usuario=request.user, ativo=True)
    metas_count = Meta.objects.filter(usuario=request.user).count()
    metas_ativas_count = metas_ativas.count()
    
    # Dados por categoria
    receitas_por_categoria = receitas.values('categoria__nome').annotate(
        total=Sum('valor')
    ).order_by('-total')
    
    despesas_por_categoria = despesas.values('categoria__nome').annotate(
        total=Sum('valor')
    ).order_by('-total')
    
    # Dados por conta
    receitas_por_conta = receitas.values('conta__nome').annotate(
        total=Sum('valor')
    ).order_by('-total')
    
    despesas_por_conta = despesas.values('conta__nome').annotate(
        total=Sum('valor')
    ).order_by('-total')
    
    # Top receitas e despesas
    top_receitas = receitas.order_by('-valor')[:10]
    top_despesas = despesas.order_by('-valor')[:10]
    
    # Dados para gráficos
    # Gráfico de Receitas vs Despesas (últimos 6 meses)
    labels_receitas_despesas = []
    dados_receitas = []
    dados_despesas = []
    
    for i in range(5, -1, -1):
        data = hoje - timedelta(days=30*i)
        mes = data.month
        ano = data.year
        
        receitas_mes = Receita.objects.filter(
            usuario=request.user,
            data__month=mes,
            data__year=ano,
            ativo=True
        ).aggregate(total=Sum('valor'))['total'] or 0
        
        despesas_mes = Despesa.objects.filter(
            usuario=request.user,
            data__month=mes,
            data__year=ano,
            ativo=True
        ).aggregate(total=Sum('valor'))['total'] or 0
        
        labels_receitas_despesas.append(data.strftime('%b/%Y'))
        dados_receitas.append(float(receitas_mes))
        dados_despesas.append(float(despesas_mes))
    
    # Gráfico de Categorias
    categorias_despesas = Despesa.objects.filter(
        usuario=request.user,
        data__gte=data_inicio,
        data__lte=data_fim,
        ativo=True
    ).values('categoria__nome', 'categoria__cor').annotate(
        total=Sum('valor')
    ).order_by('-total')[:8]
    
    labels_categorias = [cat['categoria__nome'] for cat in categorias_despesas]
    dados_categorias = [float(cat['total']) for cat in categorias_despesas]
    cores_categorias = [cat['categoria__cor'] or '#007bff' for cat in categorias_despesas]
    
    # Gráfico de Evolução Temporal
    labels_evolucao = []
    dados_evolucao_receitas = []
    dados_evolucao_despesas = []
    dados_evolucao_saldo = []
    
    # Últimos 12 meses
    for i in range(11, -1, -1):
        data = hoje - timedelta(days=30*i)
        mes = data.month
        ano = data.year
        
        receitas_mes = Receita.objects.filter(
            usuario=request.user,
            data__month=mes,
            data__year=ano,
            ativo=True
        ).aggregate(total=Sum('valor'))['total'] or 0
        
        despesas_mes = Despesa.objects.filter(
            usuario=request.user,
            data__month=mes,
            data__year=ano,
            ativo=True
        ).aggregate(total=Sum('valor'))['total'] or 0
        
        saldo_mes = receitas_mes - despesas_mes
        
        labels_evolucao.append(data.strftime('%b/%Y'))
        dados_evolucao_receitas.append(float(receitas_mes))
        dados_evolucao_despesas.append(float(despesas_mes))
        dados_evolucao_saldo.append(float(saldo_mes))
    
    # Filtro de data para gráfico de evolução temporal dos gastos
    evolucao_labels = []
    evolucao_valores = []
    meses_ptbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    hoje = timezone.now().date()
    for i in range(11, -1, -1):
        ano = hoje.year if hoje.month - i > 0 else hoje.year - 1
        mes = (hoje.month - i - 1) % 12 + 1
        evolucao_labels.append(f'{meses_ptbr[mes-1]}/{ano}')
        despesas_mes = Despesa.objects.filter(usuario=request.user, data__year=ano, data__month=mes, ativo=True)
        if data_inicio:
            despesas_mes = despesas_mes.filter(data__gte=data_inicio)
        if data_fim:
            despesas_mes = despesas_mes.filter(data__lte=data_fim)
        evolucao_valores.append(float(despesas_mes.aggregate(total=Sum('valor'))['total'] or 0))
    
    context = {
        'form': form,
        'data_inicio': data_inicio,
        'data_fim': data_fim,
        'total_receitas': total_receitas,
        'total_despesas': total_despesas,
        'saldo': saldo,
        'receitas_count': receitas_count,
        'despesas_count': despesas_count,
        'metas_count': metas_count,
        'metas_ativas_count': metas_ativas_count,
        'receitas_por_categoria': receitas_por_categoria,
        'despesas_por_categoria': despesas_por_categoria,
        'receitas_por_conta': receitas_por_conta,
        'despesas_por_conta': despesas_por_conta,
        'receitas': receitas.order_by('-data'),
        'despesas': despesas.order_by('-data'),
        'top_receitas': top_receitas,
        'top_despesas': top_despesas,
        'labels_receitas_despesas': json.dumps(labels_receitas_despesas),
        'dados_receitas': json.dumps(dados_receitas),
        'dados_despesas': json.dumps(dados_despesas),
        'labels_categorias': json.dumps(labels_categorias),
        'dados_categorias': json.dumps(dados_categorias),
        'cores_categorias': json.dumps(cores_categorias),
        'labels_evolucao': json.dumps(labels_evolucao),
        'dados_evolucao_receitas': json.dumps(dados_evolucao_receitas),
        'dados_evolucao_despesas': json.dumps(dados_evolucao_despesas),
        'dados_evolucao_saldo': json.dumps(dados_evolucao_saldo),
        'evolucao_labels': evolucao_labels,
        'evolucao_valores': evolucao_valores,
    }
    
    return render(request, 'core/relatorio_financeiro.html', context)

# Views para Configurações
@login_required
def configuracoes(request):
    configuracao, created = Configuracao.objects.get_or_create(usuario=request.user)
    
    if request.method == 'POST':
        if 'gerar_dados_ficticios' in request.POST:
            # Executar comando de geração de dados fictícios
            from django.core.management import call_command
            from io import StringIO
            
            data_inicio = request.POST.get('data_inicio')
            data_fim = request.POST.get('data_fim')
            try:
                output = StringIO()
                cmd_kwargs = {'usuario': request.user.username, 'stdout': output}
                if data_inicio:
                    cmd_kwargs['data_inicio'] = data_inicio
                if data_fim:
                    cmd_kwargs['data_fim'] = data_fim
                call_command('gerar_dados_ficticios', **cmd_kwargs)
                messages.success(request, 'Dados fictícios gerados com sucesso!')
            except Exception as e:
                messages.error(request, f'Erro ao gerar dados fictícios: {str(e)}')
            
            return redirect('core:configuracoes')
        
        if 'excluir_dados_ficticios' in request.POST:
            # Excluir dados fictícios do usuário logado (dados de jan a jun/2025)
            Receita.objects.filter(usuario=request.user, data__year=2025).delete()
            Despesa.objects.filter(usuario=request.user, data__year=2025).delete()
            Transferencia.objects.filter(usuario=request.user, data__year=2025).delete()
            Meta.objects.filter(usuario=request.user, data_inicio__year=2025).delete()
            Conta.objects.filter(usuario=request.user, data_criacao__year=2025).delete()
            Categoria.objects.filter(usuario=request.user, data_criacao__year=2025).delete()
            Notificacao.objects.filter(usuario=request.user, data_criacao__year=2025).delete()
            messages.success(request, 'Dados fictícios de 2025 excluídos com sucesso!')
            return redirect('core:configuracoes')
        
        if 'gerar_notificacoes' in request.POST:
            # Gerar notificações de teste para o usuário
            from datetime import datetime, timedelta
            import random
            
            notificacoes_data = [
                {
                    'titulo': 'Bem-vindo ao SGFP!',
                    'mensagem': 'Seu sistema de gestão financeira está funcionando perfeitamente.',
                    'tipo': 'info',
                    'link': '/'
                },
                {
                    'titulo': 'Dashboard clássico ativo',
                    'mensagem': 'O dashboard clássico está totalmente integrado com a base de dados.',
                    'tipo': 'success',
                    'link': '/?type=classico'
                },
                {
                    'titulo': 'Dados carregados',
                    'mensagem': f'Foram encontradas {Receita.objects.filter(usuario=request.user).count()} receitas e {Despesa.objects.filter(usuario=request.user).count()} despesas no sistema.',
                    'tipo': 'info',
                    'link': '/'
                },
                {
                    'titulo': 'Sistema atualizado',
                    'mensagem': 'Todas as funcionalidades estão funcionando corretamente.',
                    'tipo': 'success',
                    'link': '/'
                },
                {
                    'titulo': 'Configurações salvas',
                    'mensagem': 'Suas preferências foram salvas com sucesso.',
                    'tipo': 'info',
                    'link': '/configuracoes/'
                }
            ]
            
            notificacoes_criadas = 0
            for notif_data in notificacoes_data:
                data_criacao = timezone.now() - timedelta(days=random.randint(0, 7))
                Notificacao.objects.create(
                    usuario=request.user,
                    titulo=notif_data['titulo'],
                    mensagem=notif_data['mensagem'],
                    tipo=notif_data['tipo'],
                    link=notif_data['link'],
                    data_criacao=data_criacao,
                    lida=random.choice([True, False])
                )
                notificacoes_criadas += 1
            
            messages.success(request, f'{notificacoes_criadas} notificações de teste criadas com sucesso!')
            return redirect('core:configuracoes')
        
        form = ConfiguracaoForm(request.POST, instance=configuracao)
        if form.is_valid():
            form.save()
            messages.success(request, 'Configurações salvas com sucesso!')
            return redirect('core:configuracoes')
    else:
        form = ConfiguracaoForm(instance=configuracao)
    
    return render(request, 'core/configuracoes.html', {'form': form})

# API Views para AJAX
@login_required
def api_saldo_conta(request, pk):
    conta = get_object_or_404(Conta, pk=pk, usuario=request.user)
    conta.atualizar_saldo()
    return JsonResponse({'saldo': float(conta.saldo_atual)})

@login_required
def api_dados_dashboard(request):
    user = request.user
    hoje = timezone.now().date()
    inicio_mes = hoje.replace(day=1)
    fim_mes = (inicio_mes + timedelta(days=32)).replace(day=1) - timedelta(days=1)
    
    receitas_mes = Receita.objects.filter(
        usuario=user, data__gte=inicio_mes, data__lte=fim_mes, ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0
    
    despesas_mes = Despesa.objects.filter(
        usuario=user, data__gte=inicio_mes, data__lte=fim_mes, ativo=True
    ).aggregate(total=Sum('valor'))['total'] or 0
    
    return JsonResponse({
        'receitas_mes': float(receitas_mes),
        'despesas_mes': float(despesas_mes),
        'saldo_mes': float(receitas_mes - despesas_mes)
    })

@login_required
def notificacoes_list(request):
    """Lista todas as notificações do usuário"""
    notificacoes = Notificacao.objects.filter(usuario=request.user)
    
    # Filtrar por tipo se especificado
    tipo = request.GET.get('tipo')
    if tipo:
        notificacoes = notificacoes.filter(tipo=tipo)
    
    # Filtrar por status se especificado
    lida = request.GET.get('lida')
    if lida is not None:
        notificacoes = notificacoes.filter(lida=lida == 'true')
    
    context = {
        'notificacoes': notificacoes,
        'tipos': Notificacao.TIPO_CHOICES,
    }
    return render(request, 'core/notificacoes_list.html', context)

@login_required
def notificacao_detail(request, pk):
    """Visualizar detalhes de uma notificação"""
    notificacao = get_object_or_404(Notificacao, pk=pk, usuario=request.user)
    
    # Marcar como lida se não estiver
    if not notificacao.lida:
        notificacao.marcar_como_lida()
    
    context = {
        'notificacao': notificacao,
    }
    return render(request, 'core/notificacao_detail.html', context)

@login_required
def notificacao_marcar_lida(request, pk):
    """Marcar notificação como lida via AJAX"""
    if request.method == 'POST':
        notificacao = get_object_or_404(Notificacao, pk=pk, usuario=request.user)
        notificacao.marcar_como_lida()
        return JsonResponse({'success': True})
    return JsonResponse({'success': False}, status=400)

@login_required
def notificacao_marcar_todas_lidas(request):
    """Marcar todas as notificações como lidas"""
    if request.method == 'POST':
        Notificacao.objects.filter(usuario=request.user, lida=False).update(
            lida=True, data_leitura=timezone.now()
        )
        messages.success(request, 'Todas as notificações foram marcadas como lidas.')
        return redirect('core:notificacoes_list')
    return redirect('core:notificacoes_list')

@login_required
def notificacao_delete(request, pk):
    """Excluir uma notificação"""
    notificacao = get_object_or_404(Notificacao, pk=pk, usuario=request.user)
    
    if request.method == 'POST':
        notificacao.delete()
        messages.success(request, 'Notificação excluída com sucesso.')
        return redirect('core:notificacoes_list')
    
    context = {
        'notificacao': notificacao,
    }
    return render(request, 'core/notificacao_confirmar_remocao.html', context)

@login_required
def notificacoes_count(request):
    """Retorna o número de notificações não lidas (para AJAX)"""
    count = Notificacao.objects.filter(usuario=request.user, lida=False).count()
    return JsonResponse({'count': count})

@login_required
def notificacoes_recentes(request):
    """Retorna notificações recentes para o dropdown (AJAX)"""
    notificacoes = Notificacao.objects.filter(
        usuario=request.user
    ).order_by('-data_criacao')[:5]
    
    notificacoes_data = []
    for notificacao in notificacoes:
        notificacoes_data.append({
            'id': notificacao.id,
            'titulo': notificacao.titulo,
            'mensagem': notificacao.mensagem,
            'tipo': notificacao.tipo,
            'icone': notificacao.icone,
            'lida': notificacao.lida,
            'tempo_atras': timezone.template_localtime(notificacao.data_criacao).strftime('%d/%m %H:%M'),
            'link': notificacao.link
        })
    
    return JsonResponse({
        'notificacoes': notificacoes_data
    })

@login_required
def exportar_backup(request):
    """Exporta todos os dados do usuário autenticado em JSON para a pasta backup/ na raiz do projeto"""
    import uuid
    import datetime
    from decimal import Decimal
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backup_dir = os.path.join(BASE_DIR, 'backup')
    os.makedirs(backup_dir, exist_ok=True)
    def convert(obj):
        if isinstance(obj, dict):
            return {k: convert(v) for k, v in obj.items()}
        elif isinstance(obj, (uuid.UUID, datetime.datetime, datetime.date, Decimal)):
            return str(obj)
        return obj
    dados = {}
    dados['categorias'] = [convert(obj) for obj in Categoria.objects.filter(usuario=request.user).values()]
    dados['contas'] = [convert(obj) for obj in Conta.objects.filter(usuario=request.user).values()]
    dados['receitas'] = [convert(obj) for obj in Receita.objects.filter(usuario=request.user).values()]
    dados['despesas'] = [convert(obj) for obj in Despesa.objects.filter(usuario=request.user).values()]
    dados['metas'] = [convert(obj) for obj in Meta.objects.filter(usuario=request.user).values()]
    dados['configuracao'] = [convert(obj) for obj in Configuracao.objects.filter(usuario=request.user).values()]
    dados['transferencias'] = [convert(obj) for obj in Transferencia.objects.filter(usuario=request.user).values()]
    dados['notificacoes'] = [convert(obj) for obj in Notificacao.objects.filter(usuario=request.user).values()]

    now = timezone.localtime()
    filename = f"bkp_sgfp_{now.strftime('%Y%m%d_%H%M')}.json"
    file_path = os.path.join(backup_dir, filename)
    with open(file_path, 'w', encoding='utf-8') as f:
        pyjson.dump(dados, f, ensure_ascii=False, indent=2)
    messages.success(request, f'Backup exportado para {file_path}')
    return redirect('core:configuracoes')

@login_required
def excluir_backup(request, filename):
    """Exclui um arquivo de backup da pasta backup/"""
    import os
    from django.http import Http404
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backup_dir = os.path.join(BASE_DIR, 'backup')
    file_path = os.path.join(backup_dir, filename)
    if not os.path.exists(file_path):
        raise Http404('Arquivo não encontrado')
    os.remove(file_path)
    messages.success(request, f'Backup {filename} excluído com sucesso!')
    return redirect('core:listar_backups')

@login_required
def importar_backup(request):
    """Importa dados do usuário a partir de um arquivo JSON"""
    if request.method == 'POST' and request.FILES.get('arquivo_backup'):
        arquivo: UploadedFile = request.FILES['arquivo_backup']
        try:
            dados = pyjson.loads(arquivo.read().decode('utf-8'))
            # Opcional: Limpar dados antigos do usuário antes de importar
            # Categoria.objects.filter(usuario=request.user).delete()
            # Conta.objects.filter(usuario=request.user).delete()
            # Receita.objects.filter(usuario=request.user).delete()
            # Despesa.objects.filter(usuario=request.user).delete()
            # Meta.objects.filter(usuario=request.user).delete()
            # Configuracao.objects.filter(usuario=request.user).delete()
            # Transferencia.objects.filter(usuario=request.user).delete()
            # Notificacao.objects.filter(usuario=request.user).delete()
            # Importar cada entidade
            for model, ModelClass in [
                ('categorias', Categoria),
                ('contas', Conta),
                ('receitas', Receita),
                ('despesas', Despesa),
                ('metas', Meta),
                ('configuracao', Configuracao),
                ('transferencias', Transferencia),
                ('notificacoes', Notificacao),
            ]:
                for obj in dados.get(model, []):
                    obj.pop('id', None)  # Remover ID para evitar conflitos
                    obj['usuario_id'] = request.user.id
                    ModelClass.objects.create(**obj)
            messages.success(request, 'Backup importado com sucesso!')
        except Exception as e:
            messages.error(request, f'Erro ao importar backup: {str(e)}')
        return redirect('core:configuracoes')
    return render(request, 'core/importar_backup.html')

@login_required
def listar_backups(request):
    """Lista os arquivos de backup disponíveis na pasta backup/"""
    import os
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backup_dir = os.path.join(BASE_DIR, 'backup')
    arquivos = []
    if os.path.exists(backup_dir):
        arquivos = [f for f in os.listdir(backup_dir) if f.endswith('.json')]
        arquivos.sort(reverse=True)
    return render(request, 'core/listar_backups.html', {'arquivos': arquivos})

@login_required
def baixar_backup(request, filename):
    """Permite baixar um arquivo de backup da pasta backup/"""
    import os
    from django.http import FileResponse, Http404
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backup_dir = os.path.join(BASE_DIR, 'backup')
    file_path = os.path.join(backup_dir, filename)
    if not os.path.exists(file_path):
        raise Http404('Arquivo não encontrado')
    return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=filename)

@login_required
def importar_backup_arquivo(request, filename):
    """Importa um backup existente na pasta backup/ para o usuário atual, atualizando ou pulando registros duplicados."""
    import os
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    backup_dir = os.path.join(BASE_DIR, 'backup')
    file_path = os.path.join(backup_dir, filename)
    if not os.path.exists(file_path):
        from django.http import Http404
        raise Http404('Arquivo não encontrado')
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            dados = pyjson.load(f)
        for model, ModelClass in [
            ('categorias', Categoria),
            ('contas', Conta),
            ('receitas', Receita),
            ('despesas', Despesa),
            ('metas', Meta),
            ('configuracao', Configuracao),
            ('transferencias', Transferencia),
            ('notificacoes', Notificacao),
        ]:
            for obj in dados.get(model, []):
                obj.pop('id', None)
                obj['usuario_id'] = request.user.id
                instance = None
                unique_fields = {}
                # Lógica para evitar duplicidade em todos os modelos
                if ModelClass is Categoria:
                    unique_fields = {'nome': obj['nome'], 'usuario_id': obj['usuario_id']}
                elif ModelClass is Conta:
                    unique_fields = {'nome': obj['nome'], 'usuario_id': obj['usuario_id']}
                elif ModelClass is Meta:
                    unique_fields = {'titulo': obj['titulo'], 'usuario_id': obj['usuario_id']}
                elif ModelClass is Receita:
                    unique_fields = {'descricao': obj['descricao'], 'valor': obj['valor'], 'data': obj['data'], 'usuario_id': obj['usuario_id']}
                elif ModelClass is Despesa:
                    unique_fields = {'descricao': obj['descricao'], 'valor': obj['valor'], 'data': obj['data'], 'usuario_id': obj['usuario_id']}
                elif ModelClass is Transferencia:
                    unique_fields = {'descricao': obj['descricao'], 'valor': obj['valor'], 'data': obj['data'], 'usuario_id': obj['usuario_id']}
                elif ModelClass is Configuracao:
                    unique_fields = {'usuario_id': obj['usuario_id']}
                elif ModelClass is Notificacao:
                    unique_fields = {'titulo': obj['titulo'], 'mensagem': obj['mensagem'], 'usuario_id': obj['usuario_id']}
                if unique_fields:
                    instance = ModelClass.objects.filter(**unique_fields).first()
                if instance:
                    for k, v in obj.items():
                        if k not in unique_fields:
                            setattr(instance, k, v)
                    instance.save()
                    continue
                ModelClass.objects.create(**obj)
        messages.success(request, f'Backup {filename} importado com sucesso!')
    except Exception as e:
        messages.error(request, f'Erro ao importar backup: {str(e)}')
    return redirect('core:listar_backups')

@login_required
def excluir_dados_ficticios(request):
    """Exclui dados fictícios do usuário logado (dados de jan a jun/2025)."""
    if request.method == 'POST':
        # Critério: dados de 2025 criados pelo comando fictício
        Receita.objects.filter(usuario=request.user, data__year=2025).delete()
        Despesa.objects.filter(usuario=request.user, data__year=2025).delete()
        Transferencia.objects.filter(usuario=request.user, data__year=2025).delete()
        Meta.objects.filter(usuario=request.user, data_inicio__year=2025).delete()
        from core.models import CartaoCredito, Conta
        contas_2025 = Conta.objects.filter(usuario=request.user, data_criacao__year=2025)
        # Exclui cartões de crédito vinculados às contas de 2025
        CartaoCredito.objects.filter(usuario=request.user, conta_pagamento__in=contas_2025).delete()
        # Agora pode excluir as contas
        contas_2025.delete()
        Categoria.objects.filter(usuario=request.user, data_criacao__year=2025).delete()
        Notificacao.objects.filter(usuario=request.user, data_criacao__year=2025).delete()
        messages.success(request, 'Dados fictícios de 2025 excluídos com sucesso!')
        return redirect('core:configuracoes')
    return redirect('core:configuracoes')

@login_required
def exportar_banco_completo(request):
    """Permite ao usuário baixar o arquivo completo do banco de dados (db.sqlite3)."""
    import os
    from django.http import FileResponse
    db_path = os.path.join(settings.BASE_DIR, 'db.sqlite3')
    if not os.path.exists(db_path):
        messages.error(request, 'Arquivo do banco de dados não encontrado.')
        return redirect('core:configuracoes')
    response = FileResponse(open(db_path, 'rb'), as_attachment=True, filename='sgfp_db_backup.sqlite3')
    return response

@login_required
def importar_banco_completo(request):
    """Permite ao usuário importar/substituir o arquivo completo do banco de dados (db.sqlite3)."""
    import os
    if request.method == 'POST' and request.FILES.get('arquivo_banco'):
        arquivo = request.FILES['arquivo_banco']
        db_path = os.path.join(settings.BASE_DIR, 'db.sqlite3')
        try:
            with open(db_path, 'wb+') as destino:
                for chunk in arquivo.chunks():
                    destino.write(chunk)
            # Mensagem via GET para a tela de login
            return redirect('/login/?imported=1')
        except Exception as e:
            return render(request, 'core/importar_banco.html', {'erro': f'Erro ao restaurar banco: {str(e)}'})
    return render(request, 'core/importar_banco.html')

@login_required
def cartao_credito_list(request):
    cartoes_ativos = CartaoCredito.objects.filter(usuario=request.user, ativo=True)
    cartoes_inativos = CartaoCredito.objects.filter(usuario=request.user, ativo=False)
    return render(request, 'core/cartoes_credito_list.html', {
        'cartoes_ativos': cartoes_ativos,
        'cartoes_inativos': cartoes_inativos
    })

@login_required
def cartao_credito_create(request):
    if request.method == 'POST':
        form = CartaoCreditoForm(request.POST, user=request.user)
        if form.is_valid():
            cartao = form.save(commit=False)
            cartao.usuario = request.user
            cartao.save()
            messages.success(request, 'Cartão cadastrado com sucesso!')
            return redirect('core:cartao_credito_list')
    else:
        form = CartaoCreditoForm(user=request.user)
    return render(request, 'core/cartao_credito_form.html', {'form': form, 'title': 'Novo Cartão de Crédito'})

@login_required
def cartao_credito_update(request, pk):
    cartao = get_object_or_404(CartaoCredito, pk=pk, usuario=request.user)
    if request.method == 'POST':
        form = CartaoCreditoForm(request.POST, instance=cartao, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Cartão atualizado com sucesso!')
            return redirect('core:cartao_credito_list')
    else:
        form = CartaoCreditoForm(instance=cartao, user=request.user)
    return render(request, 'core/cartao_credito_form.html', {'form': form, 'title': 'Editar Cartão de Crédito'})

@login_required
def cartao_credito_delete(request, pk):
    cartao = get_object_or_404(CartaoCredito, pk=pk, usuario=request.user)
    if request.method == 'POST':
        cartao.delete()
        messages.success(request, 'Cartão excluído do sistema com sucesso!')
        return redirect('core:cartao_credito_list')
    return render(request, 'core/cartao_credito_confirmar_remocao.html', {'cartao': cartao})

@login_required
def cartao_detalhe(request, pk):
    cartao = get_object_or_404(CartaoCredito, pk=pk, usuario=request.user)
    despesas = Despesa.objects.filter(cartao=cartao, ativo=True).order_by('-data')
    if request.method == 'POST':
        form = CartaoCreditoForm(request.POST, instance=cartao, user=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, 'Cartão atualizado com sucesso!')
            return redirect('core:cartao_detalhe', pk=cartao.pk)
    else:
        form = CartaoCreditoForm(instance=cartao, user=request.user)
    context = {
        'cartao': cartao,
        'form': form,
        'despesas': despesas,
        'limite_total': cartao.limite_total,
        'limite_utilizado': cartao.limite_utilizado,
        'limite_disponivel': cartao.limite_disponivel,
        'data_vencimento': cartao.data_vencimento,
        'data_fechamento': cartao.data_fechamento,
    }
    return render(request, 'core/cartao_credito_detail.html', context)

@login_required
def cartoes_dashboard(request):
    # Aplicar filtros de data se fornecidos
    data_inicio = request.GET.get('data_inicio')
    data_fim = request.GET.get('data_fim')
    
    # Construir filtros de data para despesas
    filtros_despesa = {'ativo': True}
    if data_inicio:
        filtros_despesa['data__gte'] = data_inicio
    if data_fim:
        filtros_despesa['data__lte'] = data_fim
    
    cartoes = CartaoCredito.objects.filter(usuario=request.user, ativo=True)
    cartao_id = request.GET.get('cartao')
    cartao_selecionado = None
    faturas = []
    hoje = timezone.now().date()
    
    if cartao_id:
        try:
            cartao_selecionado = cartoes.get(pk=cartao_id)
        except CartaoCredito.DoesNotExist:
            cartao_selecionado = None
    
    # Calcular dados de evolução temporal dos gastos (últimos 12 meses)
    evolucao_labels = []
    evolucao_valores = []
    meses_ptbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    
    for i in range(11, -1, -1):
        data = hoje - timedelta(days=30*i)
        mes = data.month
        ano = data.year
        
        # Calcular gastos do mês
        if cartao_selecionado:
            gastos_mes = Despesa.objects.filter(
                cartao=cartao_selecionado,
                data__month=mes,
                data__year=ano,
                **filtros_despesa
            ).aggregate(total=Sum('valor'))['total'] or 0
        else:
            gastos_mes = Despesa.objects.filter(
                cartao__in=cartoes,
                data__month=mes,
                data__year=ano,
                **filtros_despesa
            ).aggregate(total=Sum('valor'))['total'] or 0
        
        evolucao_labels.append(f'{meses_ptbr[mes-1]}/{ano}')
        evolucao_valores.append(float(gastos_mes))
    
    if cartao_selecionado:
        despesas_cartoes = Despesa.objects.filter(cartao=cartao_selecionado, **filtros_despesa)
        total_limite = cartao_selecionado.limite_total
        total_utilizado = cartao_selecionado.limite_utilizado
        total_disponivel = total_limite - total_utilizado
        labels = [cartao_selecionado.nome]
        gastos = [float(cartao_selecionado.limite_utilizado)]
        
        # Buscar faturas do cartão selecionado
        faturas = Fatura.objects.filter(cartao=cartao_selecionado).order_by('ano', 'mes')
        
        # Dados para gráfico de barras das faturas (12 meses)
        from datetime import date
        hoje = timezone.now().date()
        meses_labels = []
        meses_valores = []
        meses_status = []
        meses_cores = []
        meses_ano = []
        # Gera lista dos últimos 12 meses (do mês atual para trás)
        meses_ptbr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
        for i in range(11, -1, -1):
            ano = hoje.year if hoje.month - i > 0 else hoje.year - 1
            mes = (hoje.month - i - 1) % 12 + 1
            meses_ano.append((mes, ano))
        for mes, ano in meses_ano:
            fatura = faturas.filter(mes=mes, ano=ano).first()
            if fatura:
                meses_labels.append(f'{meses_ptbr[mes-1]}/{fatura.ano}')
                meses_valores.append(float(fatura.valor_calculado()))
                status = fatura.status
                meses_status.append(status)
                if status == 'Paga':
                    meses_cores.append('#28a745')
                elif status == 'Vencida':
                    meses_cores.append('#dc3545')
                else:
                    meses_cores.append('#ffc107')
            else:
                meses_labels.append(f'{meses_ptbr[mes-1]}/{ano}')
                meses_valores.append(0)
                meses_status.append('Sem Fatura')
                meses_cores.append('#b0b0b0')
        grafico_labels = meses_labels
        grafico_valores = meses_valores
        grafico_status = meses_status
        grafico_cores = meses_cores
        # Separar faturas por status para o template
        faturas_em_aberto = [f for f in faturas if not f.paga and f.vencimento >= hoje]
        faturas_pagas = [f for f in faturas if f.paga]
        faturas_vencidas = [f for f in faturas if not f.paga and f.vencimento < hoje]
        faturas_futuras = [f for f in faturas if not f.paga and f.vencimento > hoje and f not in faturas_em_aberto]
    
    else:
        despesas_cartoes = Despesa.objects.filter(cartao__in=cartoes, **filtros_despesa)
        total_limite = cartoes.aggregate(total=Sum('limite_total'))['total'] or 0
        total_utilizado = sum([c.limite_utilizado for c in cartoes])
        total_disponivel = total_limite - total_utilizado
        labels = [c.nome for c in cartoes]
        gastos = [float(c.limite_utilizado) for c in cartoes]
        faturas = []
        faturas_em_aberto = []
        faturas_pagas = []
        faturas_futuras = []
        faturas_vencidas = []
        grafico_labels = []
        grafico_valores = []
        grafico_status = []
        grafico_cores = []
    
    context = {
        'cartoes': cartoes,
        'cartao_selecionado': cartao_selecionado,
        'despesas_cartoes': despesas_cartoes,
        'total_limite': total_limite,
        'total_utilizado': total_utilizado,
        'total_disponivel': total_disponivel,
        'labels': labels,
        'gastos': gastos,
        'evolucao_labels': evolucao_labels,
        'evolucao_valores': evolucao_valores,
        'faturas': faturas,
        'faturas_em_aberto': faturas_em_aberto,
        'faturas_pagas': faturas_pagas,
        'faturas_futuras': faturas_futuras,
        'faturas_vencidas': faturas_vencidas,
        'grafico_labels': grafico_labels,
        'grafico_valores': grafico_valores,
        'grafico_status': grafico_status,
        'grafico_cores': grafico_cores,
        'today': hoje,
    }
    return render(request, 'core/cartoes_dashboard.html', context)

@login_required
def cartao_credito_inativar(request, pk):
    cartao = get_object_or_404(CartaoCredito, pk=pk, usuario=request.user)
    if request.method == 'POST':
        cartao.ativo = False
        cartao.save()
        messages.success(request, 'Cartão inativado com sucesso!')
        return redirect('core:cartao_credito_list')
    return render(request, 'core/cartao_credito_confirmar_inativacao.html', {'cartao': cartao})

@login_required
def cartao_credito_reativar(request, pk):
    cartao = get_object_or_404(CartaoCredito, pk=pk, usuario=request.user)
    if request.method == 'POST':
        cartao.ativo = True
        cartao.save()
        messages.success(request, 'Cartão reativado com sucesso!')
        return redirect('core:cartao_credito_list')
    return render(request, 'core/cartao_credito_confirmar_reativacao.html', {'cartao': cartao})

@login_required
def pagar_fatura(request, fatura_id):
    fatura = get_object_or_404(Fatura, pk=fatura_id, cartao__usuario=request.user)
    fatura.paga = True
    fatura.data_pagamento = timezone.now().date()
    fatura.save()
    return redirect(f'{reverse("core:cartoes_dashboard")}?cartao={fatura.cartao.pk}')

@login_required
def reabrir_fatura(request, fatura_id):
    fatura = get_object_or_404(Fatura, pk=fatura_id, cartao__usuario=request.user)
    fatura.paga = False
    fatura.data_pagamento = None
    fatura.save()
    return redirect(f'{reverse("core:cartoes_dashboard")}?cartao={fatura.cartao.pk}')

@login_required
def ajustar_fatura(request, fatura_id):
    fatura = get_object_or_404(Fatura, pk=fatura_id, cartao__usuario=request.user)
    if request.method == 'POST':
        valor = request.POST.get('valor')
        vencimento = request.POST.get('vencimento')
        if valor:
            fatura.valor = valor
        if vencimento:
            fatura.vencimento = vencimento
        fatura.ajustada = True
        fatura.save()
        return redirect(f'{reverse("core:cartoes_dashboard")}?cartao={fatura.cartao.pk}')
    return render(request, 'core/ajustar_fatura.html', {'fatura': fatura})

@login_required
def nova_fatura(request):
    cartao_id = request.GET.get('cartao')
    initial = {}
    if cartao_id:
        initial['cartao'] = cartao_id
    if request.method == 'POST':
        form = FaturaForm(request.POST, user=request.user)
        if form.is_valid():
            fatura = form.save()
            return redirect(f'{reverse("core:cartoes_dashboard")}?cartao={fatura.cartao.pk}')
    else:
        form = FaturaForm(user=request.user, initial=initial)
    return render(request, 'core/nova_fatura.html', {'form': form})
