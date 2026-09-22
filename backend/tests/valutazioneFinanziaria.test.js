const { calcolaRataMutuo, calcolaDCF } = require('../services/valutazioneFinanziaria');

describe('calcolaRataMutuo', () => {
  test('restituisce 0 se il tasso annuo è 0 (mutuo a tasso zero, caso limite gestito esplicitamente)', () => {
    expect(calcolaRataMutuo(100000, 0, 20)).toBe(0);
  });

  test('restituisce 0 se la durata è 0 anni (nessuna rata da calcolare)', () => {
    expect(calcolaRataMutuo(100000, 5, 0)).toBe(0);
  });

  test('calcola la rata con ammortamento alla francese per un caso normale', () => {
    // 100.000€ finanziati, tasso 5% annuo, 20 anni: rata mensile attesa 659.96€
    expect(calcolaRataMutuo(100000, 5, 20)).toBe(659.96);
  });
});

describe('calcolaDCF', () => {
  const parametriEsempio = {
    prezzo_acquisto: 150000,
    costi_acquisto_pct: 10,
    canone_mensile: 800,
    orizzonte_anni: 5,
    tasso_attualizzazione_pct: 6,
    metodo_exit: 'reddituale',
    cap_rate_exit_pct: 5,
  };

  test('senza mutuo (ltv_pct assente), tutto l\'investimento è equity', () => {
    const risultato = calcolaDCF(parametriEsempio);

    expect(risultato.investimento_totale).toBe(165000); // 150000 + 15000 costi acquisto
    expect(risultato.equity).toBe(165000);
    expect(risultato.debito).toBe(0);
    expect(risultato.rata_mensile).toBe(0);
  });

  test('calcola correttamente NOI base, VAN, TIR, ROI e Cash-on-Cash su un caso verificato', () => {
    const risultato = calcolaDCF(parametriEsempio);

    expect(risultato.noi_base_annuo).toBe(9120);
    expect(risultato.van).toBe(20864);
    expect(risultato.tir_pct).toBe(8.82);
    expect(risultato.roi_totale_pct).toBe(47.15);
    expect(risultato.cash_on_cash_pct).toBe(5.53);
  });

  test('segna investimento_conveniente=true quando il VAN è positivo', () => {
    const risultato = calcolaDCF(parametriEsempio);

    expect(risultato.van).toBeGreaterThan(0);
    expect(risultato.investimento_conveniente).toBe(true);
  });

  test('produce un dettaglio cash flow per ogni anno dell\'orizzonte, con l\'exit value solo sull\'ultimo', () => {
    const risultato = calcolaDCF(parametriEsempio);

    expect(risultato.cashflows_dettaglio).toHaveLength(5);
    expect(risultato.cashflows_dettaglio[0].exit_value).toBeUndefined();
    expect(risultato.cashflows_dettaglio[4].exit_value).toBe(195343);
  });
});
