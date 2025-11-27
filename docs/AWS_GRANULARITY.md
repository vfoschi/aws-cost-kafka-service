# AWS Cost Explorer - Granularità e Intervalli

## 📊 Granularità Disponibili

AWS Cost Explorer supporta tre livelli di granularità:

### 1. DAILY (Giornaliera) ✅ Consigliata

```bash
GRANULARITY=DAILY
```

**Caratteristiche:**
- ✅ Disponibile per **tutti i periodi**
- ✅ Dati disponibili per **ultimi 13 mesi**
- ✅ Aggiornamento: **Più volte al giorno**
- ✅ Latenza: **8-12 ore** per dati completi
- ✅ Costo: **$0.01 per richiesta** (dopo prime 10/mese)

**Quando usare:**
- Per monitoraggio costi giornaliero
- Per analisi trend settimanali/mensili
- **DEFAULT per la maggior parte dei casi**

### 2. MONTHLY (Mensile)

```bash
GRANULARITY=MONTHLY
```

**Caratteristiche:**
- ✅ Disponibile per **tutti i periodi**
- ✅ Dati disponibili per **ultimi 13 mesi**
- ✅ Aggiornamento: **Giornaliero**

**Quando usare:**
- Per report mensili
- Per budget annuali
- Per analisi long-term

### 3. HOURLY (Oraria) ⚠️ Limitata

```bash
GRANULARITY=HOURLY
```

**Caratteristiche:**
- ⚠️ **Solo ultimi 14 giorni**
- ⚠️ **Non tutti i servizi supportati**
- ⚠️ Dati meno accurati
- ✅ Aggiornamento: **Più volte al giorno**

**Quando usare:**
- Per debug costi anomali recenti
- Per analisi dettagliate spot
- **NON per monitoraggio continuo**

## 🔄 Intervalli di Fetch vs Granularità

### Scenario 1: Monitoraggio Frequente (✅ Configurazione Attuale)

```bash
FETCH_INTERVAL_MINUTES=5  # Fetch ogni 5 minuti
GRANULARITY=DAILY         # Granularità giornaliera
LOOKBACK_DAYS=1           # Solo oggi
```

**Cosa succede:**
- 🕐 **08:00** → Fetch costi giorno corrente: $10.50
- 🕐 **08:05** → Fetch costi giorno corrente: $10.75 ← AWS ha aggiornato!
- 🕐 **08:10** → Fetch costi giorno corrente: $11.00 ← AWS ha aggiornato!

**Messaggi Kafka:**
- Stesso giorno, _DATE uguale
- _BYTES diverso (costo aggiornato)
- Consumer può tracciare evoluzione costi in tempo quasi-reale

**Pro:**
- ✅ Rileva rapidamente spike di costi
- ✅ Near real-time monitoring
- ✅ Dati sempre del giorno corrente

**Contro:**
- ❌ ~8,640 chiamate/mese = **~$86/mese di costi API**
- ❌ Molti messaggi duplicati/simili su Kafka

### Scenario 2: Monitoraggio Orario (Bilanciato)

```bash
FETCH_INTERVAL_MINUTES=60  # Fetch ogni ora
GRANULARITY=DAILY          # Granularità giornaliera
LOOKBACK_DAYS=1            # Solo oggi
```

**Cosa succede:**
- 24 fetch/giorno
- ~720 chiamate/mese = **~$7/mese**

**Pro:**
- ✅ Buon compromesso costi/tempestività
- ✅ Rileva anomalie entro 1 ora
- ✅ Costi API ragionevoli

**Contro:**
- ⏱️ Meno tempestivo (max 1h di ritardo)

### Scenario 3: Monitoraggio Giornaliero (Economico)

```bash
FETCH_INTERVAL_MINUTES=1440  # Fetch ogni 24 ore
GRANULARITY=DAILY            # Granularità giornaliera
LOOKBACK_DAYS=7              # Ultimi 7 giorni
```

**Cosa succede:**
- 1 fetch/giorno
- ~30 chiamate/mese = **~$0.20/mese**

**Pro:**
- ✅ Economico
- ✅ Sufficienti per report giornalieri
- ✅ Costi API minimi

**Contro:**
- ⏱️ Rileva anomalie solo giorno dopo

## 💰 Calcolo Costi AWS Cost Explorer API

### Formula
```
Costi = (Chiamate mensili - 10) × $0.01
```

