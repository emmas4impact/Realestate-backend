locals {
  tags = [
    "realestate",
    var.environment,
    "terraform"
  ]
}

resource "linode_firewall" "lke_nodes" {
  label = "realestate-${var.environment}-lke-firewall"

  inbound_policy  = "DROP"
  outbound_policy = "ACCEPT"

  inbound {
    label    = "allow-http"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "80"
    ipv4     = ["0.0.0.0/0"]
    ipv6     = ["::/0"]
  }

  inbound {
    label    = "allow-https"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "443"
    ipv4     = ["0.0.0.0/0"]
    ipv6     = ["::/0"]
  }

  tags = local.tags
}

resource "linode_lke_cluster" "realestate" {
  label       = var.cluster_label
  region      = var.region
  k8s_version = var.k8s_version
  tags        = local.tags

  pool {
    type        = var.node_type
    count       = var.node_count
    label       = "app-pool"
    firewall_id = linode_firewall.lke_nodes.id

    labels = {
      role        = "application"
      environment = var.environment
    }
  }
}

resource "linode_database_postgresql_v2" "postgres" {
  label       = "realestate-${var.environment}-postgres"
  engine_id   = "postgresql/16"
  region      = var.region
  type        = "g6-nanode-1"
  cluster_size = 1

  allow_list = var.postgres_allow_list
}

resource "linode_domain" "realestate" {
  count     = var.domain_name == "" ? 0 : 1
  type      = "master"
  domain    = var.domain_name
  soa_email = var.soa_email
  tags      = local.tags
}

resource "linode_domain_record" "platform" {
  count       = var.domain_name != "" && var.platform_public_ip != "" ? 1 : 0
  domain_id   = linode_domain.realestate[0].id
  name        = "api"
  record_type = "A"
  target      = var.platform_public_ip
  ttl_sec     = 300
}