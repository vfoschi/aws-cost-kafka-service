# Sistema di Calcolo Differenziale dei Costi

## 📊 Panoramica

Il servizio calcola e pubblica su Kafka la **differenza incrementale** dei costi tra due letture successive, invece del costo totale accumulato.

## 🔄 Come Funziona

### Esempio Pratico

```
Lettura 1 (08:00):  AWS EC2 = $10.50  →  Pubblica: $10.50  (1050 bytes)
Lettura 2 (08:05):  AWS EC2 = $10.75  →  Pubblica: $0.25   (25 bytes)
Lettura 3 (08:10):  AWS EC2 = $11.00  →  Pubblica: $0.25   (25 bytes)
Lettura 4 (08:15):  AWS EC2 = $11.00  →  Skip (nessuna differenza)
Lettura 5 (08:20):  AWS EC2 = $11.50  →  Pubblica: $0.50   (50 bytes)
```

### Cache Interna

Il servizio mantiene in memoria l'ultimo valore letto per ogni servizio:

```javascript
costCache = {
  "Amazon EC2-2024-11-27": 11.50,
  "Amazon S3-2024-11-27": 5.23,
  "Amazon RDS-2024-11-27": 23.45
}
```

## 📝 Logica di Calcolo

### Step 1: Lettura Costi AWS

```javascript
currentCost = AWS_API.getCost("EC2", "2024-11-27");  // $11.00
```

### Step 2: Recupero Valore Precedente

```javascript
previousCost = costCache.get("EC2-2024-11-27");  // $10.75
```

### Step 3: Calcolo Differenza

```javascript
difference = currentCost - previousCost;  // $11.00 - $10.75 = $0.25
```

### Step 4: Pubblicazione (se > 0)

```javascript
if (difference > 0) {
  publish({
    _BYTES: Math.round(difference * 100),  // 25
    ...
  });
}
```

### Step 5: Aggiornamento Cache

```javascript
costCache.set("EC2-2024-11-27", currentCost);  // Salva $11.00
```

## 💾 Gestione Cache

### Inizializzazione

Alla prima esecuzione, la cache è vuota:
- `previousCost = 0`
- `difference = currentCost - 0 = currentCost`
- Prima pubblicazione = costo totale

### Persistenza

⚠️ **La cache è in memoria (Map)**
- ✅ Veloce e semplice
- ❌ Persa al restart del pod
- ❌ Non condivisa tra repliche

**Conseguenza:** Al restart, la prima lettura pubblicherà di nuovo il costo totale.

### Pulizia Cache

La cache viene pulita automaticamente a mezzanotte (nuovo giorno):

```javascript
// Pseudocodice
if (newDay) {
  costCache.clear();  // Reset per nuovo giorno
}
```

## 📊 Formato Messaggi Kafka

### Messaggio con Differenza

```json
{
  "_L7_PROTO": "100",
  "_L7_PROTO_NAME": "AWS_EC2",
  "_L7_PROTO_CATEGORY": "Compute",
  "_IP": "0.0.0.0",
  "_VLAN": "AWS",
  "_DIR": 0,
  "_SIM": "000000000000",
  "_DATE": 1732704000,
  "_BYTES": 25
}
```

**_BYTES = 25** significa che il costo è aumentato di **$0.25**

### Calcolo Inverso

Per ottenere la differenza in dollari:

```javascript
costDifference = _BYTES / 100;  // 25 / 100 = $0.25
```

## 🔍 Log di Debug

Il servizio logga ogni operazione:

```json
{
  "service": "Amazon EC2",
  "currentCost": 11.00,
  "previousCost": 10.75,
  "difference": 0.25,
  "bytes": 25,
  "proto": "100",
  "msg": "Cost difference calculated and message created"
}
```

### Quando non pubblica

```json
{
  "service": "Amazon S3",
  "current": 5.23,
  "previous": 5.23,
  "difference": 0,
  "msg": "No cost increase, skipping message"
}
```

## ⚙️ Configurazione

Nessuna configurazione aggiuntiva necessaria. Il sistema funziona automaticamente con:

```bash
FETCH_INTERVAL_MINUTES=5  # Intervallo di polling
```

