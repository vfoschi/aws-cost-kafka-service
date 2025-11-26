# Configurazione AWS IAM per Cost Explorer

Guida completa per configurare l'accesso AWS necessario al servizio.

## 📋 Opzioni di Autenticazione

### Opzione 1: IAM User con Access Keys (Più Semplice)
Consigliata per test e ambienti non-EKS

### Opzione 2: IAM Role con IRSA (Consigliata per Produzione EKS)
Consigliata per ambienti produzione su Amazon EKS

---

## Opzione 1: IAM User con Access Keys

### Step 1: Crea IAM Policy

1. Accedi alla AWS Console
2. Vai su **IAM** → **Policies** → **Create Policy**
3. Seleziona la tab **JSON**
4. Incolla la seguente policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CostExplorerReadAccess",
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetCostAndUsageWithResources",
        "ce:GetCostForecast",
        "ce:GetDimensionValues",
        "ce:GetTags",
        "ce:GetReservationUtilization",
        "ce:GetReservationCoverage"
      ],
      "Resource": "*"
    }
  ]
}
```

5. Click **Next**
6. Nome policy: `aws-cost-explorer-read-only`
7. Descrizione: `Read-only access to AWS Cost Explorer for cost reporting`
8. Click **Create Policy**

### Step 2: Crea IAM User

1. Vai su **IAM** → **Users** → **Create User**
2. Nome utente: `aws-cost-kafka-service`
3. **Non** selezionare "Provide user access to AWS Management Console"
4. Click **Next**

### Step 3: Assegna Policy all'User

1. Seleziona **Attach policies directly**
2. Cerca e seleziona: `aws-cost-explorer-read-only`
3. Click **Next**
4. Click **Create User**

### Step 4: Genera Access Keys

1. Vai su **IAM** → **Users** → `aws-cost-kafka-service`
2. Tab **Security Credentials**
3. Sezione **Access Keys** → Click **Create access key**
4. Seleziona use case: **Application running outside AWS**
5. Click **Next**
6. Description tag: `Cost Explorer Kafka Service`
7. Click **Create access key**
8. **⚠️ IMPORTANTE**: Copia e salva in modo sicuro:
   - Access Key ID
   - Secret Access Key
   
   **Non potrai più visualizzare la Secret Key dopo questa schermata!**

9. Click **Done**

### Step 5: Configura il Servizio

#### Per deploy locale/Docker:

Modifica il file `.env`:
```bash
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=AKIA...your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

#### Per deploy Kubernetes:

Crea il Secret:
```bash
kubectl create secret generic aws-cost-service-secrets \
  --from-literal=AWS_ACCESS_KEY_ID='AKIA...your-access-key-id' \
  --from-literal=AWS_SECRET_ACCESS_KEY='your-secret-access-key' \
  --namespace=monitoring
```

Oppure modifica `k8s/secret.yaml.example`:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: aws-cost-service-secrets
  namespace: monitoring
type: Opaque
stringData:
  AWS_ACCESS_KEY_ID: "AKIA...your-access-key-id"
  AWS_SECRET_ACCESS_KEY: "your-secret-access-key"
```

Applica:
```bash
kubectl apply -f k8s/secret.yaml
```

---

## Opzione 2: IAM Role con IRSA (Solo per EKS)

### Prerequisiti
- Cluster Amazon EKS
- OIDC provider configurato sul cluster
- kubectl configurato

### Step 1: Crea IAM Policy

Segui **Step 1** dell'Opzione 1 per creare la policy `aws-cost-explorer-read-only`

### Step 2: Ottieni OIDC Provider del Cluster

```bash
# Ottieni OIDC provider URL
aws eks describe-cluster \
  --name your-cluster-name \
  --query "cluster.identity.oidc.issuer" \
  --output text
```

Output esempio: `https://oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLED539D4633E53DE1B71EXAMPLE`

Estrai l'ID: `EXAMPLED539D4633E53DE1B71EXAMPLE`

### Step 3: Crea IAM Role

1. Vai su **IAM** → **Roles** → **Create Role**
2. Trusted entity type: **Web identity**
3. Identity provider: Seleziona il tuo OIDC provider EKS
4. Audience: `sts.amazonaws.com`
5. Click **Next**

### Step 4: Configura Trust Relationship

