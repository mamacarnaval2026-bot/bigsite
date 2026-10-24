export const loja = {
  nome: 'Brisa Casa', // ALTERAR para o nome real da empresa
  slogan: 'O clima ideal começa em casa.',
  whatsapp: '', // DDD + número, apenas dígitos. Ex.: 5511999999999
  email: '',
  cidade: '',
  cnpj: '',
  endereco: '',
  instagram: '',
}
export const dinheiro = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
