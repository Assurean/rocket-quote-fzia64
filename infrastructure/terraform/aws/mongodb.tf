# MongoDB DocumentDB Terraform Configuration
# AWS Provider Version: ~> 5.0
# Last Updated: 2024

# Random password generation for DocumentDB admin user
resource "random_password" "docdb_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# DocumentDB cluster configuration
resource "aws_docdb_cluster" "main" {
  cluster_identifier           = local.docdb_cluster_name
  engine                      = "docdb"
  engine_version              = "4.0.0"
  master_username             = "docdb_admin"
  master_password             = random_password.docdb_password.result
  backup_retention_period     = 30
  preferred_backup_window     = local.docdb_backup_window
  skip_final_snapshot        = false
  final_snapshot_identifier  = "${local.docdb_cluster_name}-final-${formatdate("YYYY-MM-DD-hh-mm", timestamp())}"
  vpc_security_group_ids     = [aws_security_group.docdb.id]
  db_subnet_group_name       = aws_docdb_subnet_group.docdb.name
  storage_encrypted         = true
  kms_key_id               = aws_kms_key.docdb.arn
  enabled_cloudwatch_logs_exports = ["audit", "profiler"]
  deletion_protection      = true
  apply_immediately       = false

  tags = {
    Environment = var.environment
    Service     = "insurance-leads-docdb"
    ManagedBy   = "terraform"
  }
}

# DocumentDB cluster instances
resource "aws_docdb_cluster_instance" "main" {
  count              = 3
  identifier         = "${local.docdb_cluster_name}-${count.index + 1}"
  cluster_identifier = aws_docdb_cluster.main.id
  instance_class     = var.mongodb_instance_type
  
  auto_minor_version_upgrade = true
  preferred_maintenance_window = local.docdb_maintenance_window
  promotion_tier    = count.index

  tags = {
    Environment = var.environment
    Service     = "insurance-leads-docdb"
    ManagedBy   = "terraform"
  }
}

# Security group for DocumentDB
resource "aws_security_group" "docdb" {
  name        = "${local.docdb_cluster_name}-sg"
  description = "Security group for DocumentDB cluster"
  vpc_id      = module.networking.vpc_id

  ingress {
    description = "DocumentDB port access from private subnets"
    from_port   = local.docdb_port
    to_port     = local.docdb_port
    protocol    = "tcp"
    cidr_blocks = module.networking.private_subnet_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.docdb_cluster_name}-sg"
    Environment = var.environment
    Service     = "insurance-leads-docdb"
  }
}

# Subnet group for DocumentDB
resource "aws_docdb_subnet_group" "docdb" {
  name        = "${local.docdb_cluster_name}-subnet-group"
  description = "DocumentDB subnet group"
  subnet_ids  = module.networking.private_subnet_ids

  tags = {
    Environment = var.environment
    Service     = "insurance-leads-docdb"
    ManagedBy   = "terraform"
  }
}

# KMS key for encryption
resource "aws_kms_key" "docdb" {
  description             = "KMS key for DocumentDB cluster encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  policy                 = data.aws_iam_policy_document.docdb_kms.json

  tags = {
    Environment = var.environment
    Service     = "insurance-leads-docdb"
    ManagedBy   = "terraform"
  }
}

# KMS key policy
data "aws_iam_policy_document" "docdb_kms" {
  statement {
    sid    = "Enable IAM User Permissions"
    effect = "Allow"
    principals {
      type = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "Allow DocumentDB to use the key"
    effect = "Allow"
    principals {
      type = "Service"
      identifiers = ["docdb.amazonaws.com"]
    }
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:CreateGrant",
      "kms:ListGrants",
      "kms:DescribeKey"
    ]
    resources = ["*"]
  }
}

# CloudWatch log group for DocumentDB
resource "aws_cloudwatch_log_group" "docdb" {
  name              = "/aws/docdb/${local.docdb_cluster_name}"
  retention_in_days = 30
  kms_key_id       = aws_kms_key.docdb.arn

  tags = {
    Environment = var.environment
    Service     = "insurance-leads-docdb"
    ManagedBy   = "terraform"
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Outputs
output "mongodb_cluster_endpoint" {
  description = "DocumentDB cluster endpoint"
  value       = aws_docdb_cluster.main.endpoint
}

output "mongodb_cluster_reader_endpoint" {
  description = "DocumentDB cluster reader endpoint"
  value       = aws_docdb_cluster.main.reader_endpoint
}

output "mongodb_cluster_port" {
  description = "DocumentDB cluster port"
  value       = local.docdb_port
}

output "mongodb_security_group_id" {
  description = "Security group ID for DocumentDB cluster"
  value       = aws_security_group.docdb.id
}

# Locals
locals {
  docdb_cluster_name       = "${var.environment}-insurance-leads-docdb"
  docdb_backup_window      = "03:00-04:00"
  docdb_maintenance_window = "sun:04:00-sun:05:00"
  docdb_port              = 27017
}