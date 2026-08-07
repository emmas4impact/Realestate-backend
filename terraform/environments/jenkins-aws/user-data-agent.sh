#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

apt-get update -y

# -----------------------------------------------------------------------------
# Add swap for small EC2 instances like t3.micro
# -----------------------------------------------------------------------------
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# -----------------------------------------------------------------------------
# Base packages
# -----------------------------------------------------------------------------
apt-get install -y \
  openjdk-21-jdk \
  docker.io \
  git \
  curl \
  wget \
  unzip \
  jq \
  ca-certificates \
  gnupg \
  nodejs \
  npm

# -----------------------------------------------------------------------------
# Docker setup
# -----------------------------------------------------------------------------
systemctl enable docker
systemctl start docker

usermod -aG docker ubuntu

# -----------------------------------------------------------------------------
# Jenkins agent workspace
# -----------------------------------------------------------------------------
mkdir -p /home/ubuntu/jenkins
chown -R ubuntu:ubuntu /home/ubuntu/jenkins

# -----------------------------------------------------------------------------
# AWS CLI v2
# -----------------------------------------------------------------------------
if ! command -v aws >/dev/null 2>&1; then
  cd /tmp
  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
  unzip -q awscliv2.zip
  ./aws/install
  rm -rf aws awscliv2.zip
fi

# -----------------------------------------------------------------------------
# kubectl
# -----------------------------------------------------------------------------
if ! command -v kubectl >/dev/null 2>&1; then
  cd /tmp
  curl -LO "https://dl.k8s.io/release/stable.txt"
  KUBECTL_VERSION="$(cat stable.txt)"
  curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl"
  install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
  rm -f kubectl stable.txt
fi

# -----------------------------------------------------------------------------
# Helm
# -----------------------------------------------------------------------------
if ! command -v helm >/dev/null 2>&1; then
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

# -----------------------------------------------------------------------------
# Helmfile
# -----------------------------------------------------------------------------
if ! command -v helmfile >/dev/null 2>&1; then
  cd /tmp
  HELMFILE_VERSION="1.1.7"
  wget "https://github.com/helmfile/helmfile/releases/download/v${HELMFILE_VERSION}/helmfile_${HELMFILE_VERSION}_linux_amd64.tar.gz"
  tar -xzf "helmfile_${HELMFILE_VERSION}_linux_amd64.tar.gz"
  mv helmfile /usr/local/bin/helmfile
  chmod +x /usr/local/bin/helmfile
  rm -f "helmfile_${HELMFILE_VERSION}_linux_amd64.tar.gz"
fi

# -----------------------------------------------------------------------------
# Terraform
# -----------------------------------------------------------------------------
if ! command -v terraform >/dev/null 2>&1; then
  cd /tmp
  TERRAFORM_VERSION="1.10.5"
  wget "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip"
  unzip -q "terraform_${TERRAFORM_VERSION}_linux_amd64.zip"
  mv terraform /usr/local/bin/terraform
  chmod +x /usr/local/bin/terraform
  rm -f "terraform_${TERRAFORM_VERSION}_linux_amd64.zip"
fi

# -----------------------------------------------------------------------------
# Verify tools
# -----------------------------------------------------------------------------
java -version
docker --version
aws --version
kubectl version --client=true
helm version
helmfile --version
terraform version
node --version || true
npm --version || true