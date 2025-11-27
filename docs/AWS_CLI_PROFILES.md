# Guida AWS CLI Profili Multipli

## 📚 Panoramica

AWS CLI supporta profili multipli per gestire credenziali di account/utenti diversi.

## 🔧 Configurazione Profili

### Metodo 1: Comando Interattivo (Consigliato)

```bash
# Crea un nuovo profilo chiamato "cost-service"
aws configure --profile cost-service
```

Ti chiederà:
```
AWS Access Key ID [None]: AKIA...
AWS Secret Access Key [None]: ...
Default region name [None]: eu-west-1
Default output format [None]: json
```

### Metodo 2: Modifica Manuale File

#### File ~/.aws/credentials

```bash
nano ~/.aws/credentials
```

Contenuto:
```ini
[default]
aws_access_key_id = AKIA...principale...
aws_secret_access_key = ...principale...

[cost-service]
aws_access_key_id = AKIA...cost-service...
aws_secret_access_key = ...cost-service...

[produzione]
aws_access_key_id = AKIA...produzione...
aws_secret_access_key = ...produzione...
```

#### File ~/.aws/config

```bash
nano ~/.aws/config
```

Contenuto:
```ini
[default]
region = eu-west-1
output = json

[profile cost-service]
region = eu-west-1
output = json

[profile produzione]
region = us-east-1
output = json
```

**⚠️ Nota:** Nel file config, i profili hanno il prefisso `profile`, tranne `[default]`

## 🎯 Utilizzo dei Profili

### Opzione 1: Variabile d'Ambiente AWS_PROFILE

```bash
# Imposta profilo per la sessione corrente
export AWS_PROFILE=cost-service

# Verifica quale profilo è attivo
echo $AWS_PROFILE

# Tutti i comandi useranno questo profilo
aws sts get-caller-identity
aws s3 ls
aws ec2 describe-instances

# Disattiva (torna a default)
unset AWS_PROFILE
```

### Opzione 2: Flag --profile per Comando Singolo

```bash
# Usa un profilo specifico per un singolo comando
aws sts get-caller-identity --profile cost-service
aws s3 ls --profile produzione

# Ogni comando richiede il flag
aws ce get-cost-and-usage \
  --profile cost-service \
  --time-period Start=2024-11-01,End=2024-11-02 \
  --granularity DAILY \
  --metrics UnblendedCost
```

## 🚀 Esempi Pratici

### Scenario 1: Setup Iniziale

```bash
# 1. Configura profilo amministratore (già esistente)
aws configure --profile admin

# 2. Configura profilo per cost service
aws configure --profile cost-service

# 3. Verifica profili configurati
aws configure list-profiles
```

Output:
```
default
admin
cost-service
```

### Scenario 2: Creazione IAM User con Profilo Specifico

```bash
# Usa profilo amministratore per creare risorse
export AWS_PROFILE=admin

# Esegui script di setup
./scripts/setup-aws-iam.sh

# Oppure con profilo inline
AWS_PROFILE=admin ./scripts/setup-aws-iam-with-profile.sh
```

### Scenario 3: Test Permessi per Profilo

```bash
# Test con profilo cost-service
aws sts get-caller-identity --profile cost-service

# Verifica permessi Cost Explorer
aws ce get-cost-and-usage \
  --profile cost-service \
  --time-period Start=2024-11-01,End=2024-11-02 \
  --granularity DAILY \
  --metrics UnblendedCost
```

## 📋 Gestione Profili

### Lista Profili Configurati

```bash
# Mostra tutti i profili
aws configure list-profiles

# Mostra configurazione profilo specifico
aws configure list --profile cost-service
```

### Visualizza Credenziali Attive

```bash
# Mostra quale account/user stai usando
aws sts get-caller-identity

# Con profilo specifico
aws sts get-caller-identity --profile cost-service
```

Output:
```json
{
    "UserId": "AIDAIOSFODNN7EXAMPLE",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/aws-cost-kafka-service"
}
```