## 🧪 Test Scenario

### Scenario: Monitoraggio EC2 in un'ora

```
08:00  →  EC2 = $10.00  →  Kafka: 1000 bytes  (prima lettura, costo totale)
08:05  →  EC2 = $10.00  →  Nessun messaggio (nessuna differenza)
08:10  →  EC2 = $10.50  →  Kafka: 50 bytes    (+$0.50)
08:15  →  EC2 = $10.75  →  Kafka: 25 bytes    (+$0.25)
08:20  →  EC2 = $10.75  →  Nessun messaggio (nessuna differenza)
08:25  →  EC2 = $11.00  →  Kafka: 25 bytes    (+$0.25)
```

**Totale pubblicato:** 1000 + 50 + 25 + 25 = 1100 bytes = **$11.00** ✅

## 🚨 Casi Edge

### 1. Restart del Servizio

```
Prima del restart:   Cache = { "EC2-2024-11-27": 15.00 }
Dopo il restart:     Cache = {}
Prima lettura:       EC2 = $15.00  →  Pubblica 1500 bytes (costo totale)
```

**Soluzione:** Il sistema NETMON deve gestire reset periodici.

### 2. Costo Negativo (Credito AWS)

```
Lettura 1:  EC2 = $10.00
Lettura 2:  EC2 = $9.50  (credito applicato)
```

**Comportamento:** Differenza negativa = **Skip** (nessun messaggio)

### 3. Cambio Giorno

```
23:55  →  EC2 = $100.00  (2024-11-27)
00:05  →  EC2 = $0.50    (2024-11-28)  →  Pubblica 50 bytes (nuovo giorno)
```

La cache usa chiave `service-date`, quindi giorni diversi = chiavi diverse.

## 📈 Vantaggi Sistema Differenziale

### ✅ Pro
1. **Evita duplicati**: Non ripubblica lo stesso costo
2. **Riduce traffico Kafka**: Solo quando ci sono variazioni
3. **Facilita aggregazione**: Somma semplice dei bytes
4. **Traccia incrementi**: Identifica spike di costo

### ❌ Contro
1. **Cache in memoria**: Reset al restart pod
2. **Non distribuito**: Multiple repliche potrebbero avere cache diverse
3. **Nessuna persistenza**: Storia persa al crash

## 🔧 Miglioramenti Futuri

### Opzione 1: Cache Persistente (Redis)

```javascript
// Usa Redis invece di Map
const redis = require('redis');
const cache = redis.createClient();

costCache.get = (key) => cache.get(key);
costCache.set = (key, val) => cache.set(key, val);
```

**Pro:** Sopravvive ai restart, condivisibile tra repliche

### Opzione 2: Database

```javascript
// Salva storico in PostgreSQL/MongoDB
await db.costs.insert({
  service: "EC2",
  date: "2024-11-27",
  cost: 11.00,
  timestamp: Date.now()
});
```

**Pro:** Storico completo, analytics

## 📊 Monitoraggio

### Metriche Consigliate

```javascript
// Counter: Messaggi pubblicati
messagesPublished.inc({ service: "EC2" });

// Gauge: Dimensione cache
cacheSize.set(costCache.size);

// Histogram: Differenze di costo
costDifferences.observe(difference);
```

## 🎯 Best Practices

1. **Intervallo consigliato:** 5-15 minuti per bilanciare tempestività e costi API
2. **Monitoring:** Traccia dimensione cache e reset
3. **Alerting:** Notifica su differenze anomale (spike > threshold)
4. **Logging:** Usa `LOG_LEVEL=debug` per troubleshooting

## ❓ FAQ

**Q: Cosa succede al primo avvio?**
A: Pubblica il costo totale corrente (cache vuota = previous = 0)

**Q: E se il pod viene riavviato?**
A: Comportamento identico al primo avvio

**Q: Come gestire deployment con multiple repliche?**
A: Usa cache condivisa (Redis) oppure assicurati che solo 1 replica sia attiva

**Q: Posso disabilitare il calcolo differenziale?**
A: No, è il comportamento di default. Per costo totale, modifica il codice.
