# Riepilogo Modifiche - Formato NETMON

## 📋 Modifiche Implementate

### 1. Struttura Messaggio JSON
Il formato è stato cambiato da struttura gerarchica a formato NETMON flat:

**PRIMA:**
```json
{
  "timestamp": "...",
  "period": { "start": "...", "end": "..." },
  "service": "Amazon EC2",
  "cost": { "amount": 123.45, "currency": "USD" },
  ...
}
```

**DOPO (NETMON):**
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

### 2. Mapping Servizi AWS → Protocolli

Implementato mapping dei principali servizi AWS:

| Servizio | Codice | Nome | Categoria |
|----------|--------|------|-----------|
| Amazon EC2 | 100 | AWS_EC2 | Compute |
| Amazon S3 | 101 | AWS_S3 | Storage |
| Amazon RDS | 102 | AWS_RDS | Database |
| Amazon DynamoDB | 103 | AWS_DynamoDB | Database |
| AWS Lambda | 104 | AWS_Lambda | Compute |
| Amazon CloudFront | 105 | AWS_CloudFront | CDN |
| Amazon ECS | 106 | AWS_ECS | Compute |
| Amazon EKS | 107 | AWS_EKS | Compute |
| Amazon ElastiCache | 108 | AWS_ElastiCache | Cache |
| Amazon VPC | 109 | AWS_VPC | Network |
| Amazon Route 53 | 110 | AWS_Route53 | DNS |
| AWS Config | 111 | AWS_Config | Management |
| Amazon CloudWatch | 112 | AWS_CloudWatch | Monitoring |
| Amazon SNS | 113 | AWS_SNS | Messaging |
| Amazon SQS | 114 | AWS_SQS | Messaging |
| Amazon Kinesis | 115 | AWS_Kinesis | Streaming |
| AWS KMS | 116 | AWS_KMS | Security |
| Altri | 199 | AWS_OTHER | Other |

### 3. Calcolo Campo _BYTES

Il costo viene convertito secondo la formula:
```javascript
const costBytes = Math.round(costAmount * 100);
```

Esempi:
- $123.45 → 12345
- $0.50 → 50
- $1234.56 → 123456

### 4. Parametri NETMON Configurabili

Nuove variabili d'ambiente:
- `NETMON_IP`: IP sorgente (default: 0.0.0.0)
- `NETMON_VLAN`: Identificativo VLAN (default: AWS)
- `NETMON_SIM`: Numero SIM (default: 000000000000)
- `NETMON_DIR`: Direzione traffico (default: 0)

### 5. File Aggiornati

- ✅ `src/index.js` - Logica di trasformazione e mapping
- ✅ `k8s/configmap.yaml` - Parametri NETMON aggiunti
- ✅ `.env.example` - Template con nuovi parametri
- ✅ `README.md` - Documentazione aggiornata
- ✅ `NETMON_FORMAT.md` - Documentazione formato completa
- ✅ `test-netmon-format.js` - Script di test

## 🧪 Test

Esegui il test locale:
```bash
node test-netmon-format.js
```

Output atteso:
```
Message 1:
Key: Amazon EC2-2024-01-14
Value:
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

## 📦 Deploy

Nessuna modifica necessaria al deployment Kubernetes esistente.
I parametri NETMON sono già inclusi nel ConfigMap.

## 🔄 Compatibilità

⚠️ **Breaking Change**: Il formato dei messaggi è completamente diverso.
I consumer Kafka devono essere aggiornati per gestire il nuovo formato NETMON.
