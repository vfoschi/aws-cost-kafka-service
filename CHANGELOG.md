# Changelog

## [1.1.0] - 2024-11-27

### 🎯 Feature Principale: Calcolo Differenziale dei Costi

#### Added
- **Sistema di cache in-memory** per tracciare costi precedenti
- **Calcolo automatico delle differenze** tra letture successive
- Pubblicazione solo dell'**incremento di costo** invece del totale
- Skip automatico messaggi quando differenza = 0
- Logging dettagliato delle differenze calcolate

#### Changed
- Campo `_BYTES` ora contiene la **differenza** di costo × 100
- Prima pubblicazione: costo totale (cache vuota)
- Letture successive: solo incremento

#### Example
```
Lettura 1: EC2 = $10.50 → Pubblica: 1050 bytes
Lettura 2: EC2 = $10.75 → Pubblica: 25 bytes (+$0.25)
Lettura 3: EC2 = $11.00 → Pubblica: 25 bytes (+$0.25)
```

#### Documentation
- Added `docs/DIFFERENTIAL_COST_CALCULATION.md` - Guida completa
- Updated README.md con sezione calcolo differenziale
- Updated NETMON_FORMAT.md con esempio differenziale

---

## [1.0.0] - 2024-11-27

### Initial Release

#### Features
- Lettura costi AWS Cost Explorer API
- Pubblicazione messaggi Kafka formato NETMON
- Mapping servizi AWS a protocolli L7
- Supporto Docker multi-stage
- Configurazione Kubernetes completa
- Supporto IAM User e IRSA (EKS)
- Intervalli configurabili
- Logging strutturato con Pino

#### Documentation
- README.md completo
- AWS_IAM_SETUP.md - Setup IAM dettagliato
- NETMON_FORMAT.md - Formato messaggi
- QUICKSTART.md - Setup rapido
- AWS_GRANULARITY.md - Guida granularità
- AWS_CLI_PROFILES.md - Profili multipli

#### Scripts
- setup-aws-iam.sh - Automazione IAM
- setup-aws-iam-with-profile.sh - Con profili

#### Configuration
- .env.example
- k8s/configmap.yaml
- k8s/deployment.yaml
- k8s/secret.yaml.example
- k8s/serviceaccount.yaml
