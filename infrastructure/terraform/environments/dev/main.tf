# Main Terraform configuration for development environment
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
    bucket         = "insurance-platform-dev-tfstate"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Local variables for development environment
locals {
  environment      = "dev"
  aws_region      = "us-east-1"
  project_name    = "insurance-platform"
  resource_prefix = "ins-platform-dev"

  common_tags = {
    Environment = local.environment
    Project     = local.project_name
    ManagedBy   = "terraform"
    Stage       = "development"
  }
}

# AWS Provider configuration
provider "aws" {
  region = local.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Development environment infrastructure module
module "aws_infrastructure" {
  source = "../../aws"

  environment = local.environment
  aws_region  = local.aws_region

  # VPC Configuration - Single AZ for dev
  vpc_cidr            = "10.0.0.0/16"
  availability_zones  = ["us-east-1a"]
  private_subnets     = ["10.0.1.0/24"]
  public_subnets      = ["10.0.101.0/24"]

  # EKS Configuration - Development sizing
  eks_cluster_version = "1.27"
  eks_node_groups = {
    main = {
      instance_types = ["t3.large"]
      min_size      = 1
      max_size      = 3
      desired_size  = 2
      disk_size     = 50
      labels = {
        Environment = "dev"
        Workload    = "general"
      }
      taints = []
      capacity_type = "ON_DEMAND"
    }
  }

  # Database Configuration - Development sizing
  db_instance_class     = "db.t3.large"
  mongodb_instance_type = "t3.xlarge"
  redis_node_type       = "cache.t3.medium"

  # Security Configuration
  enable_encryption         = true
  backup_retention_days    = 7
  enable_monitoring        = true
  monitoring_interval      = 60
  auto_minor_version_upgrade = true

  # Development-specific settings
  cluster_logging = {
    enabled_types = ["api", "audit"]
    retention_days = 30
  }

  tags = merge(
    local.common_tags,
    {
      Environment = "dev"
      Cost_Center = "development"
    }
  )
}

# Outputs
output "vpc_id" {
  description = "VPC ID for the development environment"
  value       = module.aws_infrastructure.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint for development environment"
  value       = module.aws_infrastructure.eks_cluster_endpoint
  sensitive   = true
}

output "database_endpoints" {
  description = "Database endpoints for development environment"
  value = {
    rds_endpoint      = module.aws_infrastructure.database_endpoints.rds
    mongodb_endpoint  = module.aws_infrastructure.database_endpoints.mongodb
    redis_endpoint    = module.aws_infrastructure.database_endpoints.redis
  }
  sensitive = true
}