from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from decimal import Decimal
import random
from datetime import timedelta

from core.models import Categoria, Conta, Receita, Despesa, Transferencia, Meta, Configuracao

class Command(BaseCommand):
    help = 'Gera dados fictícios para teste do sistema SGFP'

    def add_arguments(self, parser):
        parser.add_argument(
            '--usuario',
            type=str,
            help='Nome do usuário para gerar dados (opcional)',
        )
        parser.add_argument(
            '--quantidade',
            type=int,
            default=50,
            help='Quantidade de transações a gerar (padrão: 50)',
        )

    def handle(self, *args, **options):
        username = options['usuario']
        quantidade = options['quantidade']

        # Buscar usuário
        try:
            if username:
                user = User.objects.get(username=username)
            else:
                user = User.objects.first()
                if not user:
                    self.stdout.write(
                        self.style.ERROR('Nenhum usuário encontrado. Crie um usuário primeiro.')
                    )
                    return
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'Usuário "{username}" não encontrado.')
            )
            return

        self.stdout.write(f'Gerando {quantidade} transações para o usuário: {user.username}')

        # Verificar se já existem dados
        if Receita.objects.filter(usuario=user).exists() or Despesa.objects.filter(usuario=user).exists():
            self.stdout.write(
                self.style.WARNING('Usuário já possui transações. Use --usuario para especificar outro usuário.')
            )
            return

        # Dados fictícios
        categorias_receita = [
            {'nome': 'Salário', 'cor': '#28a745', 'icone': 'fas fa-money-bill-wave'},
            {'nome': 'Freelance', 'cor': '#17a2b8', 'icone': 'fas fa-laptop-code'},
            {'nome': 'Investimentos', 'cor': '#ffc107', 'icone': 'fas fa-chart-line'},
            {'nome': 'Bônus', 'cor': '#20c997', 'icone': 'fas fa-gift'},
        ]

        categorias_despesa = [
            {'nome': 'Alimentação', 'cor': '#dc3545', 'icone': 'fas fa-utensils'},
            {'nome': 'Transporte', 'cor': '#fd7e14', 'icone': 'fas fa-car'},
            {'nome': 'Moradia', 'cor': '#6f42c1', 'icone': 'fas fa-home'},
            {'nome': 'Saúde', 'cor': '#e83e8c', 'icone': 'fas fa-heartbeat'},
            {'nome': 'Educação', 'cor': '#20c997', 'icone': 'fas fa-graduation-cap'},
            {'nome': 'Lazer', 'cor': '#6c757d', 'icone': 'fas fa-gamepad'},
            {'nome': 'Vestuário', 'cor': '#fd7e14', 'icone': 'fas fa-tshirt'},
            {'nome': 'Contas', 'cor': '#dc3545', 'icone': 'fas fa-file-invoice'},
        ]

        # Criar categorias se não existirem
        for cat_data in categorias_receita:
            Categoria.objects.get_or_create(
                usuario=user,
                nome=cat_data['nome'],
                defaults={
                    'tipo': 'receita',
                    'cor': cat_data['cor'],
                    'icone': cat_data['icone']
                }
            )

        for cat_data in categorias_despesa:
            Categoria.objects.get_or_create(
                usuario=user,
                nome=cat_data['nome'],
                defaults={
                    'tipo': 'despesa',
                    'cor': cat_data['cor'],
                    'icone': cat_data['icone']
                }
            )

        # Criar contas se não existirem
        contas_data = [
            {'nome': 'Conta Principal', 'tipo': 'corrente', 'saldo_inicial': 5000},
            {'nome': 'Poupança', 'tipo': 'poupanca', 'saldo_inicial': 10000},
            {'nome': 'Cartão de Crédito', 'tipo': 'cartao_credito', 'saldo_inicial': 5000},
        ]

        contas = []
        for conta_data in contas_data:
            conta, created = Conta.objects.get_or_create(
                usuario=user,
                nome=conta_data['nome'],
                defaults={
                    'tipo': conta_data['tipo'],
                    'saldo_inicial': conta_data['saldo_inicial'],
                    'cor': '#007bff',
                    'icone': 'fas fa-wallet'
                }
            )
            contas.append(conta)

        # Gerar receitas
        receitas_criadas = 0
        for i in range(quantidade // 2):
            data = timezone.now().date() - timedelta(days=random.randint(0, 90))
            categoria = random.choice(Categoria.objects.filter(usuario=user, tipo='receita'))
            conta = random.choice(contas)
            valor = Decimal(random.uniform(100, 5000))
            
            Receita.objects.create(
                usuario=user,
                descricao=f'Receita {i+1}',
                valor=valor,
                data=data,
                categoria=categoria,
                conta=conta,
                observacoes=f'Receita fictícia gerada automaticamente'
            )
            receitas_criadas += 1

        # Gerar despesas
        despesas_criadas = 0
        for i in range(quantidade // 2):
            data = timezone.now().date() - timedelta(days=random.randint(0, 90))
            categoria = random.choice(Categoria.objects.filter(usuario=user, tipo='despesa'))
            conta = random.choice(contas)
            valor = Decimal(random.uniform(10, 500))
            
            Despesa.objects.create(
                usuario=user,
                descricao=f'Despesa {i+1}',
                valor=valor,
                data=data,
                categoria=categoria,
                conta=conta,
                observacoes=f'Despesa fictícia gerada automaticamente'
            )
            despesas_criadas += 1

        # Gerar algumas transferências
        transferencias_criadas = 0
        for i in range(quantidade // 10):
            data = timezone.now().date() - timedelta(days=random.randint(0, 90))
            conta_origem = random.choice(contas)
            conta_destino = random.choice([c for c in contas if c != conta_origem])
            valor = Decimal(random.uniform(100, 1000))
            
            Transferencia.objects.create(
                usuario=user,
                descricao=f'Transferência {i+1}',
                valor=valor,
                data=data,
                conta_origem=conta_origem,
                conta_destino=conta_destino,
                observacoes=f'Transferência fictícia gerada automaticamente'
            )
            transferencias_criadas += 1

        # Gerar algumas metas
        metas_data = [
            {'titulo': 'Viagem para Europa', 'valor_meta': 15000, 'tipo': 'economia'},
            {'titulo': 'Notebook novo', 'valor_meta': 5000, 'tipo': 'compra'},
            {'titulo': 'Reserva de emergência', 'valor_meta': 10000, 'tipo': 'economia'},
        ]

        metas_criadas = 0
        for meta_data in metas_data:
            data_inicio = timezone.now().date() - timedelta(days=random.randint(30, 180))
            data_fim = data_inicio + timedelta(days=random.randint(90, 365))
            valor_atual = Decimal(random.uniform(0, meta_data['valor_meta'] * 0.8))
            
            Meta.objects.create(
                usuario=user,
                titulo=meta_data['titulo'],
                valor_meta=meta_data['valor_meta'],
                valor_atual=valor_atual,
                data_inicio=data_inicio,
                data_fim=data_fim,
                tipo=meta_data['tipo'],
                descricao=f'Meta fictícia gerada automaticamente'
            )
            metas_criadas += 1

        # Atualizar saldos das contas
        for conta in contas:
            conta.atualizar_saldo()

        self.stdout.write(
            self.style.SUCCESS(
                f'Dados fictícios gerados com sucesso!\n'
                f'- Receitas: {receitas_criadas}\n'
                f'- Despesas: {despesas_criadas}\n'
                f'- Transferências: {transferencias_criadas}\n'
                f'- Metas: {metas_criadas}\n'
                f'- Categorias: {len(categorias_receita + categorias_despesa)}\n'
                f'- Contas: {len(contas)}'
            )
        ) 