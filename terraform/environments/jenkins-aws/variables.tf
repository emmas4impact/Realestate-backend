variable "aws_region" {
  type    = string
  default = "eu-north-1"
}

variable "project_name" {
  type    = string
  default = "realestate"
}

variable "environment" {
  type    = string
  default = "jenkins"
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "allowed_ssh_cidrs" {
  description = "CIDR blocks allowed to SSH into Jenkins EC2 instances"
  type        = list(string)
}

variable "allowed_jenkins_ui_cidrs" {
  description = "CIDR blocks allowed to access Jenkins UI on port 8080"
  type        = list(string)
}
variable "ssh_public_key_path" {
  type    = string
  default = "~/.ssh/id_rsa.pub"
}

variable "master_instance_type" {
  type    = string
  default = "t3.medium"
}

variable "agent_instance_type" {
  type    = string
  default = "t3.medium"
}