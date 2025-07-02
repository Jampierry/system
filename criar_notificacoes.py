#!/usr/bin/env python
import os
import sys
import django
from datetime import datetime, timedelta
import random

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sgfp_web.settings')
django.setup()

from django.contrib.auth.models import User
from core.models import Notificacao

def criar_notificacoes():
    user = User.objects.first()
    if not user:
        print("Nenhum usuário encontrado!")
        return
    
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
            'mensagem': 'Foram encontradas 138 receitas e 210 despesas no sistema.',
            'tipo': 'info',
            'link': '/'
        },
        {
            'titulo': 'Sistema atualizado',
            'mensagem': 'Todas as funcionalidades estão funcionando corretamente.',
            'tipo': 'success',
            'link': '/'
        }
    ]
    
    for notif_data in notificacoes_data:
        data_criacao = datetime.now() - timedelta(days=random.randint(0, 7))
        Notificacao.objects.create(
            usuario=user,
            titulo=notif_data['titulo'],
            mensagem=notif_data['mensagem'],
            tipo=notif_data['tipo'],
            link=notif_data['link'],
            data_criacao=data_criacao,
            lida=random.choice([True, False])
        )
    
    print(f"Notificações criadas com sucesso para o usuário: {user.username}")

if __name__ == '__main__':
    criar_notificacoes() 