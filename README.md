# AWS Cost Explorer to Kafka Service

Servizio Node.js per leggere periodicamente i costi AWS e pubblicarli su Kafka.

## Quick Start
```bash
npm install
cp .env.example .env
# Configura .env
npm start
```

## Docker
```bash
docker build -t aws-cost-service .
docker run --env-file .env aws-cost-service
```

## Kubernetes
```bash
kubectl apply -f k8s/
```
