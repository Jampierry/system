from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from .models import Categoria, Conta, Receita, Despesa, Transferencia, Meta, Configuracao
from crispy_forms.helper import FormHelper
from crispy_forms.layout import Layout, Row, Column, Submit, Button, HTML
from crispy_bootstrap5.bootstrap5 import FloatingField

class UserRegistrationForm(UserCreationForm):
    email = forms.EmailField(required=True)
    first_name = forms.CharField(max_length=30, required=True, label='Nome')
    last_name = forms.CharField(max_length=30, required=True, label='Sobrenome')
    
    class Meta:
        model = User
        fields = ('username', 'first_name', 'last_name', 'email', 'password1', 'password2')
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Cadastrar', css_class='btn-primary'))
        self.helper.layout = Layout(
            Row(
                Column('username', css_class='form-group col-md-6'),
                Column('email', css_class='form-group col-md-6'),
                css_class='form-row'
            ),
            Row(
                Column('first_name', css_class='form-group col-md-6'),
                Column('last_name', css_class='form-group col-md-6'),
                css_class='form-row'
            ),
            Row(
                Column('password1', css_class='form-group col-md-6'),
                Column('password2', css_class='form-group col-md-6'),
                css_class='form-row'
            ),
        )

class CategoriaForm(forms.ModelForm):
    class Meta:
        model = Categoria
        fields = ['nome', 'descricao', 'tipo', 'cor', 'icone']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'tipo': forms.Select(attrs={'class': 'form-select'}),
            'cor': forms.TextInput(attrs={'class': 'form-control', 'type': 'color'}),
            'icone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'fas fa-tag'}),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Salvar', css_class='btn-primary'))
        self.helper.add_input(Button('cancel', 'Cancelar', css_class='btn-secondary', onclick='history.back()'))

class ContaForm(forms.ModelForm):
    class Meta:
        model = Conta
        fields = ['nome', 'tipo', 'saldo_inicial', 'descricao', 'cor', 'icone']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'tipo': forms.Select(attrs={'class': 'form-select'}),
            'saldo_inicial': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'cor': forms.TextInput(attrs={'class': 'form-control', 'type': 'color'}),
            'icone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'fas fa-wallet'}),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Salvar', css_class='btn-primary'))
        self.helper.add_input(Button('cancel', 'Cancelar', css_class='btn-secondary', onclick='history.back()'))

class ReceitaForm(forms.ModelForm):
    class Meta:
        model = Receita
        fields = ['descricao', 'valor', 'data', 'categoria', 'conta', 'observacoes', 'recorrente', 'frequencia']
        widgets = {
            'descricao': forms.TextInput(attrs={'class': 'form-control'}),
            'valor': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01', 'min': '0.01'}),
            'data': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'categoria': forms.Select(attrs={'class': 'form-select'}),
            'conta': forms.Select(attrs={'class': 'form-select'}),
            'observacoes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'recorrente': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'frequencia': forms.Select(attrs={'class': 'form-select'}),
        }
    
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            self.fields['categoria'].queryset = Categoria.objects.filter(usuario=user, ativo=True)
            self.fields['conta'].queryset = Conta.objects.filter(usuario=user, ativo=True)
        
        self.helper = FormHelper()
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Salvar', css_class='btn-primary'))
        self.helper.add_input(Button('cancel', 'Cancelar', css_class='btn-secondary', onclick='history.back()'))

class DespesaForm(forms.ModelForm):
    class Meta:
        model = Despesa
        fields = ['descricao', 'valor', 'data', 'categoria', 'conta', 'observacoes', 'recorrente', 'frequencia']
        widgets = {
            'descricao': forms.TextInput(attrs={'class': 'form-control'}),
            'valor': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01', 'min': '0.01'}),
            'data': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'categoria': forms.Select(attrs={'class': 'form-select'}),
            'conta': forms.Select(attrs={'class': 'form-select'}),
            'observacoes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'recorrente': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'frequencia': forms.Select(attrs={'class': 'form-select'}),
        }
    
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            self.fields['categoria'].queryset = Categoria.objects.filter(usuario=user, ativo=True)
            self.fields['conta'].queryset = Conta.objects.filter(usuario=user, ativo=True)
        
        self.helper = FormHelper()
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Salvar', css_class='btn-primary'))
        self.helper.add_input(Button('cancel', 'Cancelar', css_class='btn-secondary', onclick='history.back()'))

