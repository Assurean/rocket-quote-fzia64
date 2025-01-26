# Production environment Terraform configuration for Multi-Vertical Insurance Lead Generation Platform
# AWS Provider version: ~> 5.0
# Terraform version: >= 1.5.0

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "s3" {
    bucket = "insurance-platform-prod-tfstate"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
    encrypt = true
    dynamodb_table = "insurance-platform-prod-tfstate-lock"
    kms_key_id = "alias/terraform-state"
    versioning = true
    replication_configuration {
      role = "arn:aws:iam::ACCOUNT_ID:role/terraform-state-replication"
      rules {
        status = "Enabled"
        destination {
          bucket = "insurance-platform-prod-tfstate-replica"
          region = "us-west-2"
        }
      }
    }
  }
}

locals {
  environment = "prod"
  aws_region = "us-east-1"
  secondary_region = "us-west-2"
  vpc_cidr = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

  eks_cluster_version = "1.27"
  eks_node_groups = {
    default = {
      instance_types = ["c5.2xlarge", "c5a.2xlarge"]
      scaling_config = {
        desired_size = 3
        max_size = 20
        min_size = 2
      }
      taints = {
        dedicated = "production"
      }
    }
    spot = {
      instance_types = ["c5.2xlarge", "c5a.2xlarge", "c5n.2xlarge"]
      capacity_type = "SPOT"
      scaling_config = {
        desired_size = 1
        max_size = 10
        min_size = 0
      }
    }
  }

  monitoring_config = {
    enable_detailed_monitoring = true
    retention_days = 90
    alarm_evaluation_periods = 3
  }

  security_config = {
    enable_flow_logs = true
    enable_guard_duty = true
    enable_security_hub = true
    ssl_policy = "ELBSecurityPolicy-TLS-1-2-Ext-2018-06"
  }

  common_tags = {
    Environment = local.environment
    Project     = "insurance-lead-platform"
    ManagedBy   = "terraform"
    SecurityLevel = "high"
    DataClassification = "sensitive"
  }
}

provider "aws" {
  region = local.aws_region
  default_tags {
    tags = local.common_tags
  }
}

provider "aws" {
  alias  = "secondary"
  region = local.secondary_region
  default_tags {
    tags = local.common_tags
  }
}

module "main" {
  source = "../../aws/main"

  environment = local.environment
  aws_region = local.aws_region
  vpc_cidr = local.vpc_cidr
  availability_zones = local.availability_zones

  eks_cluster_version = local.eks_cluster_version
  eks_node_groups = {
    for name, config in local.eks_node_groups : name => {
      instance_types = config.instance_types
      capacity_type  = try(config.capacity_type, "ON_DEMAND")
      scaling_config = config.scaling_config
      labels = merge(
        try(config.labels, {}),
        local.common_tags
      )
      taints = try(config.taints, [])
    }
  }

  kms_config = {
    deletion_window = 7
    enable_key_rotation = true
  }

  logging_config = {
    retention_days = local.monitoring_config.retention_days
    enable_api_logs = true
    enable_audit_logs = true
    enable_authenticator_logs = true
  }

  security_config = {
    enable_flow_logs = local.security_config.enable_flow_logs
    enable_guard_duty = local.security_config.enable_guard_duty
    enable_security_hub = local.security_config.enable_security_hub
    ssl_policy = local.security_config.ssl_policy
  }

  monitoring_config = {
    enable_detailed_monitoring = local.monitoring_config.enable_detailed_monitoring
    retention_days = local.monitoring_config.retention_days
    alarm_evaluation_periods = local.monitoring_config.alarm_evaluation_periods
  }

  tags = local.common_tags
}

# Outputs
output "vpc_id" {
  description = "VPC identifier for external reference and network integration"
  value       = module.main.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint for service deployment and monitoring"
  value       = module.main.eks_cluster_endpoint
  sensitive   = true
}

output "monitoring_dashboard_url" {
  description = "CloudWatch dashboard URL for infrastructure monitoring"
  value       = "https://${local.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${local.aws_region}#dashboards:name=${local.environment}-insurance-platform"
}