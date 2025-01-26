# AWS S3 configuration for Multi-Vertical Insurance Lead Generation Platform
# Provider version: AWS ~> 5.0
# Terraform version >= 1.5.0

# Lead data storage bucket with enhanced security
resource "aws_s3_bucket" "lead_data" {
  bucket_prefix = "insurance-leads-${var.environment}"
  force_destroy = false

  tags = local.common_tags
}

# Enable versioning for lead data bucket
resource "aws_s3_bucket_versioning" "lead_data_versioning" {
  bucket = aws_s3_bucket.lead_data.id
  versioning_configuration {
    status     = "Enabled"
    mfa_delete = "Enabled"
  }
}

# Server-side encryption configuration for lead data
resource "aws_s3_bucket_server_side_encryption_configuration" "lead_data_encryption" {
  bucket = aws_s3_bucket.lead_data.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

# Public access block for lead data bucket
resource "aws_s3_bucket_public_access_block" "lead_data_access" {
  bucket = aws_s3_bucket.lead_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Cross-region replication configuration for lead data
resource "aws_s3_bucket_replication_configuration" "lead_data_replication" {
  depends_on = [aws_s3_bucket_versioning.lead_data_versioning]

  role   = aws_iam_role.replication.arn
  bucket = aws_s3_bucket.lead_data.id

  rule {
    id     = "lead_data_replication"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.lead_data_replica.arn
      storage_class = "STANDARD_IA"

      encryption_configuration {
        replica_kms_key_id = aws_kms_key.s3_replica_key.arn
      }
    }

    source_selection_criteria {
      sse_kms_encrypted_objects {
        status = "Enabled"
      }
    }
  }
}

# ML models bucket configuration
resource "aws_s3_bucket" "ml_models" {
  bucket_prefix = "insurance-ml-models-${var.environment}"
  force_destroy = false

  tags = local.common_tags
}

# Intelligent tiering for ML models
resource "aws_s3_bucket_intelligent_tiering_configuration" "ml_models_tiering" {
  bucket = aws_s3_bucket.ml_models.id
  name   = "EntireDataset"

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
}

# System backups bucket configuration
resource "aws_s3_bucket" "system_backups" {
  bucket_prefix = "insurance-backups-${var.environment}"
  force_destroy = false

  tags = local.common_tags
}

# Lifecycle configuration for system backups
resource "aws_s3_bucket_lifecycle_configuration" "system_backups_lifecycle" {
  bucket = aws_s3_bucket.system_backups.id

  rule {
    id     = "backup_retention"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

# Access logging configuration for lead data bucket
resource "aws_s3_bucket_logging" "lead_data_logging" {
  bucket = aws_s3_bucket.lead_data.id

  target_bucket = aws_s3_bucket.access_logs.id
  target_prefix = "lead-data-logs/"
}

# CORS configuration for lead data bucket
resource "aws_s3_bucket_cors_configuration" "lead_data_cors" {
  bucket = aws_s3_bucket.lead_data.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://*.insurance-platform.com"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Metrics configuration for lead data bucket
resource "aws_s3_bucket_metric" "lead_data_metrics" {
  bucket = aws_s3_bucket.lead_data.id
  name   = "EntireBucket"
}

# Outputs for bucket names and ARNs
output "lead_data_bucket_name" {
  description = "Name of the lead data S3 bucket"
  value       = aws_s3_bucket.lead_data.id
}

output "ml_models_bucket_name" {
  description = "Name of the ML models S3 bucket"
  value       = aws_s3_bucket.ml_models.id
}

output "lead_data_bucket_arn" {
  description = "ARN of the lead data S3 bucket"
  value       = aws_s3_bucket.lead_data.arn
}