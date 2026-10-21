export const EVENT = {
  name: 'Aprenda & Empreenda com Elas',
  kicker: 'Conferência Nacional de Empreendedorismo',
  edition: 'Outubro Rosa · 2026',
  dateLong: 'Sexta-feira, 23 de Outubro de 2026',
  dateShort: '23 Out 2026',
  time: '08h00',
  venue: 'Palácio da Justiça',
  area: 'Cidade Alta, Luanda',
};

export const DINNER = {
  name: 'Jantar Pós-Conferência',
  dateLong: 'Sexta-feira, 23 de Outubro de 2026',
  time: '19h00',
  venue: "Pés n'Areia Beach Restaurant",
  price: '30.000 Kz',
  info: '942 218 877',
  capacity: Number(process.env.DINNER_CAPACITY) || 50,
};
