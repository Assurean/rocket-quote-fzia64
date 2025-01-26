# AWS KMS configuration for Multi-Vertical Insurance Lead Generation Platform
# Provider version: AWS ~> 5.0
# Terraform version >= 1.5.0

# KMS key for RDS database encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS database encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage               = "ENCRYPT_DECRYPT"
  multi_region            = true

  tags = {
    Name        = "rds-encryption-key"
    Environment = var.environment
    Purpose     = "RDS encryption"
    Compliance  = "GDPR,CCPA,SOC2,HIPAA"
  }
}

# KMS key for MongoDB encryption
resource "aws_kms_key" "mongodb" {
  description             = "KMS key for MongoDB encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage               = "ENCRYPT_DECRYPT"
  multi_region            = true

  tags = {
    Name        = "mongodb-encryption-key"
    Environment = var.environment
    Purpose     = "MongoDB encryption"
    Compliance  = "GDPR,CCPA,SOC2,HIPAA"
  }
}

# KMS key for Secrets Manager encryption
resource "aws_kms_key" "secrets" {
  description             = "KMS key for Secrets Manager encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage               = "ENCRYPT_DECRYPT"
  multi_region            = true

  tags = {
    Name        = "secrets-encryption-key"
    Environment = var.environment
    Purpose     = "Secrets encryption"
    Compliance  = "GDPR,CCPA,SOC2,HIPAA"
  }
}

# KMS alias for RDS encryption key
resource "aws_kms_alias" "rds" {
  name          = "alias/${var.environment}/rds"
  target_key_id = aws_kms_key.rds.key_id
}

# KMS alias for MongoDB encryption key
resource "aws_kms_alias" "mongodb" {
  name          = "alias/${var.environment}/mongodb"
  target_key_id = aws_kms_key.mongodb.key_id
}

# KMS alias for Secrets Manager encryption key
resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.environment}/secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# Policy document for key usage
data "aws_iam_policy_document" "kms_policy" {
  statement {
    sid    = "Enable IAM User Permissions"
    effect = "Allow"
    principals {
      type = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions = [
      "kms:*"
    ]
    resources = ["*"]
  }

  statement {
    sid    = "Allow service-linked role use of the key"
    effect = "Allow"
    principals {
      type = "AWS"
      identifiers = [
        "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/aws-service-role/rds.amazonaws.com/AWSServiceRoleForRDS",
        "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/aws-service-role/secretsmanager.amazonaws.com/AWSServiceRoleForSecretsManager"
      ]
    }
    actions = [
      "kms:Decrypt",
      "kms:DescribeKey",
      "kms:Encrypt",
      "kms:GenerateDataKey*",
      "kms:ReEncrypt*"
    ]
    resources = ["*"]
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Outputs for key ARNs and IDs
output "rds_kms_key" {
  description = "RDS KMS key details"
  value = {
    arn    = aws_kms_key.rds.arn
    key_id = aws_kms_key.rds.key_id
  }
}

output "mongodb_kms_key" {
  description = "MongoDB KMS key details"
  value = {
    arn    = aws_kms_key.mongodb.arn
    key_id = aws_kms_key.mongodb.key_id
  }
}

output "secrets_kms_key" {
  description = "Secrets Manager KMS key details"
  value = {
    arn    = aws_kms_key.secrets.arn
    key_id = aws_kms_key.secrets.key_id
  }
}