class TransferenciaForm(forms.ModelForm):
    class Meta:
        model = Transferencia
        fields = ['descricao', 'valor', 'data', 'conta_origem', 'conta_destino', 'observacoes', 'taxa']
        widgets = {
            'descricao': forms.TextInput(attrs={'class': 'form-control'}),
            'valor': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01', 'min': '0.01'}),
            'data': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'conta_origem': forms.Select(attrs={'class': 'form-select'}),
            'conta_destino': forms.Select(attrs={'class': 'form-select'}),
            'observacoes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'taxa': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01', 'min': '0'}),
        }
    
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            self.fields['conta_origem'].queryset = Conta.objects.filter(usuario=user, ativo=True)
            self.fields['conta_destino'].queryset = Conta.objects.filter(usuario=user, ativo=True)
        
        self.helper = FormHelper()
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Salvar', css_class='btn-primary'))
        self.helper.add_input(Button('cancel', 'Cancelar', css_class='btn-secondary', onclick='history.back()'))
    
    def clean(self):
        cleaned_data = super().clean()
        conta_origem = cleaned_data.get('conta_origem')
        conta_destino = cleaned_data.get('conta_destino')
        
        if conta_origem and conta_destino and conta_origem == conta_destino:
            raise forms.ValidationError("A conta de origem não pode ser a mesma da conta de destino.")
        
        return cleaned_data

