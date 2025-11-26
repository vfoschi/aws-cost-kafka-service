# AWS Cost Explorer to Kafka Service

Servizio Node.js containerizzato che legge periodicamente i costi dei servizi AWS tramite Cost Explorer API e li pubblica su un topic Kafka.

## 🎯 Caratteristiche

- ✅ Lettura automatica dei costi AWS tramite Cost Explorer API
- ✅ Pubblicazione strutturata su Kafka con formato JSON
- ✅ Intervalli di esecuzione configurabili
- ✅ Supporto per SASL/SSL su Kafka
- ✅ Logging strutturato con Pino
- ✅ Graceful shutdown
- ✅ Container ottimizzato per produzione
- ✅ Configurazione Kubernetes completa
- ✅ Supporto per AWS IAM Roles (IRSA su EKS)

## 📋 Prerequisiti

- Node.js 20+
- Docker
- Kubernetes cluster
- Account AWS con permessi su Cost Explorer
- Kafka cluster

## 🚀 Quick Start

### 1. Configurazione Locale

```bash
# Installa dipendenze
npm install

# Configura variabili d'ambiente
cp .env.example .env
# Modifica .env con le tue credenziali

# Avvia in modalità sviluppo
npm start
```

### 2. Build Docker

```bash
# Build dell'immagine
docker build -t aws-cost-service:latest .

# Push su registry
docker tag aws-cost-service:latest your-registry/aws-cost-service:latest
docker push your-registry/aws-cost-service:latest
```

### 3. Deploy su Kubernetes

```bash
# Crea secret con credenziali
kubectl create secret generic aws-cost-service-secrets \
  --from-literal=AWS_ACCESS_KEY_ID='your-key' \
  --from-literal=AWS_SECRET_ACCESS_KEY='your-secret' \
  --namespace=monitoring

# Deploy
kubectl apply -f k8s/

# Verifica
kubectl get pods -n monitoring -l app=aws-cost-service
kubectl logs -n monitoring -l app=aws-cost-service -f
```

## ⚙️ Configurazione

### Variabili d'Ambiente

- `AWS_REGION`: Regione AWS (default: `eu-west-1`)
- `KAFKA_BROKERS`: Lista broker (default: `localhost:9092`)
- `KAFKA_TOPIC`: Topic Kafka (default: `aws-costs`)
- `FETCH_INTERVAL_MINUTES`: Intervallo in minuti (default: `60`)
- `GRANULARITY`: `DAILY`, `MONTHLY`, `HOURLY` (default: `DAILY`)

## 📊 Formato Messaggi Kafka

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "period": {
    "start": "2024-01-14",
    "end": "2024-01-15"
  },
  "service": "Amazon EC2",
  "cost": {
    "amount": 123.45,
    "currency": "USD"
  },
  "usage": {
    "quantity": 720.0,
    "unit": "Hrs"
  },
  "metadata": {
    "granularity": "DAILY",
    "groupBy": "SERVICE",
    "region": "eu-west-1"
  }
}
```

## 🔐 Permessi AWS Richiesti

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage"
      ],
      "Resource": "*"
    }
  ]
}
```

## 📝 Licenza

Proprietà di Technacy Milano
