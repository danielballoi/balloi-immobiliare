const { calcolaReddituale } = require('../services/valutazioneReddituale');

describe('calcolaReddituale', () => {
  test('restituisce un oggetto definito con tutti i campi anche senza prezzo_acquisto (regressione bug if senza graffe)', () => {
    const risultato = calcolaReddituale({ canone_mensile: 1000, cap_rate_pct: 5 });

    expect(risultato).toBeDefined();
    expect(risultato).toEqual(
      expect.objectContaining({
        canone_mensile: 1000,
        cap_rate_pct: 5,
        prezzo_acquisto: null,
        rendimento_lordo_pct: null,
        rendimento_netto_pct: null,
      })
    );
  });

  test('calcola correttamente reddito lordo, sfitto, NOI e valore di mercato', () => {
    const risultato = calcolaReddituale({ canone_mensile: 1000, cap_rate_pct: 5 });

    expect(risultato.reddito_lordo_annuo).toBe(12000);
    expect(risultato.perdita_sfitto).toBe(600);
    expect(risultato.reddito_effettivo).toBe(11400);
    expect(risultato.noi_annuo).toBe(11400);
    expect(risultato.valore_mercato).toBe(228000);
  });

  test('sottrae le spese annue dal NOI', () => {
    const risultato = calcolaReddituale({ canone_mensile: 1000, cap_rate_pct: 5, spese_annue: 1400 });

    expect(risultato.noi_annuo).toBe(10000);
    expect(risultato.valore_mercato).toBe(200000);
  });

  test('calcola i rendimenti percentuali solo quando prezzo_acquisto è presente e positivo', () => {
    const risultato = calcolaReddituale({ canone_mensile: 1000, cap_rate_pct: 5, prezzo_acquisto: 200000 });

    expect(risultato.rendimento_lordo_pct).toBe(6);
    expect(risultato.rendimento_netto_pct).toBe(5.7);
  });

  test('non calcola i rendimenti percentuali se prezzo_acquisto è 0 o negativo', () => {
    const risultato = calcolaReddituale({ canone_mensile: 1000, cap_rate_pct: 5, prezzo_acquisto: 0 });

    expect(risultato.rendimento_lordo_pct).toBeNull();
    expect(risultato.rendimento_netto_pct).toBeNull();
  });

  test('calcola il canone annuo al mq solo se superficie_mq è maggiore di 0', () => {
    const conSuperficie = calcolaReddituale({ canone_mensile: 1000, cap_rate_pct: 5, superficie_mq: 100 });
    const senzaSuperficie = calcolaReddituale({ canone_mensile: 1000, cap_rate_pct: 5 });

    expect(conSuperficie.canone_annuo_mq).toBe(120);
    expect(senzaSuperficie.canone_annuo_mq).toBeNull();
  });
});
