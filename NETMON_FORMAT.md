# Formato Messaggi NETMON

## Struttura JSON

I messaggi pubblicati su Kafka seguono il formato NETMON:

```json
{
  "_L7_PROTO": "100",
  "_L7_PROTO_NAME": "AWS_EC2",
  "_L7_PROTO_CATEGORY": "Compute",
  "_IP": "0.0.0.0",
  "_VLAN": "AWS",
  "_DIR": 0,
  "_SIM": "000000000000",
  "_DATE": 1763868576,
  "_BYTES": 12345
}
```

## Campi

### Campi Protocollo (Servizio AWS)
- `_L7_PROTO`: Codice numerico del servizio AWS
- `_L7_PROTO_NAME`: Nome identificativo del servizio
- `_L7_PROTO_CATEGORY`: Categoria del servizio

### Campi NETMON
- `_IP`: Indirizzo IP (configurabile, default: 0.0.0.0)
- `_VLAN`: VLAN identificativa (configurabile, default: AWS)
- `_DIR`: Direzione traffico (default: 0)
- `_SIM`: Numero SIM (configurabile)
- `_DATE`: Timestamp Unix del periodo
- `_BYTES`: Costo moltiplicato per 100 senza decimali

## Mapping Servizi AWS

| Servizio AWS | _L7_PROTO | _L7_PROTO_NAME | _L7_PROTO_CATEGORY |
|--------------|-----------|----------------|-------------------|
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
| Altri servizi | 199 | AWS_OTHER | Other |

## Calcolo _BYTES

Il campo `_BYTES` contiene il costo del servizio AWS:
- Costo originale: `$123.45`
- Moltiplicato per 100: `12345`
- Senza decimali: `12345`

Esempio:
```javascript
const costAmount = 123.45; // USD
const costBytes = Math.round(costAmount * 100); // 12345
```

## Esempio Completo

Costo AWS EC2 del 14/01/2024: **$123.45**

Messaggio Kafka generato:
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

## Configurazione Parametri NETMON

Configura i parametri NETMON tramite variabili d'ambiente:

```bash
NETMON_IP=10.8.193.94
NETMON_VLAN=TEAMSYSTEM
NETMON_SIM=393488628060
NETMON_DIR=0
```

O tramite ConfigMap Kubernetes:

```yaml
NETMON_IP: "10.8.193.94"
NETMON_VLAN: "TEAMSYSTEM"
NETMON_SIM: "393488628060"
NETMON_DIR: "0"
```

## Aggiungere Nuovi Servizi

Per mappare nuovi servizi AWS, modifica il file `src/index.js`:

```javascript
const SERVICE_PROTO_MAP = {
  'Nuovo Servizio AWS': { 
    proto: '117', 
    name: 'AWS_NUOVO_SERVIZIO', 
    category: 'Categoria' 
  },
  // ...
};
```
