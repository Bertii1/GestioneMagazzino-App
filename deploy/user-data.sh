#!/bin/bash
set -euo pipefail

# Aggiorna il sistema
dnf update -y

# Installa SSM Agent (accesso sicuro senza SSH)
dnf install -y amazon-ssm-agent
systemctl enable amazon-ssm-agent
systemctl start amazon-ssm-agent

# Installa Docker
dnf install -y docker git
systemctl enable docker
systemctl start docker

# Installa Docker Compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Aggiungi ec2-user al gruppo docker
usermod -aG docker ec2-user

# Crea directory app
mkdir -p /opt/magazzino
chown ec2-user:ec2-user /opt/magazzino

echo "Setup completato" > /opt/magazzino/setup-done