class MetaForm(forms.ModelForm):
    class Meta:
        model = Meta
        fields = ['titulo', 'descricao', 'valor_meta', 'valor_atual', 'data_inicio', 'data_fim', 'tipo', 'categoria', 'conta']
        widgets = {
            'titulo': forms.TextInput(attrs={'class': 'form-control'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'valor_meta': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01', 'min': '0.01'}),
            'valor_atual': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.01', 'min': '0'}),
            'data_inicio': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'data_fim': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'tipo': forms.Select(attrs={'class': 'form-select'}),
            'categoria': forms.Select(attrs={'class': 'form-select'}),
            'conta': forms.Select(attrs={'class': 'form-select'}),
        }
    
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            self.fields['categoria'].queryset = Categoria.objects.filter(usuario=user, ativo=True)
            self.fields['conta'].queryset = Conta.objects.filter(usuario=user, ativo=True)
        
        self.helper = FormHelper()
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Salvar', css_class='btn-primary'))
        self.helper.add_input(Button('cancel', 'Cancelar', css_class='btn-secondary', onclick='history.back()'))
    
    def clean(self):
        cleaned_data = super().clean()
        data_inicio = cleaned_data.get('data_inicio')
        data_fim = cleaned_data.get('data_fim')
        
        if data_inicio and data_fim and data_inicio >= data_fim:
            raise forms.ValidationError("A data de início deve ser anterior à data de fim.")
        
        return cleaned_data

class ConfiguracaoForm(forms.ModelForm):
    class Meta:
        model = Configuracao
        fields = ['moeda_padrao', 'formato_data', 'tema_escuro', 'notificacoes_email', 'backup_automatico']
        widgets = {
            'moeda_padrao': forms.Select(attrs={'class': 'form-select'}, choices=[
                ('BRL', 'Real Brasileiro (R$)'),
                ('USD', 'Dólar Americano ($)'),
                ('EUR', 'Euro (€)'),
            ]),
            'formato_data': forms.Select(attrs={'class': 'form-select'}, choices=[
                ('DD/MM/YYYY', 'DD/MM/YYYY'),
                ('MM/DD/YYYY', 'MM/DD/YYYY'),
                ('YYYY-MM-DD', 'YYYY-MM-DD'),
            ]),
            'tema_escuro': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'notificacoes_email': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'backup_automatico': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = FormHelper()
        self.helper.form_method = 'post'
        self.helper.add_input(Submit('submit', 'Salvar Configurações', css_class='btn-primary'))

class FiltroRelatorioForm(forms.Form):
    PERIODO_CHOICES = [
        ('7d', 'Últimos 7 dias'),
        ('30d', 'Últimos 30 dias'),
        ('90d', 'Últimos 90 dias'),
        ('6m', 'Últimos 6 meses'),
        ('1y', 'Último ano'),
        ('custom', 'Período personalizado'),
    ]
    
    periodo = forms.ChoiceField(
        choices=PERIODO_CHOICES,
        widget=forms.Select(attrs={'class': 'form-select'}),
        initial='30d'
    )
    data_inicio = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date'})
    )
    data_fim = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date'})
    )
    categoria = forms.ModelChoiceField(
        queryset=Categoria.objects.none(),
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'}),
        empty_label="Todas as categorias"
    )
    conta = forms.ModelChoiceField(
        queryset=Conta.objects.none(),
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'}),
        empty_label="Todas as contas"
    )
    
    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            self.fields['categoria'].queryset = Categoria.objects.filter(usuario=user, ativo=True)
            self.fields['conta'].queryset = Conta.objects.filter(usuario=user, ativo=True)
        
        self.helper = FormHelper()
        self.helper.form_method = 'get'
        self.helper.add_input(Submit('submit', 'Filtrar', css_class='btn-primary'))
        self.helper.add_input(Button('limpar', 'Limpar', css_class='btn-secondary', onclick='limparFiltros()'))

class ReceitaFiltroForm(forms.Form):
    data_inicial = forms.DateField(label='Data inicial', required=False, widget=forms.DateInput(attrs={'type': 'date'}))
    data_final = forms.DateField(label='Data final', required=False, widget=forms.DateInput(attrs={'type': 'date'}))
    categoria = forms.ModelChoiceField(label='Categoria', queryset=Categoria.objects.none(), required=False)
    conta = forms.ModelChoiceField(label='Conta', queryset=Conta.objects.none(), required=False)
    valor_min = forms.DecimalField(label='Valor mínimo', required=False, min_value=0, decimal_places=2)
    valor_max = forms.DecimalField(label='Valor máximo', required=False, min_value=0, decimal_places=2)
    recorrente = forms.NullBooleanField(label='Recorrente?', required=False)
    busca_texto = forms.CharField(label='Buscar descrição', required=False)

    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            self.fields['categoria'].queryset = Categoria.objects.filter(usuario=user, ativo=True)
            self.fields['conta'].queryset = Conta.objects.filter(usuario=user, ativo=True)

class DespesaFiltroForm(forms.Form):
    data_inicial = forms.DateField(label='Data inicial', required=False, widget=forms.DateInput(attrs={'type': 'date'}))
    data_final = forms.DateField(label='Data final', required=False, widget=forms.DateInput(attrs={'type': 'date'}))
    categoria = forms.ModelChoiceField(label='Categoria', queryset=Categoria.objects.none(), required=False)
    conta = forms.ModelChoiceField(label='Conta', queryset=Conta.objects.none(), required=False)
    valor_min = forms.DecimalField(label='Valor mínimo', required=False, min_value=0, decimal_places=2)
    valor_max = forms.DecimalField(label='Valor máximo', required=False, min_value=0, decimal_places=2)
    recorrente = forms.NullBooleanField(label='Recorrente?', required=False)
    busca_texto = forms.CharField(label='Buscar descrição', required=False)

    def __init__(self, *args, **kwargs):
        user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        if user:
            self.fields['categoria'].queryset = Categoria.objects.filter(usuario=user, ativo=True)
            self.fields['conta'].queryset = Conta.objects.filter(usuario=user, ativo=True) 