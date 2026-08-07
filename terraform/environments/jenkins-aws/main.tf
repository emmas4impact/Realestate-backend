locals {
  name = "${var.project_name}-${var.environment}"

  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_key_pair" "jenkins" {
  key_name   = "${local.name}-key"
  public_key = file(pathexpand(var.ssh_public_key_path))

  tags = merge(local.common_tags, {
    Name = "${local.name}-key"
  })
}

# -----------------------------------------------------------------------------
# Security groups
# -----------------------------------------------------------------------------

resource "aws_security_group" "jenkins_master" {
  name        = "${local.name}-master-sg"
  description = "Jenkins master security group"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name}-master-sg"
  })
}

resource "aws_security_group" "jenkins_agent" {
  name        = "${local.name}-agent-sg"
  description = "Jenkins agent security group"
  vpc_id      = var.vpc_id

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name}-agent-sg"
  })
}

# -----------------------------------------------------------------------------
# Jenkins master security group rules
# -----------------------------------------------------------------------------

resource "aws_security_group_rule" "master_ssh_from_admin" {
  type              = "ingress"
  security_group_id = aws_security_group.jenkins_master.id

  description = "SSH from admin IP"
  from_port   = 22
  to_port     = 22
  protocol    = "tcp"
  cidr_blocks = [var.allowed_admin_cidr]
}

resource "aws_security_group_rule" "master_ui_from_admin" {
  type              = "ingress"
  security_group_id = aws_security_group.jenkins_master.id

  description = "Jenkins UI from admin IP"
  from_port   = 8080
  to_port     = 8080
  protocol    = "tcp"
  cidr_blocks = [var.allowed_admin_cidr]
}

resource "aws_security_group_rule" "master_agent_port_from_agent" {
  type                     = "ingress"
  security_group_id        = aws_security_group.jenkins_master.id
  source_security_group_id = aws_security_group.jenkins_agent.id

  description = "Jenkins inbound agent port from Jenkins agent SG"
  from_port   = 50000
  to_port     = 50000
  protocol    = "tcp"
}

# -----------------------------------------------------------------------------
# Jenkins agent security group rules
# -----------------------------------------------------------------------------

resource "aws_security_group_rule" "agent_ssh_from_master" {
  type                     = "ingress"
  security_group_id        = aws_security_group.jenkins_agent.id
  source_security_group_id = aws_security_group.jenkins_master.id

  description = "SSH from Jenkins master SG"
  from_port   = 22
  to_port     = 22
  protocol    = "tcp"
}

resource "aws_security_group_rule" "agent_ssh_from_admin" {
  type              = "ingress"
  security_group_id = aws_security_group.jenkins_agent.id

  description = "SSH from admin IP for setup/debug"
  from_port   = 22
  to_port     = 22
  protocol    = "tcp"
  cidr_blocks = [var.allowed_admin_cidr]
}

# -----------------------------------------------------------------------------
# EC2 instances
# -----------------------------------------------------------------------------

resource "aws_instance" "jenkins_master" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.master_instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.jenkins_master.id]
  key_name                    = aws_key_pair.jenkins.key_name
  associate_public_ip_address = true

  user_data                   = file("${path.module}/user-data-master.sh")
  user_data_replace_on_change = false

  lifecycle {
    prevent_destroy = true
  }

  root_block_device {
    volume_size = 30
    volume_type = "gp3"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name}-master"
    Role = "jenkins-master"
  })
}

resource "aws_instance" "jenkins_agent" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.agent_instance_type
  subnet_id                   = var.subnet_id
  vpc_security_group_ids      = [aws_security_group.jenkins_agent.id]
  key_name                    = aws_key_pair.jenkins.key_name
  associate_public_ip_address = true

  user_data                   = file("${path.module}/user-data-agent.sh")
  user_data_replace_on_change = true

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name}-agent"
    Role = "jenkins-agent"
  })
}