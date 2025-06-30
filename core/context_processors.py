def tema_config(request):
    """Context processor para disponibilizar configurações do tema em todas as páginas"""
    if request.user.is_authenticated:
        try:
            configuracao = request.user.configuracao
            return {
                'tema_escuro': configuracao.tema_escuro,
                'configuracao': configuracao
            }
        except:
            return {
                'tema_escuro': False,
                'configuracao': None
            }
    return {
        'tema_escuro': False,
        'configuracao': None
    } 