Sostituisci la trust policy con:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/oidc.eks.REGION.amazonaws.com/id/CLUSTER_OIDC_ID"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "oidc.eks.REGION.amazonaws.com/id/CLUSTER_OIDC_ID:sub": "system:serviceaccount:monitoring:aws-cost-service",
          "oidc.eks.REGION.amazonaws.com/id/CLUSTER_OIDC_ID:aud": "sts.amazonaws.com"
        }
      }
    }
  ]
}
```

**Sostituisci:**
- `YOUR_ACCOUNT_ID` con il tuo AWS Account ID
- `REGION` con la regione del cluster (es. `eu-west-1`)
- `CLUSTER_OIDC_ID` con l'ID OIDC del tuo cluster
- `monitoring` con il namespace dove deployerai il servizio
- `aws-cost-service` con il nome del ServiceAccount

### Step 5: Assegna Policy al Role

1. Cerca e seleziona: `aws-cost-explorer-read-only`
2. Click **Next**
3. Nome role: `aws-cost-service-role`
4. Descrizione: `IAM role for AWS Cost Explorer Kafka Service`
5. Click **Create Role**

### Step 6: Copia ARN del Role

1. Vai su **IAM** → **Roles** → `aws-cost-service-role`
2. Copia l'ARN del role (formato: `arn:aws:iam::123456789012:role/aws-cost-service-role`)

### Step 7: Configura ServiceAccount Kubernetes

Modifica `k8s/serviceaccount.yaml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: aws-cost-service
  namespace: monitoring
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::YOUR_ACCOUNT_ID:role/aws-cost-service-role
  labels:
    app: aws-cost-service
```

### Step 8: Aggiorna Deployment

Modifica `k8s/deployment.yaml` per usare il ServiceAccount:

```yaml
spec:
  template:
    spec:
      serviceAccountName: aws-cost-service
      containers:
      - name: aws-cost-service
        # ... resto della configurazione
        # RIMUOVI env per AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY
```

### Step 9: Deploy su EKS

```bash
kubectl apply -f k8s/serviceaccount.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
```

---

## 🔍 Verifica Permessi

### Test con AWS CLI

```bash
# Configura credenziali
export AWS_ACCESS_KEY_ID="your-key"
export AWS_SECRET_ACCESS_KEY="your-secret"
export AWS_REGION="eu-west-1"

# Test Cost Explorer API
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-02 \
  --granularity DAILY \
  --metrics UnblendedCost
```

Se il comando restituisce dati, i permessi sono corretti!

### Test dal Pod Kubernetes

```bash
# Ottieni nome del pod
POD_NAME=$(kubectl get pod -n monitoring -l app=aws-cost-service -o jsonpath='{.items[0].metadata.name}')

# Controlla i logs
kubectl logs -n monitoring $POD_NAME -f

# Cerca per:
# "AWS costs fetched successfully"
```

---

## 🔒 Best Practices di Sicurezza

### 1. Limita i Permessi
La policy fornita è già minimal, include solo lettura Cost Explorer.

### 2. Rotazione Credenziali
Per IAM Users:
- Ruota le Access Keys ogni 90 giorni
- Non condividere mai le Secret Keys
- Non committare keys nel codice

### 3. Usa IRSA in Produzione
- Più sicuro (no credenziali statiche)
- Rotazione automatica dei token
- Audit trail migliore

### 4. Monitoring
Abilita CloudTrail per tracciare chiamate API:
- Eventi: `GetCostAndUsage`, `GetCostForecast`
- User: `aws-cost-kafka-service` o role ARN

### 5. Least Privilege
Se non usi tutte le API, rimuovile dalla policy:

Policy minimal (solo GetCostAndUsage):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ce:GetCostAndUsage",
      "Resource": "*"
    }
  ]
}
```

---

## 📊 Costi AWS

**Cost Explorer API:**
- Prime 10 richieste/mese: **GRATIS**
- Richieste successive: **$0.01 per richiesta**

**Calcolo costi servizio:**
- 1 richiesta ogni 60 minuti = 24 richieste/giorno
- 720 richieste/mese
- Costo: (720 - 10) × $0.01 = **$7.10/mese**

**Suggerimento:** Aumenta `FETCH_INTERVAL_MINUTES` per ridurre i costi:
- 60 minuti (default) = ~$7/mese
- 120 minuti (2 ore) = ~$3.50/mese
- 360 minuti (6 ore) = ~$1/mese

---

## 🆘 Troubleshooting

### Errore: "User is not authorized to perform: ce:GetCostAndUsage"

**Causa:** Policy non assegnata o errata

**Soluzione:**
1. Verifica che la policy sia assegnata all'user/role
2. Verifica che la policy contenga `ce:GetCostAndUsage`
3. Attendi 1-2 minuti per la propagazione

### Errore: "The security token included in the request is invalid"

**Causa:** Credenziali errate o scadute

**Soluzione:**
1. Verifica `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`
2. Verifica che l'user non sia stato disabilitato
3. Per IRSA: verifica annotation ServiceAccount

### Errore: "No cost data returned from AWS"

**Causa:** Account AWS nuovo o senza costi

**Soluzione:**
1. L'account deve avere almeno 24-48 ore di storia
2. Verifica che ci siano risorse attive che generano costi
3. Prova con `LOOKBACK_DAYS=7` per periodi più lunghi

---

## 📞 Supporto

Per problemi di configurazione AWS:
- AWS Support: https://console.aws.amazon.com/support
- AWS Documentation: https://docs.aws.amazon.com/cost-management/

Per problemi con il servizio:
- GitHub Issues: https://github.com/vfoschi/aws-cost-kafka-service/issues