### Esempi con FETCH_INTERVAL_MINUTES

| Intervallo | Chiamate/Giorno | Chiamate/Mese | Costo/Mese |
|-----------|----------------|---------------|------------|
| 5 min | 288 | 8,640 | **$86.30** |
| 15 min | 96 | 2,880 | **$28.70** |
| 30 min | 48 | 1,440 | **$14.30** |
| 60 min | 24 | 720 | **$7.10** |
| 120 min | 12 | 360 | **$3.50** |
| 360 min | 4 | 120 | **$1.10** |
| 1440 min (1 giorno) | 1 | 30 | **$0.20** |

## 🎯 Raccomandazioni per Caso d'Uso

### Caso 1: Monitoraggio Produzione Critico
```bash
FETCH_INTERVAL_MINUTES=15  # Ogni 15 minuti
GRANULARITY=DAILY
LOOKBACK_DAYS=1
```
**Costo:** ~$28/mese | **Rilevamento anomalie:** ~15 minuti

### Caso 2: Monitoraggio Standard (✅ CONSIGLIATO)
```bash
FETCH_INTERVAL_MINUTES=60  # Ogni ora
GRANULARITY=DAILY
LOOKBACK_DAYS=1
```
**Costo:** ~$7/mese | **Rilevamento anomalie:** ~1 ora

### Caso 3: Reporting Giornaliero
```bash
FETCH_INTERVAL_MINUTES=1440  # Una volta al giorno
GRANULARITY=DAILY
LOOKBACK_DAYS=7
```
**Costo:** ~$0.20/mese | **Storico:** 7 giorni

### Caso 4: Monitoraggio Aggressivo (Tua Config Attuale)
```bash
FETCH_INTERVAL_MINUTES=5   # Ogni 5 minuti
GRANULARITY=DAILY
LOOKBACK_DAYS=1
```
**Costo:** ~$86/mese | **Rilevamento:** ~5 minuti

⚠️ **Nota:** AWS aggiorna i costi ogni 8-12 ore, quindi fetch più frequenti potrebbero vedere gli stessi dati

## ❓ FAQ

### Q: Posso usare GRANULARITY=HOURLY con fetch ogni 5 minuti?

**A:** Tecnicamente sì, ma:
- ⚠️ Solo ultimi 14 giorni disponibili
- ⚠️ Non tutti i servizi hanno dati orari
- ⚠️ Costi maggiori (stessa API)
- ⚠️ Dati meno affidabili

**Meglio usare DAILY** anche con fetch frequenti.

### Q: I costi AWS si aggiornano in tempo reale?

**A:** No. AWS aggiorna i costi con latenza di:
- **8-12 ore** per dati completi
- **Più volte al giorno** per stime parziali
- **24-48 ore** per finalizzazione

### Q: Ha senso fare fetch ogni 5 minuti?

**A:** Dipende:
- ✅ Se serve rilevamento rapido anomalie → Sì
- ✅ Se il budget API lo permette ($86/mese) → Sì  
- ❌ Se serve solo report giornaliero → No (usa 60+ min)

### Q: Come ridurre i costi API mantenendo monitoring?

**A:** Opzioni:
1. Aumenta `FETCH_INTERVAL_MINUTES` a 60 o 120
2. Cache i risultati se identici (implementa in servizio)
3. Usa LOOKBACK_DAYS=0 se supportato (solo oggi)

## 🔧 Configurazione Finale Consigliata

Per **bilanciare costi e tempestività**:

```bash
# .env o ConfigMap
FETCH_INTERVAL_MINUTES=60    # Ogni ora ($7/mese)
LOOKBACK_DAYS=1              # Solo oggi
GRANULARITY=DAILY            # Limitazione AWS
GROUP_BY=SERVICE             # Per servizio

# Se budget permette e serve rilevamento rapido:
FETCH_INTERVAL_MINUTES=15    # Ogni 15 min ($28/mese)
```

## 📊 Riepilogo

| Parametro | Valore Raccomandato | Motivo |
|-----------|-------------------|--------|
| GRANULARITY | **DAILY** | Unica pratica per monitoring continuo |
| FETCH_INTERVAL_MINUTES | **60** | Bilanciato costi/tempestività |
| LOOKBACK_DAYS | **1** | Solo giorno corrente |

**Con config a 5 minuti:** Va bene tecnicamente, ma considera i costi API (~$86/mese).
