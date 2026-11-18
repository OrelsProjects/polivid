#!/usr/bin/env bash
# Deploys a commit to the PoliVid worker instance (EC2, tag Name=polivid-worker).
#
#   npm run worker:deploy            deploys HEAD
#   npm run worker:deploy -- <ref>   deploys a branch, tag, or commit
#
# Only committed code ships (git archive), so uncommitted work never reaches the worker.
# Needs the AWS CLI signed in to the account, and AWS_S3_BUCKET in .env / .env.local.
# Production-only values (AUTH_SECRET, APP_PUBLIC_URL) go in .env.worker, which git ignores.
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-us-east-1}"
REF="${1:-HEAD}"
SHA="$(git rev-parse --short=12 "$REF")"
BUCKET="$(node -e 'const {parse}=require("dotenv");const fs=require("fs");let v={};for(const f of [".env",".env.local"]) if(fs.existsSync(f)) Object.assign(v,parse(fs.readFileSync(f)));process.stdout.write(v.AWS_S3_BUCKET||"")')"
[[ -n "$BUCKET" ]] || { echo "AWS_S3_BUCKET is not set in .env or .env.local."; exit 1; }
KEY="_deploy/worker/$SHA.tar.gz"
ENV_PARAM="/polivid/worker/env"

INSTANCE="$(aws ec2 describe-instances --region "$REGION" \
  --filters Name=tag:Name,Values=polivid-worker Name=instance-state-name,Values=running \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)"
[[ "$INSTANCE" != "None" && -n "$INSTANCE" ]] || { echo "No running instance tagged polivid-worker."; exit 1; }

if [[ "$REF" == "HEAD" && -n "$(git status --porcelain)" ]]; then
  echo "Note: you have uncommitted changes. They are not deployed; only $SHA is."
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Packing $SHA"
git archive --format=tar.gz -o "$TMP/release.tar.gz" "$REF"
aws s3 cp --region "$REGION" --only-show-errors "$TMP/release.tar.gz" "s3://$BUCKET/$KEY"

echo "Updating the worker's environment"
node scripts/worker-env.mjs "$TMP/worker.env"
aws ssm put-parameter --region "$REGION" --name "$ENV_PARAM" --type SecureString --tier Intelligent-Tiering \
  --overwrite --value "file://$TMP/worker.env" >/dev/null

echo "Releasing on $INSTANCE"
COMMANDS=$(cat <<EOF
set -euo pipefail
mkdir -p /opt/polivid/releases/$SHA
aws s3 cp --region $REGION --only-show-errors s3://$BUCKET/$KEY /tmp/polivid-$SHA.tar.gz
tar -xzf /tmp/polivid-$SHA.tar.gz -C /opt/polivid/releases/$SHA
rm -f /tmp/polivid-$SHA.tar.gz
bash /opt/polivid/releases/$SHA/deploy/worker/release.sh $SHA $REGION
EOF
)
PARAMS="$(node -e 'process.stdout.write(JSON.stringify({commands: process.argv[1].split("\n"), executionTimeout: ["1800"]}))' "$COMMANDS")"
COMMAND_ID="$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE" \
  --document-name AWS-RunShellScript --comment "polivid worker $SHA" \
  --parameters "$PARAMS" --query Command.CommandId --output text)"

echo "Waiting for the release to finish (npm ci can take a few minutes)"
while true; do
  STATUS="$(aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" --instance-id "$INSTANCE" --query Status --output text 2>/dev/null || echo Pending)"
  case "$STATUS" in
    Success|Failed|Cancelled|TimedOut) break ;;
  esac
  sleep 10
done

aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" --instance-id "$INSTANCE" \
  --query '[StandardOutputContent, StandardErrorContent]' --output text | tail -n 60
echo "Release $SHA: $STATUS"
[[ "$STATUS" == "Success" ]]
