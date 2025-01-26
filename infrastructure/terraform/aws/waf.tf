# AWS WAF configuration for Multi-Vertical Insurance Lead Generation Platform
# Provider version: AWS ~> 5.0
# Terraform version >= 1.5.0

locals {
  waf_block_threshold = 100  # Block requests if rate exceeds 100 per 5 minutes
  waf_rate_limit = 2000     # Rate limit of 2000 requests per 5 minutes per IP
}

# WAF Web ACL for application protection
resource "aws_wafv2_web_acl" "main" {
  name        = "${var.environment}-insurance-platform-waf"
  description = "WAF rules for insurance platform protection"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS Managed Core Rule Set
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled  = true
    }
  }

  # Rate-based rule for DDoS protection
  rule {
    name     = "IPRateBasedRule"
    priority = 2

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = local.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "IPRateBasedRuleMetric"
      sampled_requests_enabled  = true
    }
  }

  # Geo-blocking rule for high-risk countries
  rule {
    name     = "GeoBlockRule"
    priority = 3

    action {
      block {}
    }

    statement {
      geo_match_statement {
        country_codes = ["RU", "CN", "KP", "IR"]
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "GeoBlockRuleMetric"
      sampled_requests_enabled  = true
    }
  }

  # SQL Injection protection
  rule {
    name     = "SQLiProtectionRule"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesSQLiRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "SQLiProtectionRuleMetric"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "InsurancePlatformWAFMetric"
    sampled_requests_enabled  = true
  }

  tags = {
    Environment = var.environment
    Service     = "insurance-platform"
    ManagedBy   = "terraform"
  }
}

# Associate WAF Web ACL with ALB
resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = module.eks.alb_arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# CloudWatch log group for WAF logs
resource "aws_cloudwatch_log_group" "waf" {
  name              = "/aws/waf/${var.environment}/insurance-platform"
  retention_in_days = 90

  tags = {
    Environment = var.environment
    Service     = "insurance-platform"
    ManagedBy   = "terraform"
  }
}

# Configure WAF logging
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]
  resource_arn           = aws_wafv2_web_acl.main.arn

  redacted_fields {
    single_header {
      name = "authorization"
    }
    single_header {
      name = "cookie"
    }
  }
}

# Output WAF Web ACL ARN
output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}