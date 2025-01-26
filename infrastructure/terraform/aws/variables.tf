# Terraform version constraint
terraform {
  required_version = ">= 1.5.0"
}

# Environment variable with validation
variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# AWS region configuration
variable "aws_region" {
  type        = string
  description = "Primary AWS region for resource deployment"
  default     = "us-east-1"
}

variable "secondary_region" {
  type        = string
  description = "Secondary AWS region for disaster recovery"
  default     = "us-west-2"
}

# Availability zones configuration
variable "availability_zones" {
  type        = list(string)
  description = "List of AWS availability zones for multi-AZ deployment"
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "At least 3 availability zones required for high availability"
  }
}

# VPC configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# EKS cluster configuration
variable "eks_cluster_config" {
  type = object({
    version = string
    logging = map(bool)
    encryption_config = object({
      key_arn = string
      resources = list(string)
    })
  })
  description = "EKS cluster configuration including version and security settings"
  default = {
    version = "1.27"
    logging = {
      api            = true
      audit          = true
      authenticator  = true
      controllerManager = true
      scheduler      = true
    }
    encryption_config = {
      key_arn = ""
      resources = ["secrets"]
    }
  }
}

# EKS node groups configuration
variable "eks_node_groups" {
  type = map(object({
    instance_types = list(string)
    capacity_type  = string
    scaling_config = object({
      desired_size = number
      max_size     = number
      min_size     = number
    })
    labels = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
  }))
  description = "Detailed configuration for EKS node groups including instance types, scaling, and node labels/taints"
  default = {
    default = {
      instance_types = ["c5.2xlarge", "c5a.2xlarge"]
      capacity_type  = "SPOT"
      scaling_config = {
        desired_size = 3
        max_size     = 20
        min_size     = 2
      }
      labels = {
        role        = "application"
        environment = "prod"
      }
      taints = []
    }
  }
}

# Database configuration
variable "database_config" {
  type = map(object({
    instance_class     = string
    multi_az          = bool
    backup_retention  = number
    encryption_key_arn = string
  }))
  description = "Configuration for various database instances"
  default = {
    mongodb = {
      instance_class     = "db.r6g.2xlarge"
      multi_az          = true
      backup_retention  = 7
      encryption_key_arn = ""
    }
    redis = {
      instance_class     = "cache.r6g.2xlarge"
      multi_az          = true
      backup_retention  = 7
      encryption_key_arn = ""
    }
    postgresql = {
      instance_class     = "db.r6g.2xlarge"
      multi_az          = true
      backup_retention  = 7
      encryption_key_arn = ""
    }
  }
}

# Security configuration
variable "security_config" {
  type = object({
    enable_waf         = bool
    waf_rules         = list(string)
    enable_guardduty  = bool
    enable_security_hub = bool
    enable_config     = bool
  })
  description = "Security feature configuration"
  default = {
    enable_waf         = true
    waf_rules         = ["AWSManagedRulesCommonRuleSet", "AWSManagedRulesKnownBadInputsRuleSet"]
    enable_guardduty  = true
    enable_security_hub = true
    enable_config     = true
  }
}

# Monitoring configuration
variable "monitoring_config" {
  type = object({
    enable_enhanced_monitoring = bool
    retention_days           = number
    alarm_email             = string
  })
  description = "Monitoring and alerting configuration"
  default = {
    enable_enhanced_monitoring = true
    retention_days           = 90
    alarm_email             = "alerts@example.com"
  }
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Common tags to be applied to all resources"
  default = {
    Project            = "Insurance-Lead-Platform"
    ManagedBy         = "Terraform"
    Environment       = "prod"
    Owner             = "Platform-Team"
    SecurityLevel     = "High"
    DataClassification = "Sensitive"
  }
}