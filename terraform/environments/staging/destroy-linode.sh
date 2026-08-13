#!/bin/bash
set -euo pipefail

echo "WARNING: This will destroy the Linode staging infrastructure managed by Terraform."
echo ""
echo "Directory:"
pwd
echo ""

if [ "${1:-}" != "destroy" ]; then
  echo "Usage:"
  echo "  ./destroy-linode.sh destroy"
  echo ""
  echo "This safety check prevents accidental deletion."
  exit 1
fi

if [ -z "${LINODE_TOKEN:-}" ]; then
  echo "ERROR: LINODE_TOKEN is not set."
  echo ""
  echo "Run:"
  echo "  export LINODE_TOKEN=your_linode_token"
  exit 1
fi

echo "Initializing Terraform..."
terraform init -input=false

echo "Validating Terraform..."
terraform validate

echo "Creating destroy plan..."
terraform plan -destroy -out=linode-destroy.tfplan

echo ""
echo "Destroy plan created: linode-destroy.tfplan"
echo "Applying destroy plan in 10 seconds..."
echo "Press CTRL+C now to cancel."
sleep 10

terraform apply linode-destroy.tfplan

echo "Cleaning up destroy plan..."
rm -f linode-destroy.tfplan

echo "Linode Terraform-managed resources destroyed."