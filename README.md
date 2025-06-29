# SGFP - Sistema de Gestão Financeira Pessoal

Um sistema web completo para gestão financeira pessoal desenvolvido com Django, Bootstrap 5 e JavaScript moderno.

## 🚀 Funcionalidades

### 📊 Dashboard
- Visão geral das finanças do mês atual
- Gráficos interativos de receitas vs despesas
- Cards de resumo com receitas, despesas e saldo
- Top categorias de gastos
- Lista de contas com saldos atualizados
- Progresso das metas financeiras
- Últimas transações

### 💰 Gestão de Transações
- **Receitas**: Registro de entradas de dinheiro
- **Despesas**: Controle de gastos
- **Transferências**: Movimentação entre contas
- Categorização automática
- Transações recorrentes
- Observações e anexos

### 🏦 Gestão de Contas
- Múltiplas contas (corrente, poupança, investimento, etc.)
- Saldos automáticos baseados nas transações
- Cores e ícones personalizáveis
- Histórico de movimentações

### 🏷️ Categorias
- Categorias personalizáveis para receitas e despesas
- Cores e ícones únicos
- Relatórios por categoria
- Categorias padrão criadas automaticamente

### 🎯 Metas Financeiras
- Definição de metas de economia
- Acompanhamento do progresso
- Alertas de prazo
- Diferentes tipos de metas

### 📈 Relatórios
- Relatórios detalhados por período
- Filtros por categoria, conta e data
- Gráficos e estatísticas
- Exportação de dados

### ⚙️ Configurações
- Preferências pessoais
- Tema escuro/claro
- Configurações de moeda
- Notificações

## 🛠️ Tecnologias Utilizadas

- **Backend**: Django 5.0
- **Frontend**: Bootstrap 5, FontAwesome 6
- **Gráficos**: Chart.js
- **Formulários**: Crispy Forms
- **Banco de Dados**: SQLite (desenvolvimento)
- **JavaScript**: ES6+ com funcionalidades modernas

## 📋 Pré-requisitos

- Python 3.8+
- pip (gerenciador de pacotes Python)
- Git

## 🚀 Instalação

1. **Clone o repositório**
```bash
git clone <url-do-repositorio>
cd "SGFP Web - Sistema Gestão Financeira Pessoal"
```

2. **Crie um ambiente virtual**
```bash
python -m venv .venv
```

3. **Ative o ambiente virtual**
```bash
# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate
```

4. **Instale as dependências**
```bash
pip install -r requirements.txt
```

5. **Configure o banco de dados**
```bash
python manage.py makemigrations
python manage.py migrate
```

6. **Crie um superusuário**
```bash
python manage.py createsuperuser
```

7. **Execute o servidor de desenvolvimento**
```bash
python manage.py runserver
```

8. **Acesse o sistema**
- URL: http://127.0.0.1:8000/
- Admin: http://127.0.0.1:8000/admin/

## 📁 Estrutura do Projeto

```
SGFP Web - Sistema Gestão Financeira Pessoal/
├── core/                          # Aplicação principal
│   ├── models.py                  # Modelos de dados
│   ├── views.py                   # Views e lógica de negócio
│   ├── forms.py                   # Formulários
│   ├── admin.py                   # Interface administrativa
│   └── urls.py                    # URLs da aplicação
├── sgfp_web/                      # Configurações do projeto
│   ├── settings.py                # Configurações Django
│   └── urls.py                    # URLs principais
├── templates/                     # Templates HTML
│   ├── base.html                  # Template base
│   ├── core/                      # Templates da aplicação
│   └── registration/              # Templates de autenticação
├── static/                        # Arquivos estáticos
│   └── core/
│       ├── css/style.css          # Estilos personalizados
│       └── js/main.js             # JavaScript principal
├── manage.py                      # Script de gerenciamento Django
└── requirements.txt               # Dependências do projeto
```

## 🎯 Como Usar

### 1. Primeiro Acesso
- Acesse http://127.0.0.1:8000/
- Clique em "Criar conta" para se registrar
- O sistema criará automaticamente:
  - Categorias padrão (Salário, Alimentação, Transporte, etc.)
  - Uma conta principal
  - Configurações padrão

### 2. Configuração Inicial
- Acesse "Contas" e adicione suas contas bancárias
- Configure o saldo inicial de cada conta
- Personalize as categorias conforme necessário

### 3. Registrando Transações
- Use o botão "Nova Receita" ou "Nova Despesa" no dashboard
- Preencha os dados obrigatórios
- Categorize adequadamente para melhor controle

### 4. Acompanhando Metas
- Crie metas financeiras em "Metas"
- Defina valor objetivo e prazo
- Acompanhe o progresso no dashboard

### 5. Relatórios
- Acesse "Relatórios" para análises detalhadas
- Use os filtros para períodos específicos
- Exporte dados se necessário

## 🔧 Configurações Avançadas

### Personalização de Cores
Edite o arquivo `static/core/css/style.css` para personalizar:
- Cores do tema
- Estilos dos componentes
- Animações

### Adicionando Novas Funcionalidades
1. Crie novos modelos em `core/models.py`
2. Adicione views em `core/views.py`
3. Configure URLs em `core/urls.py`
4. Crie templates em `templates/core/`

### Backup e Restauração
```bash
# Backup
python manage.py dumpdata > backup.json

# Restauração
python manage.py loaddata backup.json
```

## 🐛 Solução de Problemas

### Erro de Migração
```bash
python manage.py makemigrations --empty core
python manage.py makemigrations
python manage.py migrate
```

### Problemas de Dependências
```bash
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

### Reset do Banco de Dados
```bash
rm db.sqlite3
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

## 📊 Funcionalidades Técnicas

### Segurança
- Autenticação de usuários
- Proteção CSRF
- Validação de formulários
- Isolamento de dados por usuário

### Performance
- Queries otimizadas
- Cache de consultas frequentes
- Paginação de resultados
- Lazy loading de componentes

### Responsividade
- Design mobile-first
- Bootstrap 5 responsivo
- Componentes adaptáveis
- Interface touch-friendly

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 👨‍💻 Autor

Desenvolvido como projeto de sistema de gestão financeira pessoal.

## 🙏 Agradecimentos

- Django Documentation
- Bootstrap Team
- FontAwesome
- Chart.js
- Comunidade Python/Django

---

**SGFP** - Transformando o controle financeiro em uma experiência simples e eficiente! 💰✨ 