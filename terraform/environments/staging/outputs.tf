output "lke_cluster_id" {
  value = linode_lke_cluster.realestate.id
}

output "lke_cluster_label" {
  value = linode_lke_cluster.realestate.label
}

output "kubeconfig_base64" {
  value     = linode_lke_cluster.realestate.kubeconfig
  sensitive = true
}

output "postgres_id" {
  value = linode_database_postgresql_v2.postgres.id
}

output "dns_api_record" {
  value = var.domain_name != "" && var.platform_public_ip != "" ? "api.${var.domain_name}" : null
}