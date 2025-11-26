# Quick Start Guide

Guida rapida per avviare il servizio in 5 minuti.

## 1️⃣ Setup AWS (2 minuti)

### Opzione A: Script Automatico (Consigliato)
```bash
# Richiede AWS CLI configurato
./scripts/setup-aws-iam.sh
```

Lo script crea automaticamente:
- IAM Policy: `aws-cost-explorer-read-only`
- IAM User: `aws-cost-kafka-service`
- Access Keys (mostrate a schermo)

### Opzione B: Manuale
Segui la guida: [AWS_IAM_SETUP.md](AWS_IAM_SETUP.md)

## 2️⃣ Configurazione Locale (1 minuto)

```bash
# Copia template
cp .env.example .env

# Modifica .env con le credenziali AWS ricevute
nano .env
```

Configura almeno:
```bash
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
KAFKA_BROKERS=your-kafka-broker:9092
KAFKA_TOPIC=aws-costs
```

## 3️⃣ Test Locale (1 minuto)

```bash
# Installa dipendenze
npm install

# Avvia il servizio
npm start
```

Output atteso:
```
Starting AWS Cost Kafka Service
Kafka producer connected
Fetching AWS costs
AWS costs fetched successfully
Messages published successfully
```

## 4️⃣ Deploy Docker (1 minuto)

```bash
# Build
docker build -t aws-cost-service:latest .

# Run
docker run --rm --env-file .env aws-cost-service:latest
```

## 5️⃣ Deploy Kubernetes (2 minuti)

```bash
# Crea namespace
kubectl create namespace monitoring

# Crea secret con credenziali
kubectl create secret generic aws-cost-service-secrets \
  --from-literal=AWS_ACCESS_KEY_ID='AKIA...' \
  --from-literal=AWS_SECRET_ACCESS_KEY='...' \
  --namespace=monitoring

# Configura broker Kafka in configmap
nano k8s/configmap.yaml

# Deploy
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml

# Verifica
kubectl get pods -n monitoring
kubectl logs -n monitoring -l app=aws-cost-service -f
```

## ✅ Verifica Funzionamento

### Check 1: Logs
Cerca nei logs:
```
✓ AWS costs fetched successfully
✓ Messages published successfully
✓ messagesPublished: X
```

### Check 2: Kafka
Verifica che i messaggi arrivino su Kafka:
```bash
# Esempio con kafkacat
kafkacat -C -b your-kafka-broker:9092 -t aws-costs -o end
```

### Check 3: Formato Messaggi
Verifica che i messaggi abbiano il formato NETMON:
```json
{
  "_L7_PROTO": "100",
  "_L7_PROTO_NAME": "AWS_EC2",
  "_L7_PROTO_CATEGORY": "Compute",
  "_BYTES": 12345
}
```

## 🔧 Personalizzazione

### Cambia Intervallo
```bash
# .env
FETCH_INTERVAL_MINUTES=120  # Ogni 2 ore invece di 1
```

### Cambia Granularità
```bash
# .env
GRANULARITY=HOURLY  # DAILY, MONTHLY, HOURLY
LOOKBACK_DAYS=7     # Ultimi 7 giorni
```

### Personalizza NETMON
```bash
# .env
NETMON_IP=10.8.193.94
NETMON_VLAN=PRODUZIONE
NETMON_SIM=393488628060
```

## ❌ Troubleshooting

### Errore: "User is not authorized"
→ Verifica IAM policy assegnata all'user
→ Attendi 1-2 minuti per propagazione

### Errore: "No cost data returned"
→ Account AWS nuovo? Serve 24-48h di storico
→ Prova con `LOOKBACK_DAYS=7`

### Errore: "Connection refused" (Kafka)
→ Verifica `KAFKA_BROKERS` sia raggiungibile
→ Test: `telnet kafka-broker 9092`

## 📚 Documentazione Completa

- [AWS IAM Setup](AWS_IAM_SETUP.md) - Guida completa AWS
- [NETMON Format](NETMON_FORMAT.md) - Formato messaggi
- [README](README.md) - Documentazione principale
- [CHANGELOG](CHANGELOG.md) - Modifiche versioni

## 💰 Costi Previsti

- **AWS Cost Explorer API**: ~$7/mese (con intervallo 60 min)
- **Kubernetes**: Dipende dal cluster
- **Kafka**: Dipende dall'infrastruttura

Totale stimato: **< $10/mese**

## 🎯 Next Steps

1. ✅ Servizio funzionante
2. Configure consumer Kafka per elaborare i dati
3. Setup monitoring con Grafana/Prometheus
4. Configura alerting per costi anomali
5. Estendi mapping servizi AWS in `src/index.js`

---

**Servizio pronto in 5 minuti! 🚀**
