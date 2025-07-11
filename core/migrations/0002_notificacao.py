# Generated by Django 5.0.7 on 2025-06-28 23:11

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Notificacao',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titulo', models.CharField(max_length=200)),
                ('mensagem', models.TextField()),
                ('tipo', models.CharField(choices=[('alerta', 'Alerta'), ('info', 'Informação'), ('sucesso', 'Sucesso'), ('aviso', 'Aviso'), ('erro', 'Erro')], default='info', max_length=20)),
                ('lida', models.BooleanField(default=False)),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_leitura', models.DateTimeField(blank=True, null=True)),
                ('link', models.CharField(blank=True, max_length=200, null=True)),
                ('icone', models.CharField(default='fas fa-bell', max_length=50)),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='notificacoes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Notificação',
                'verbose_name_plural': 'Notificações',
                'ordering': ['-data_criacao'],
            },
        ),
    ]
