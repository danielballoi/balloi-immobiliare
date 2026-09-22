const { calcolaFasciaOMI } = require('../services/valutazioneComparativa');

const BASE = {
  classe_energetica: 'MEDIA',
  esposizione: 'BUONA',
  vista: 'STANDARD',
  qualita_costruzione: 'STANDARD',
  luminosita: 'BUONA',
  stato_conservazione: 'NORMALE',
};

describe('calcolaFasciaOMI', () => {
  test('0 caratteristiche alte → BASSA', () => {
    const { fascia, puntiAlti } = calcolaFasciaOMI(BASE);
    expect(puntiAlti).toBe(0);
    expect(fascia).toBe('BASSA');
  });

  test('1 caratteristica alta → BASSA (limite superiore della fascia)', () => {
    const { fascia, puntiAlti } = calcolaFasciaOMI({ ...BASE, classe_energetica: 'ALTA' });
    expect(puntiAlti).toBe(1);
    expect(fascia).toBe('BASSA');
  });

  test('2 caratteristiche alte → MEDIA (limite inferiore della fascia)', () => {
    const { fascia, puntiAlti } = calcolaFasciaOMI({ ...BASE, classe_energetica: 'ALTA', esposizione: 'OTTIMA' });
    expect(puntiAlti).toBe(2);
    expect(fascia).toBe('MEDIA');
  });

  test('3 caratteristiche alte → MEDIA (limite superiore della fascia)', () => {
    const { fascia, puntiAlti } = calcolaFasciaOMI({
      ...BASE, classe_energetica: 'ALTA', esposizione: 'OTTIMA', vista: 'PREGIATA',
    });
    expect(puntiAlti).toBe(3);
    expect(fascia).toBe('MEDIA');
  });

  test('4 caratteristiche alte → ALTA (limite inferiore della fascia)', () => {
    const { fascia, puntiAlti } = calcolaFasciaOMI({
      ...BASE, classe_energetica: 'ALTA', esposizione: 'OTTIMA', vista: 'PREGIATA', qualita_costruzione: 'PREGIATA',
    });
    expect(puntiAlti).toBe(4);
    expect(fascia).toBe('ALTA');
  });

  test('6 caratteristiche alte (tutte) → ALTA', () => {
    const tutteAlte = {
      classe_energetica: 'ALTA',
      esposizione: 'OTTIMA',
      vista: 'PREGIATA',
      qualita_costruzione: 'PREGIATA',
      luminosita: 'OTTIMA',
      stato_conservazione: 'OTTIMO',
    };
    const { fascia, puntiAlti } = calcolaFasciaOMI(tutteAlte);
    expect(puntiAlti).toBe(6);
    expect(fascia).toBe('ALTA');
  });

  test('valori scritti in minuscolo o non riconosciuti non contano come "alti" (confronto case-sensitive)', () => {
    const { fascia, puntiAlti } = calcolaFasciaOMI({
      classe_energetica: 'alta',
      esposizione: 'ottima',
      vista: 'pregiata',
      qualita_costruzione: undefined,
      luminosita: null,
      stato_conservazione: 'SUPER',
    });
    expect(puntiAlti).toBe(0);
    expect(fascia).toBe('BASSA');
  });
});
