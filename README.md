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
- **Account AWS con IAM User/Role** ([Guida Setup AWS →](AWS_IAM_SETUP.md))
- Kafka cluster

### ⚡ Setup Rapido AWS

```bash
# Script automatico per creare IAM User e Policy
./scripts/setup-aws-iam.sh
```

📖 Per dettagli completi vedi [AWS_IAM_SETUP.md](AWS_IAM_SETUP.md)

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

## 📊 Formato Messaggi Kafka (NETMON)

I messaggi seguono il formato NETMON standard:

```json
{
  "_L7_PROTO": "100",
  "_L7_PROTO_NAME": "AWS_EC2",
  "_L7_PROTO_CATEGORY": "Compute",
  "_IP": "0.0.0.0",
  "_VLAN": "AWS",
  "_DIR": 0,
  "_SIM": "000000000000",
  "_DATE": 1705190400,
  "_BYTES": 12345
}
```

- `_L7_PROTO`: Codice servizio AWS (100=EC2, 101=S3, 102=RDS, ecc.)
- `_BYTES`: Costo moltiplicato per 100 senza decimali ($123.45 → 12345)
- `_DATE`: Timestamp Unix del periodo

📖 Vedi [NETMON_FORMAT.md](NETMON_FORMAT.md) per la documentazione completa

## 🔐 Permessi AWS Richiesti

Policy IAM minima necessaria:

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

📖 **Guida completa configurazione AWS:** [AWS_IAM_SETUP.md](AWS_IAM_SETUP.md)
- Creazione IAM User con Access Keys
- Configurazione IAM Role con IRSA (per EKS)
- Script automatico di setup
- Best practices di sicurezza

## 📝 Licenza

Proprietà di Technacy Milano
