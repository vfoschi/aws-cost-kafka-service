#!/bin/bash
# Script per creare automaticamente IAM User e Policy su AWS
# Usa un profilo AWS specifico

set -e

# Configurazione
POLICY_NAME="aws-cost-explorer-read-only"
USER_NAME="aws-cost-kafka-service"
REGION="${AWS_REGION:-eu-west-1}"
AWS_PROFILE="${AWS_PROFILE:-default}"  # Usa profilo specificato o default

echo "=========================================="
echo "AWS IAM Setup for Cost Explorer Service"
echo "Using AWS Profile: $AWS_PROFILE"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verifica AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI non trovato${NC}"
    exit 1
fi

# Verifica credenziali AWS con il profilo specificato
if ! aws sts get-caller-identity --profile "$AWS_PROFILE" &> /dev/null; then
    echo -e "${RED}❌ AWS CLI non configurato per il profilo: $AWS_PROFILE${NC}"
    echo "Configura il profilo con: aws configure --profile $AWS_PROFILE"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)
echo -e "${GREEN}✓${NC} AWS Account ID: $ACCOUNT_ID"
echo -e "${GREEN}✓${NC} Using Profile: $AWS_PROFILE"
echo ""

# Step 1: Crea Policy
echo "Step 1: Creazione IAM Policy..."

POLICY_DOCUMENT='{
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
        "ce:GetTags"
      ],
      "Resource": "*"
    }
  ]
}'

if aws iam get-policy --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}" --profile "$AWS_PROFILE" &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Policy già esistente, skip..."
    POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
else
    POLICY_ARN=$(aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document "$POLICY_DOCUMENT" \
        --description "Read-only access to AWS Cost Explorer" \
        --profile "$AWS_PROFILE" \
        --query 'Policy.Arn' \
        --output text)
    echo -e "${GREEN}✓${NC} Policy creata: $POLICY_ARN"
fi
echo ""

# Step 2: Crea User
echo "Step 2: Creazione IAM User..."
if aws iam get-user --user-name "$USER_NAME" --profile "$AWS_PROFILE" &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  User già esistente, skip..."
else
    aws iam create-user --user-name "$USER_NAME" --profile "$AWS_PROFILE"
    echo -e "${GREEN}✓${NC} User creato: $USER_NAME"
fi
echo ""

# Step 3: Assegna Policy
echo "Step 3: Assegnazione Policy all'User..."
if aws iam list-attached-user-policies --user-name "$USER_NAME" --profile "$AWS_PROFILE" | grep -q "$POLICY_NAME"; then
    echo -e "${YELLOW}⚠${NC}  Policy già assegnata, skip..."
else
    aws iam attach-user-policy \
        --user-name "$USER_NAME" \
        --policy-arn "$POLICY_ARN" \
        --profile "$AWS_PROFILE"
    echo -e "${GREEN}✓${NC} Policy assegnata all'user"
fi
echo ""

# Step 4: Crea Access Keys
echo "Step 4: Creazione Access Keys..."
echo -e "${YELLOW}⚠${NC}  Creazione nuove access keys..."
echo ""

ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "$USER_NAME" --profile "$AWS_PROFILE")
ACCESS_KEY_ID=$(echo "$ACCESS_KEY_OUTPUT" | grep -o '"AccessKeyId": "[^"]*' | cut -d'"' -f4)
SECRET_ACCESS_KEY=$(echo "$ACCESS_KEY_OUTPUT" | grep -o '"SecretAccessKey": "[^"]*' | cut -d'"' -f4)

echo "=========================================="
echo "✅ Setup completato!"
echo "=========================================="
echo ""
echo -e "${GREEN}Access Key ID:${NC}"
echo "$ACCESS_KEY_ID"
echo ""
echo -e "${GREEN}Secret Access Key:${NC}"
echo "$SECRET_ACCESS_KEY"
echo ""
echo -e "${RED}⚠️  IMPORTANTE: Salva queste credenziali in modo sicuro!${NC}"
echo ""

echo "Configurazione .env:"
echo "---"
cat << EOF
AWS_REGION=$REGION
AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY
EOF
echo "---"
echo ""

echo "Configurazione Kubernetes Secret:"
echo "---"
cat << EOF
kubectl create secret generic aws-cost-service-secrets \\
  --from-literal=AWS_ACCESS_KEY_ID='$ACCESS_KEY_ID' \\
  --from-literal=AWS_SECRET_ACCESS_KEY='$SECRET_ACCESS_KEY' \\
  --namespace=monitoring
EOF
echo "---"
echo ""

echo "Configurazione AWS CLI Profile:"
echo "---"
cat << EOF
aws configure --profile cost-service-readonly
# Inserisci:
#   Access Key ID: $ACCESS_KEY_ID
#   Secret Access Key: $SECRET_ACCESS_KEY
#   Region: $REGION
#   Output: json
EOF
echo "---"
