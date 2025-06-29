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

from .models import Categoria, Conta, Receita, Despesa, Transferencia, Meta, Configuracao, Notificacao
from .forms import (
    UserRegistrationForm, CategoriaForm, ContaForm, ReceitaForm, DespesaForm,
    TransferenciaForm, MetaForm, ConfiguracaoForm, FiltroRelatorioForm, ReceitaFiltroForm, DespesaFiltroForm
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
    # Dados básicos do mês atual
    hoje = timezone.now()
    mes_atual = hoje.month
    ano_atual = hoje.year
    
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
    
    # Alertas e notificações
    alertas = []
    
    # Alerta de saldo negativo
    if saldo_mes < 0:
        alertas.append({
            'tipo': 'danger',
            'titulo': 'Saldo Negativo',
            'mensagem': f'Seu saldo este mês está negativo em R$ {abs(saldo_mes):.2f}',
            'data': hoje
        })
    
    # Alerta de despesas altas
    if receitas_mes > 0 and despesas_mes > receitas_mes * Decimal('0.9'):
        alertas.append({
            'tipo': 'warning',
            'titulo': 'Despesas Elevadas',
            'mensagem': 'Suas despesas estão consumindo mais de 90% das suas receitas',
            'data': hoje
        })
    
    # Alerta de metas próximas do vencimento
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
    
    # Transações recentes (últimas 10)
    receitas_recentes = Receita.objects.filter(
        usuario=request.user,
        ativo=True
    ).select_related('categoria', 'conta').order_by('-data')[:5]
    
    despesas_recentes = Despesa.objects.filter(
        usuario=request.user,
        ativo=True
    ).select_related('categoria', 'conta').order_by('-data')[:5]
    
    # Combinar e ordenar transações
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
    
    transacoes_recentes.sort(key=lambda x: x['data'], reverse=True)
    transacoes_recentes = transacoes_recentes[:10]
    
    # Cartões de crédito
    cartoes_credito = Conta.objects.filter(usuario=request.user, tipo='cartao_credito', ativo=True)
    
    context = {
        'receitas_mes': receitas_mes,
        'despesas_mes': despesas_mes,
        'saldo_mes': saldo_mes,
        'receitas_count': receitas_count,
        'despesas_count': despesas_count,
        'metas_ativas_count': metas_ativas_count,
        'metas_total_count': metas_total_count,
        'metas_concluidas_count': metas_concluidas_count,
        'receitas_trend': receitas_trend,
        'despesas_trend': despesas_trend,
        'saldo_trend': saldo_trend,
        'receitas_tendencia': receitas_tendencia,
        'despesas_tendencia': despesas_tendencia,
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
        'alertas': alertas,
        'metas_destaque': metas_destaque,
        'transacoes_recentes': transacoes_recentes,
        'cartoes_credito': cartoes_credito,
    }
    
    return render(request, 'core/dashboard.html', context)

# Views para Categorias
@login_required
def categoria_list(request):
    categorias = Categoria.objects.filter(usuario=request.user, ativo=True)
    return render(request, 'core/categorias_list.html', {'categorias': categorias})

@login_required
def categoria_create(request):
    if request.method == 'POST':
        form = CategoriaForm(request.POST)
        if form.is_valid():
            categoria = form.save(commit=False)
            categoria.usuario = request.user
            categoria.save()
            messages.success(request, 'Categoria criada com sucesso!')
            return redirect('categoria_list')
    else:
        form = CategoriaForm()
    
    return render(request, 'core/categoria_form.html', {'form': form, 'title': 'Nova Categoria'})

@login_required
def categoria_update(request, pk):
    categoria = get_object_or_404(Categoria, pk=pk, usuario=request.user)
    if request.method == 'POST':
        form = CategoriaForm(request.POST, instance=categoria)
        if form.is_valid():
            form.save()
            messages.success(request, 'Categoria atualizada com sucesso!')
            return redirect('categoria_list')
    else:
        form = CategoriaForm(instance=categoria)
    
    return render(request, 'core/categoria_form.html', {'form': form, 'title': 'Editar Categoria'})

@login_required
def categoria_delete(request, pk):
    categoria = get_object_or_404(Categoria, pk=pk, usuario=request.user)
    if request.method == 'POST':
        categoria.ativo = False
        categoria.save()
        messages.success(request, 'Categoria removida com sucesso!')
        return redirect('categoria_list')
    
    return render(request, 'core/categoria_confirmar_remocao.html', {'categoria': categoria})

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
        form = ContaForm(request.POST)
        if form.is_valid():
            conta = form.save(commit=False)
            conta.usuario = request.user
            conta.save()
            messages.success(request, 'Conta criada com sucesso!')
            return redirect('conta_list')
    else:
        form = ContaForm()
    
    return render(request, 'core/conta_form.html', {'form': form, 'title': 'Nova Conta'})

@login_required
def conta_update(request, pk):
    conta = get_object_or_404(Conta, pk=pk, usuario=request.user)
    if request.method == 'POST':
        form = ContaForm(request.POST, instance=conta)
        if form.is_valid():
            form.save()
            messages.success(request, 'Conta atualizada com sucesso!')
            return redirect('conta_list')
    else:
        form = ContaForm(instance=conta)
    
    return render(request, 'core/conta_form.html', {'form': form, 'title': 'Editar Conta'})

@login_required
def conta_delete(request, pk):
    conta = get_object_or_404(Conta, pk=pk, usuario=request.user)
    if request.method == 'POST':
        conta.ativo = False
        conta.save()
        messages.success(request, 'Conta removida com sucesso!')
        return redirect('conta_list')
    
    return render(request, 'core/conta_confirmar_remocao.html', {'conta': conta})

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
    return render(request, 'core/receitas_list.html', {'receitas': receitas, 'form_filtro': form})

@login_required
def receita_create(request):
    if request.method == 'POST':
        form = ReceitaForm(request.POST, user=request.user)
        if form.is_valid():
            receita = form.save(commit=False)
            receita.usuario = request.user
            receita.save()
            messages.success(request, 'Receita registrada com sucesso!')
            return redirect('receita_list')
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
            return redirect('receita_list')
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
    return render(request, 'core/despesas_list.html', {'despesas': despesas, 'form_filtro': form})

@login_required
def despesa_create(request):
    if request.method == 'POST':
        form = DespesaForm(request.POST, user=request.user)
        if form.is_valid():
            despesa = form.save(commit=False)
            despesa.usuario = request.user
            despesa.save()
            messages.success(request, 'Despesa registrada com sucesso!')
            return redirect('despesa_list')
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
            return redirect('despesa_list')
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
        form = DespesaForm(request.POST, instance=despesa)
        if form.is_valid():
            form.save()
            messages.success(request, 'Despesa atualizada com sucesso!')
            return redirect('core:despesa_list')
    else:
        form = DespesaForm(instance=despesa)
    return render(request, 'core/despesa_form.html', {'form': form, 'despesa': despesa})

# Views para Transferências
@login_required
def transferencia_list(request):
    transferencias = Transferencia.objects.filter(usuario=request.user, ativo=True).order_by('-data')
    return render(request, 'core/transferencias_list.html', {'transferencias': transferencias})

@login_required
def transferencia_create(request):
    if request.method == 'POST':
        form = TransferenciaForm(request.POST, user=request.user)
        if form.is_valid():
            transferencia = form.save(commit=False)
            transferencia.usuario = request.user
            transferencia.save()
            messages.success(request, 'Transferência registrada com sucesso!')
            return redirect('transferencia_list')
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
            return redirect('transferencia_list')
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
            return redirect('meta_list')
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
            return redirect('meta_list')
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
        return redirect('meta_list')
    
    return render(request, 'core/meta_confirmar_remocao.html', {'meta': meta})

# Views para Relatórios
@login_required
def relatorio_financeiro(request):
    form = FiltroRelatorioForm(request.GET, user=request.user)
    
    if form.is_valid():
        periodo = form.cleaned_data.get('periodo')
        data_inicio = form.cleaned_data.get('data_inicio')
        data_fim = form.cleaned_data.get('data_fim')
        categoria = form.cleaned_data.get('categoria')
        conta = form.cleaned_data.get('conta')
        
        # Definir período
        hoje = timezone.now().date()
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
        elif periodo == 'custom' and data_inicio and data_fim:
            pass  # Usar datas personalizadas
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
        
        context = {
            'form': form,
            'data_inicio': data_inicio,
            'data_fim': data_fim,
            'total_receitas': total_receitas,
            'total_despesas': total_despesas,
            'saldo': saldo,
            'receitas_por_categoria': receitas_por_categoria,
            'despesas_por_categoria': despesas_por_categoria,
            'receitas_por_conta': receitas_por_conta,
            'despesas_por_conta': despesas_por_conta,
            'receitas': receitas.order_by('-data'),
            'despesas': despesas.order_by('-data'),
        }
    else:
        context = {'form': form}
    
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
            
            try:
                output = StringIO()
                call_command('gerar_dados_ficticios', usuario=request.user.username, stdout=output)
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
        Conta.objects.filter(usuario=request.user, data_criacao__year=2025).delete()
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
