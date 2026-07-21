variable "environment" {
  type    = string
  default = "staging"
}

variable "region" {
  type    = string
  default = "gb-lon"
}

variable "cluster_label" {
  type    = string
  default = "realestate-staging-lke"
}

variable "k8s_version" {
  type    = string
  default = "1.32"
}

variable "node_type" {
  type    = string
  default = "g6-standard-2"
}

variable "node_count" {
  type    = number
  default = 2
}

variable "domain_name" {
  type        = string
  description = "Root domain, for example example.com"
  default     = ""
}

variable "soa_email" {
  type        = string
  description = "DNS SOA email"
  default     = ""
}

variable "platform_public_ip" {
  type        = string
  description = "Platform LoadBalancer public IP. Leave empty until the service exists."
  default     = ""
}

variable "postgres_allow_list" {
  type        = list(string)
  description = "CIDR IPs allowed to connect to managed PostgreSQL"
  default     = []
}