import random
from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from core.models import Categoria, Conta, Receita, Despesa, Transferencia, Meta
from django.utils import timezone

class Command(BaseCommand):
    help = 'Gera dados fictícios para todas as tabelas de janeiro a junho de 2025.'

    def add_arguments(self, parser):
        parser.add_argument('--usuario', type=str, help='Username do usuário para gerar os dados (opcional)')

    def handle(self, *args, **options):
        User = get_user_model()
        if options['usuario']:
            users = User.objects.filter(username=options['usuario'])
        else:
            users = User.objects.all()

        for user in users:
            self.stdout.write(self.style.SUCCESS(f'Gerando dados para {user.username}...'))
            self.gerar_dados_para_usuario(user)
        self.stdout.write(self.style.SUCCESS('Dados fictícios gerados com sucesso!'))

    def gerar_dados_para_usuario(self, user):
        # Garantir pelo menos 2 contas
        contas = list(Conta.objects.filter(usuario=user))
        if len(contas) < 2:
            for i in range(2 - len(contas)):
                contas.append(Conta.objects.create(
                    usuario=user,
                    nome=f'Conta Fictícia {i+1}',
                    tipo=random.choice(['corrente', 'poupanca', 'investimento']),
                    saldo_inicial=Decimal(str(round(random.uniform(1000, 5000), 2))),
                    cor='#%06x' % random.randint(0, 0xFFFFFF),
                    icone='fas fa-wallet',
                ))
        # Garantir categorias
        categorias = list(Categoria.objects.filter(usuario=user))
        if not categorias:
            nomes = [
                ('Salário', 'receita'), ('Freelance', 'receita'), ('Investimentos', 'receita'),
                ('Alimentação', 'despesa'), ('Transporte', 'despesa'), ('Moradia', 'despesa'),
                ('Saúde', 'despesa'), ('Educação', 'despesa'), ('Lazer', 'despesa')
            ]
            for nome, tipo in nomes:
                categorias.append(Categoria.objects.create(
                    usuario=user,
                    nome=nome,
                    tipo=tipo,
                    cor='#%06x' % random.randint(0, 0xFFFFFF),
                    icone='fas fa-tag',
                ))
        # Garantir pelo menos 2 metas
        metas = list(Meta.objects.filter(usuario=user))
        if len(metas) < 2:
            for i in range(2 - len(metas)):
                metas.append(Meta.objects.create(
                    usuario=user,
                    titulo=f'Meta Fictícia {i+1}',
                    valor_meta=Decimal(str(round(random.uniform(1000, 10000), 2))),
                    valor_atual=Decimal(str(round(random.uniform(0, 5000), 2))),
                    data_inicio=date(2025, 1, 1),
                    data_fim=date(2025, 6, 30),
                    tipo=random.choice(['economia', 'investimento', 'pagamento', 'compra']),
                    categoria=random.choice(categorias),
                    conta=random.choice(contas),
                ))
        # Gerar receitas e despesas para cada mês
        for mes in range(1, 7):
            dias_mes = (date(2025, mes % 12 + 1, 1) - timedelta(days=1)).day if mes < 12 else 30
            for _ in range(random.randint(5, 10)):
                dia = random.randint(1, dias_mes)
                Receita.objects.create(
                    usuario=user,
                    descricao=f'Receita Fictícia {mes}/{dia}',
                    valor=Decimal(str(round(random.uniform(500, 5000), 2))),
                    data=date(2025, mes, dia),
                    categoria=random.choice([c for c in categorias if c.tipo in ['receita', 'ambos']]),
                    conta=random.choice(contas),
                    observacoes='Receita gerada automaticamente.',
                    recorrente=random.choice([True, False]),
                    frequencia=random.choice(['mensal', 'anual', 'semanal', ''])
                )
            for _ in range(random.randint(8, 15)):
                dia = random.randint(1, dias_mes)
                Despesa.objects.create(
                    usuario=user,
                    descricao=f'Despesa Fictícia {mes}/{dia}',
                    valor=Decimal(str(round(random.uniform(50, 2000), 2))),
                    data=date(2025, mes, dia),
                    categoria=random.choice([c for c in categorias if c.tipo in ['despesa', 'ambos']]),
                    conta=random.choice(contas),
                    observacoes='Despesa gerada automaticamente.',
                    recorrente=random.choice([True, False]),
                    frequencia=random.choice(['mensal', 'anual', 'semanal', ''])
                )
            # Transferências
            for _ in range(random.randint(1, 3)):
                dia = random.randint(1, dias_mes)
                origem, destino = random.sample(contas, 2)
                Transferencia.objects.create(
                    usuario=user,
                    descricao=f'Transferência Fictícia {mes}/{dia}',
                    valor=Decimal(str(round(random.uniform(100, 1000), 2))),
                    data=date(2025, mes, dia),
                    conta_origem=origem,
                    conta_destino=destino,
                    observacoes='Transferência gerada automaticamente.',
                    taxa=Decimal(str(round(random.uniform(0, 10), 2)))
                ) 