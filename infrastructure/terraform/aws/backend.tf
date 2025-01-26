# Backend configuration for Multi-Vertical Insurance Lead Generation Platform
# AWS Provider version: ~> 5.0
# Terraform version: >= 1.5.0

terraform {
  backend "s3" {
    # Primary state bucket configuration
    bucket         = "insurance-lead-platform-terraform-state"
    key            = "env/${var.environment}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    kms_key_id     = "aws/s3"
    dynamodb_table = "insurance-lead-platform-terraform-locks"
    
    # Access control
    acl            = "private"
    
    # State versioning
    versioning     = true
    
    # Cross-region replication for disaster recovery
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT_ID:role/terraform-state-replication-role"
      rules {
        id     = "disaster-recovery-replication"
        status = "Enabled"
        destination {
          bucket = "insurance-lead-platform-terraform-state-dr"
          region = "us-west-2"
        }
      }
    }
    
    # Access logging configuration
    logging {
      target_bucket = "insurance-lead-platform-logs"
      target_prefix = "terraform-state-access-logs/"
    }
    
    # Lifecycle rules for state management
    lifecycle_rule {
      enabled = true
      noncurrent_version_expiration {
        days = 90
      }
      abort_incomplete_multipart_upload_days = 7
    }
  }
}

# S3 bucket policy for state bucket
resource "aws_s3_bucket_policy" "state_bucket" {
  bucket = "insurance-lead-platform-terraform-state"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceHTTPS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          "arn:aws:s3:::insurance-lead-platform-terraform-state",
          "arn:aws:s3:::insurance-lead-platform-terraform-state/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport": "false"
          }
        }
      },
      {
        Sid       = "EnforceEncryption"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = [
          "arn:aws:s3:::insurance-lead-platform-terraform-state/*"
        ]
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption": "aws:kms"
          }
        }
      }
    ]
  })
}

# DynamoDB table for state locking
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "insurance-lead-platform-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Environment = var.environment
    Project     = "insurance-lead-platform"
    ManagedBy   = "terraform"
  }
}

# CloudWatch alarms for state bucket monitoring
resource "aws_cloudwatch_metric_alarm" "state_bucket_errors" {
  alarm_name          = "terraform-state-bucket-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "4xxError"
  namespace           = "AWS/S3"
  period             = "300"
  statistic          = "Sum"
  threshold          = "0"
  alarm_description  = "This metric monitors S3 bucket errors"
  alarm_actions      = ["arn:aws:sns:us-east-1:ACCOUNT_ID:terraform-state-alerts"]

  dimensions = {
    BucketName = "insurance-lead-platform-terraform-state"
  }
}