from django import template
from decimal import Decimal, InvalidOperation

register = template.Library()

@register.filter
def br_currency(value):
    """Formata valor monetário no padrão brasileiro: R$ 1.234,56"""
    try:
        if value is None or value == '' or value == 'None':
            return 'R$ 0,00'
        if isinstance(value, str):
            value = value.strip().replace('R$', '').replace(' ', '').replace('$', '')
            if not value or value.lower() == 'none':
                return 'R$ 0,00'
            value = value.replace(',', '.')
            value = Decimal(value)
        elif isinstance(value, (int, float)):
            value = Decimal(str(value))
        elif not isinstance(value, Decimal):
            return 'R$ 0,00'
        # Formatação manual para padrão brasileiro
        inteiro, decimal = f"{value:.2f}".split('.')
        inteiro = inteiro[::-1]
        partes = [inteiro[i:i+3] for i in range(0, len(inteiro), 3)]
        inteiro_formatado = '.'.join(partes)[::-1]
        return f"R$ {inteiro_formatado},{decimal}"
    except Exception:
        return 'R$ 0,00'

@register.filter
def br_date(value):
    """Formata data no padrão brasileiro"""
    try:
        if value:
            return value.strftime('%d/%m/%Y')
        return ''
    except:
        return str(value) if value else ''

@register.filter
def br_datetime(value):
    """Formata data e hora no padrão brasileiro"""
    try:
        if value:
            return value.strftime('%d/%m/%Y %H:%M')
        return ''
    except:
        return str(value) if value else ''

@register.filter
def percentage(value, total=100):
    """Calcula e formata percentual"""
    try:
        if total and float(total) > 0:
            percent = (float(value) / float(total)) * 100
            return f'{percent:.1f}%'
        return '0%'
    except:
        return '0%' 