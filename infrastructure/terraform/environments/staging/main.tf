# Main Terraform configuration for staging environment
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
  }

  backend "s3" {
    bucket         = "insurance-platform-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# Local variables for staging environment configuration
locals {
  environment = "staging"
  aws_region = "us-east-1"
  vpc_cidr   = "10.1.0.0/16"
  
  availability_zones = [
    "us-east-1a",
    "us-east-1b"
  ]

  # Staging-specific EKS node group configuration
  eks_node_groups = {
    default = {
      instance_types = ["c5.2xlarge"]
      scaling_config = {
        desired_size = 2
        max_size     = 4
        min_size     = 1
      }
    }
  }

  # Staging environment tags
  tags = {
    Environment   = "staging"
    Project       = "insurance-platform"
    ManagedBy     = "terraform"
    CostCenter    = "staging-ops"
    AutoShutdown  = "true"
  }
}

# AWS Provider configuration
provider "aws" {
  region = local.aws_region
  
  default_tags {
    tags = local.tags
  }
}

# Core AWS infrastructure module
module "aws" {
  source = "../../aws"

  environment         = local.environment
  aws_region         = local.aws_region
  vpc_cidr           = local.vpc_cidr
  availability_zones = local.availability_zones
  eks_node_groups    = local.eks_node_groups
  
  # Staging-specific configurations
  enable_monitoring     = true
  backup_retention_days = 7
  enable_auto_shutdown  = true
}

# Networking module configuration
module "networking" {
  source = "../../modules/networking"

  environment         = local.environment
  vpc_cidr           = local.vpc_cidr
  availability_zones = local.availability_zones
  
  private_subnet_cidrs = [
    cidrsubnet(local.vpc_cidr, 4, 0),
    cidrsubnet(local.vpc_cidr, 4, 1)
  ]
  
  public_subnet_cidrs = [
    cidrsubnet(local.vpc_cidr, 4, 2),
    cidrsubnet(local.vpc_cidr, 4, 3)
  ]

  enable_nat_gateway = true
  enable_vpn_gateway = false
  
  tags = local.tags
}

# EKS module configuration
module "eks" {
  source = "../../modules/eks"

  environment         = local.environment
  cluster_name        = "${local.environment}-insurance-platform"
  cluster_version     = "1.27"
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids

  node_groups = {
    default = {
      instance_types = ["c5.2xlarge"]
      capacity_type  = "ON_DEMAND"
      min_size      = 1
      max_size      = 4
      desired_size  = 2
      labels = merge(
        local.tags,
        {
          "role" = "application"
        }
      )
      taints = []
    }
  }

  cluster_addons = {
    vpc-cni = {
      version           = "v1.12.0-eksbuild.1"
      resolve_conflicts = "OVERWRITE"
      configuration_values = jsonencode({
        env = {
          ENABLE_PREFIX_DELEGATION = "true"
          WARM_PREFIX_TARGET      = "1"
        }
      })
    }
    coredns = {
      version           = "v1.9.3-eksbuild.3"
      resolve_conflicts = "OVERWRITE"
      configuration_values = ""
    }
    kube-proxy = {
      version           = "v1.27.1-eksbuild.1"
      resolve_conflicts = "OVERWRITE"
      configuration_values = ""
    }
  }

  cluster_logging = {
    enabled_types = [
      "api",
      "audit",
      "authenticator"
    ]
    retention_days = 30
  }

  tags = local.tags
}

# Output definitions
output "vpc_id" {
  description = "VPC ID for the staging environment"
  value       = module.networking.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint for staging environment"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}