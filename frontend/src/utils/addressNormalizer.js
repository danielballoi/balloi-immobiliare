const PREFISSI = [
  'via', 'viale', 'piazza', 'corso', 'vicolo', 'largo', 'lungomare',
  'strada', 'contrada', 'salita', 'scalinata', 'piazzale', 'passaggio',
  'borgo', 'loc.', 'localita', 'località', 'frazione', 'regione',
  'piazzetta', 'traversa', 'spalto', 'rampa',
];

export function formatAddress(addr) {
  if (!addr) return '';
  const trimmed = addr.trim();
  const lower = trimmed.toLowerCase();
  if (PREFISSI.some(p => lower.startsWith(p))) return trimmed;
  return `Via ${trimmed}`;
}
