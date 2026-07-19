FROM jenkins/jenkins:lts-jdk17

USER root

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    unzip \
    gnupg \
    lsb-release \
    ca-certificates \
    git \
    jq \
    nodejs \
    npm \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Install Terraform directly from HashiCorp release binary
ARG TERRAFORM_VERSION=1.10.5

RUN wget https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip \
    && unzip terraform_${TERRAFORM_VERSION}_linux_amd64.zip \
    && mv terraform /usr/local/bin/terraform \
    && chmod +x /usr/local/bin/terraform \
    && rm terraform_${TERRAFORM_VERSION}_linux_amd64.zip

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/stable.txt" \
    && KUBECTL_VERSION=$(cat stable.txt) \
    && curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/amd64/kubectl" \
    && install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl \
    && rm kubectl stable.txt

# Install Helm
RUN curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install Helmfile
ARG HELMFILE_VERSION=1.1.7

RUN wget https://github.com/helmfile/helmfile/releases/download/v${HELMFILE_VERSION}/helmfile_${HELMFILE_VERSION}_linux_amd64.tar.gz \
    && tar -xzf helmfile_${HELMFILE_VERSION}_linux_amd64.tar.gz \
    && mv helmfile /usr/local/bin/helmfile \
    && chmod +x /usr/local/bin/helmfile \
    && rm helmfile_${HELMFILE_VERSION}_linux_amd64.tar.gz

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf aws awscliv2.zip

# Allow Jenkins user to use Docker socket if mounted
RUN usermod -aG docker jenkins

USER jenkins