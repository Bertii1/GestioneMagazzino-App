#!/usr/bin/env bash
# Setup GitHub Actions OIDC → AWS IAM for deploy workflow
# Run once from local machine with AWS admin access.
#
# Usage:
#   chmod +x deploy/setup-github-oidc.sh
#   ./deploy/setup-github-oidc.sh
#
# Prerequisites:
#   - AWS CLI v2 configured with admin permissions
#   - gh CLI authenticated (for setting repo secret)
set -euo pipefail

REGION="eu-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
GITHUB_ORG="Bertii1"
GITHUB_REPO="GestioneMagazzino-App"
ROLE_NAME="GitHubActions-Deploy-Magazzino"
POLICY_NAME="GitHubActions-Deploy-Magazzino-Policy"
EC2_INSTANCE_ID="${EC2_INSTANCE_ID:?Imposta EC2_INSTANCE_ID (es. i-0123456789abcdef0)}"
OIDC_PROVIDER="token.actions.githubusercontent.com"

echo "=== GitHub OIDC → AWS IAM setup ==="
echo "Account:  $ACCOUNT_ID"
echo "Region:   $REGION"
echo "Repo:     $GITHUB_ORG/$GITHUB_REPO"
echo ""

# ── 1. Create OIDC Identity Provider (idempotent) ────────────────────────────
PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_PROVIDER}"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$PROVIDER_ARN" &>/dev/null; then
  echo "✓ OIDC provider already exists"
else
  echo "→ Creating OIDC provider..."
  aws iam create-open-id-connect-provider \
    --url "https://${OIDC_PROVIDER}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" \
    --tags Key=Project,Value=GestioneMagazzino
  echo "✓ OIDC provider created"
fi

# ── 2. Create IAM Role with trust policy ─────────────────────────────────────
TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_PROVIDER}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "${OIDC_PROVIDER}:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "${OIDC_PROVIDER}:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF
)

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

if aws iam get-role --role-name "$ROLE_NAME" &>/dev/null; then
  echo "✓ IAM role already exists, updating trust policy..."
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document "$TRUST_POLICY"
else
  echo "→ Creating IAM role..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "GitHub Actions deploy for GestioneMagazzino" \
    --tags Key=Project,Value=GestioneMagazzino \
    --query 'Role.Arn' --output text
  echo "✓ IAM role created"
fi

# ── 3. Attach inline policy (SSM send-command + read output) ─────────────────
DEPLOY_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SSMSendCommand",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ssm:${REGION}::document/AWS-RunShellScript",
        "arn:aws:ec2:${REGION}:${ACCOUNT_ID}:instance/${EC2_INSTANCE_ID}"
      ]
    },
    {
      "Sid": "SSMReadResults",
      "Effect": "Allow",
      "Action": [
        "ssm:GetCommandInvocation",
        "ssm:ListCommands",
        "ssm:ListCommandInvocations"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

echo "→ Attaching deploy policy..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "$DEPLOY_POLICY"
echo "✓ Policy attached"

# ── 4. Set GitHub repo secret ────────────────────────────────────────────────
echo ""
echo "→ Setting AWS_DEPLOY_ROLE_ARN secret on GitHub repo..."
gh secret set AWS_DEPLOY_ROLE_ARN \
  --repo "${GITHUB_ORG}/${GITHUB_REPO}" \
  --body "$ROLE_ARN"
echo "✓ Secret set"

# ── 5. Summary ───────────────────────────────────────────────────────────────
echo ""
echo "=== Setup complete ==="
echo "OIDC Provider: $PROVIDER_ARN"
echo "IAM Role:      $ROLE_ARN"
echo "Policy:        $POLICY_NAME (inline)"
echo "GH Secret:     AWS_DEPLOY_ROLE_ARN → $ROLE_ARN"
echo ""
echo "Test: push to main (server/** changes) or run workflow manually:"
echo "  gh workflow run deploy.yml --repo ${GITHUB_ORG}/${GITHUB_REPO}"
