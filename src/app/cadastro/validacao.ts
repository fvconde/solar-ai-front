const MENSAGENS: Record<string, Record<string, string>> = {
  nome: {
    obrigatorio: 'Informe seu nome.',
    curto: 'Use ao menos 2 caracteres.',
    longo: 'Use no máximo 120 caracteres.',
  },
  email: {
    obrigatorio: 'Informe seu e-mail.',
    formato: 'Verifique o formato do e-mail.',
  },
  telefone: {
    obrigatorio: 'Informe o DDD e o número completo.',
    formato: 'Informe o DDD e o número completo.',
    curto: 'Informe o DDD e o número completo.',
    longo: 'Informe o DDD e o número completo.',
  },
  senha: {
    obrigatorio: 'Use ao menos 8 caracteres.',
    curto: 'Use ao menos 8 caracteres.',
    longo: 'Use uma senha mais curta.',
  },
  regioes: {
    lista_vazia: 'Escolha ao menos uma região.',
    obrigatorio: 'Escolha ao menos uma região.',
    valor_invalido: 'Escolha ao menos uma região.',
  },
  especialidades: {
    lista_vazia: 'Escolha ao menos uma especialidade.',
    obrigatorio: 'Escolha ao menos uma especialidade.',
    valor_invalido: 'Escolha ao menos uma especialidade.',
  },
  aceitePrivacidade: {
    obrigatorio: 'Marque o aceite da Política de privacidade para continuar.',
  },
};

export function mensagemDoCampo(campo: string, codigo: string): string {
  return MENSAGENS[campo]?.[codigo] ?? 'Confira este campo.';
}

export function validarNome(nome: string): string | undefined {
  const limpo = nome.trim();
  if (!limpo) {
    return MENSAGENS['nome']['obrigatorio'];
  }
  if (limpo.length < 2) {
    return MENSAGENS['nome']['curto'];
  }
  return limpo.length > 120 ? MENSAGENS['nome']['longo'] : undefined;
}

export function validarTelefone(telefone: string): string | undefined {
  const digitos = telefone.replace(/\D/g, '').length;
  return digitos === 10 || digitos === 11 ? undefined : MENSAGENS['telefone']['formato'];
}

export function mascararTelefone(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) {
    return '';
  }
  if (d.length <= 2) {
    return `(${d}`;
  }
  const ddd = `(${d.slice(0, 2)}) `;
  const resto = d.slice(2);
  if (resto.length <= 4) {
    return ddd + resto;
  }
  const corte = d.length === 11 ? 5 : 4;
  return `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}`;
}
