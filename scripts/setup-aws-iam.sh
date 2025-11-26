#!/bin/bash
# Script per creare automaticamente IAM User e Policy su AWS
# Prerequisiti: AWS CLI configurato con permessi amministrativi

set -e

POLICY_NAME="aws-cost-explorer-read-only"
USER_NAME="aws-cost-kafka-service"
REGION="${AWS_REGION:-eu-west-1}"

echo "=========================================="
echo "AWS IAM Setup for Cost Explorer Service"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI non trovato${NC}"
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS CLI non configurato${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓${NC} AWS Account ID: $ACCOUNT_ID"
echo ""

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

if aws iam get-policy --policy-arn "arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}" &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  Policy già esistente, skip..."
    POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
else
    POLICY_ARN=$(aws iam create-policy \
        --policy-name "$POLICY_NAME" \
        --policy-document "$POLICY_DOCUMENT" \
        --description "Read-only access to AWS Cost Explorer" \
        --query 'Policy.Arn' \
        --output text)
    echo -e "${GREEN}✓${NC} Policy creata: $POLICY_ARN"
fi
echo ""

echo "Step 2: Creazione IAM User..."
if aws iam get-user --user-name "$USER_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  User già esistente, skip..."
else
    aws iam create-user --user-name "$USER_NAME"
    echo -e "${GREEN}✓${NC} User creato: $USER_NAME"
fi
echo ""

echo "Step 3: Assegnazione Policy all'User..."
if aws iam list-attached-user-policies --user-name "$USER_NAME" | grep -q "$POLICY_NAME"; then
    echo -e "${YELLOW}⚠${NC}  Policy già assegnata, skip..."
else
    aws iam attach-user-policy \
        --user-name "$USER_NAME" \
        --policy-arn "$POLICY_ARN"
    echo -e "${GREEN}✓${NC} Policy assegnata all'user"
fi
echo ""

echo "Step 4: Creazione Access Keys..."
echo -e "${YELLOW}⚠${NC}  Creazione nuove access keys..."
echo ""

ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "$USER_NAME")
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
echo -e "${RED}   Non potrai più visualizzare la Secret Key dopo questa schermata.${NC}"
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

echo -e "${GREEN}Test delle credenziali:${NC}"
echo "aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-02 --granularity DAILY --metrics UnblendedCost"