### Modifica Profilo Esistente

```bash
# Aggiorna singolo parametro
aws configure set region us-west-2 --profile cost-service
aws configure set output yaml --profile cost-service

# Verifica modifiche
aws configure get region --profile cost-service
```

### Elimina Profilo

```bash
# Rimuovi manualmente dai file
nano ~/.aws/credentials  # Elimina sezione [cost-service]
nano ~/.aws/config       # Elimina sezione [profile cost-service]
```

## 🔐 Best Practices

### 1. Separazione Ambienti

```ini
[default]
# Account personale/sviluppo

[staging]
# Account staging

[production]
# Account produzione (credenziali limitate)
```

### 2. Naming Convention

```bash
# Usa nomi descrittivi
aws configure --profile technacy-prod
aws configure --profile technacy-staging
aws configure --profile client-acme-prod
```

### 3. Assume Role con Profili

```ini
# ~/.aws/config
[profile base-user]
region = eu-west-1
output = json

[profile admin-role]
role_arn = arn:aws:iam::123456789012:role/AdminRole
source_profile = base-user
region = eu-west-1
```

Uso:
```bash
# Assume automaticamente il ruolo
aws s3 ls --profile admin-role
```

### 4. MFA con Profili

```ini
[profile mfa-protected]
region = eu-west-1
mfa_serial = arn:aws:iam::123456789012:mfa/username
```

## 🛠️ Script con Profili

### Script Bash

```bash
#!/bin/bash
PROFILE=${AWS_PROFILE:-default}

echo "Using profile: $PROFILE"
aws sts get-caller-identity --profile "$PROFILE"
```

### Script con Selezione Profilo

```bash
#!/bin/bash

# Lista profili disponibili
echo "Profili disponibili:"
aws configure list-profiles

# Chiedi quale usare
read -p "Seleziona profilo: " PROFILE

# Esegui comando
AWS_PROFILE=$PROFILE aws sts get-caller-identity
```

## 🐛 Troubleshooting

### Errore: "The config profile (X) could not be found"

```bash
# Verifica che il profilo esista
aws configure list-profiles

# Ricrea il profilo
aws configure --profile X
```

### Errore: "Unable to locate credentials"

```bash
# Verifica file credenziali
cat ~/.aws/credentials

# Verifica permessi file
ls -la ~/.aws/

# I file devono essere leggibili solo da te
chmod 600 ~/.aws/credentials
chmod 600 ~/.aws/config
```

### Quale Profilo è Attivo?

```bash
# Controlla variabile d'ambiente
echo $AWS_PROFILE

# Oppure
aws configure list
```

## 📖 Riferimenti Utili

### Comandi Rapidi

```bash
# Lista profili
aws configure list-profiles

# Verifica identità
aws sts get-caller-identity --profile NOME

# Cambia regione temporaneamente
AWS_REGION=us-east-1 aws s3 ls --profile NOME

# Usa profilo per sessione
export AWS_PROFILE=NOME
```

### File Locations

- **Credentials**: `~/.aws/credentials`
- **Config**: `~/.aws/config`
- **Windows**: `%USERPROFILE%\.aws\`

## 🎯 Scenario Completo: Setup Nuovo Profilo

```bash
# 1. Crea profilo
aws configure --profile cost-service
# Inserisci: Access Key, Secret Key, region, output

# 2. Verifica configurazione
aws configure list --profile cost-service

# 3. Test connessione
aws sts get-caller-identity --profile cost-service

# 4. Test permessi specifici
aws ce get-cost-and-usage \
  --profile cost-service \
  --time-period Start=2024-11-01,End=2024-11-02 \
  --granularity DAILY \
  --metrics UnblendedCost

# 5. Usa nel servizio (imposta in .env)
cat >> .env << EOF
AWS_PROFILE=cost-service
EOF
```

Fatto! Ora hai profili multipli configurati! 🚀
