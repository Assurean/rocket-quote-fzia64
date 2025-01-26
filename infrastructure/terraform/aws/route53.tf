# AWS Route53 configuration for Multi-Vertical Insurance Lead Generation Platform
# Provider version: AWS ~> 5.0
# Terraform version >= 1.5.0

# Public hosted zone for customer-facing domains
resource "aws_route53_zone" "public" {
  name    = var.domain_name
  comment = "Public hosted zone for insurance lead platform"

  tags = {
    Environment = var.environment
    Project     = "Insurance Lead Platform"
    ManagedBy   = "Terraform"
  }
}

# Private hosted zone for internal services
resource "aws_route53_zone" "private" {
  name = "internal.${var.domain_name}"
  
  vpc {
    vpc_id = module.networking.vpc_id
  }

  comment = "Private hosted zone for internal services"

  tags = {
    Environment = var.environment
    Project     = "Insurance Lead Platform"
    ManagedBy   = "Terraform"
  }
}

# Primary API health check
resource "aws_route53_health_check" "primary_api" {
  fqdn              = "api.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 2
  request_interval  = 10
  
  regions = [
    "us-east-1",
    "us-west-2",
    "eu-west-1"
  ]

  enable_sni        = true
  search_string     = "\"status\":\"healthy\""
  measure_latency   = true
  invert_healthcheck = false
  disabled          = false

  tags = {
    Name        = "Primary API Health Check"
    Environment = var.environment
  }
}

# Secondary API health check for failover
resource "aws_route53_health_check" "secondary_api" {
  fqdn              = "api-secondary.${var.domain_name}"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 2
  request_interval  = 10
  
  regions = [
    "us-west-2",
    "us-east-1",
    "eu-west-1"
  ]

  enable_sni        = true
  search_string     = "\"status\":\"healthy\""
  measure_latency   = true
  invert_healthcheck = false
  disabled          = false

  tags = {
    Name        = "Secondary API Health Check"
    Environment = var.environment
  }
}

# DNS query logging configuration
resource "aws_route53_query_log" "dns_logs" {
  depends_on = [aws_cloudwatch_log_group.dns_logs]

  cloudwatch_log_group_arn = aws_cloudwatch_log_group.dns_logs.arn
  zone_id                  = aws_route53_zone.public.zone_id
}

# CloudWatch log group for DNS query logging
resource "aws_cloudwatch_log_group" "dns_logs" {
  name              = "/aws/route53/${var.domain_name}/queries"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Project     = "Insurance Lead Platform"
    ManagedBy   = "Terraform"
  }
}

# DNSSEC configuration
resource "aws_route53_key_signing_key" "dnssec_key" {
  hosted_zone_id             = aws_route53_zone.public.zone_id
  key_management_service_arn = aws_kms_key.dnssec.arn
  name                      = "insurance-leads-key"
}

# Enable DNSSEC signing
resource "aws_route53_hosted_zone_dnssec" "dnssec" {
  depends_on = [aws_route53_key_signing_key.dnssec_key]
  
  hosted_zone_id = aws_route53_zone.public.zone_id
}

# KMS key for DNSSEC signing
resource "aws_kms_key" "dnssec" {
  customer_master_key_spec = "ECC_NIST_P256"
  deletion_window_in_days  = 7
  key_usage               = "SIGN_VERIFY"
  policy                  = data.aws_iam_policy_document.dnssec_kms.json

  tags = {
    Environment = var.environment
    Project     = "Insurance Lead Platform"
    ManagedBy   = "Terraform"
  }
}

# KMS key policy for DNSSEC
data "aws_iam_policy_document" "dnssec_kms" {
  statement {
    sid    = "Enable IAM User Permissions"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "Allow Route 53 DNSSEC Service"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["dnssec-route53.amazonaws.com"]
    }
    actions   = ["kms:DescribeKey", "kms:GetPublicKey", "kms:Sign"]
    resources = ["*"]
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Outputs
output "public_zone_id" {
  description = "ID of the public hosted zone"
  value       = aws_route53_zone.public.zone_id
}

output "private_zone_id" {
  description = "ID of the private hosted zone"
  value       = aws_route53_zone.private.zone_id
}

output "primary_health_check_id" {
  description = "ID of the primary API health check"
  value       = aws_route53_health_check.primary_api.id
}

output "secondary_health_check_id" {
  description = "ID of the secondary API health check"
  value       = aws_route53_health_check.secondary_api.id
}

output "dnssec_key_signing_key_id" {
  description = "ID of the DNSSEC key signing key"
  value       = aws_route53_key_signing_key.dnssec_key.id
}