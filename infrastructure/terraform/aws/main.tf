# Main Terraform configuration for Multi-Vertical Insurance Lead Generation Platform
# Provider version: AWS ~> 5.0
# Terraform version >= 1.5.0

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
}

# Local variables for configuration
locals {
  environment = var.environment
  aws_region = var.aws_region
  vpc_cidr   = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

  # EKS configuration
  eks_cluster_version = "1.27"
  eks_node_groups = {
    critical = {
      instance_types = ["c5.2xlarge"]
      capacity_type  = "ON_DEMAND"
      scaling_config = {
        desired_size = 3
        max_size     = 10
        min_size     = 2
      }
      labels = {
        workload = "critical"
      }
    }
    general = {
      instance_types = ["c5.xlarge", "c5a.xlarge", "c6i.xlarge"]
      capacity_type  = "SPOT"
      scaling_config = {
        desired_size = 3
        max_size     = 20
        min_size     = 2
      }
      labels = {
        workload = "general"
      }
    }
  }

  # KMS configuration
  kms_config = {
    deletion_window = 7
    enable_key_rotation = true
  }

  # Logging configuration
  logging_config = {
    retention_days = 90
    enable_api_logs = true
    enable_audit_logs = true
    enable_authenticator_logs = true
  }

  # Common tags
  common_tags = {
    Environment = local.environment
    Project     = "insurance-lead-platform"
    ManagedBy   = "terraform"
  }
}

# AWS Provider configuration
provider "aws" {
  region = local.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Networking module for VPC and subnet configuration
module "networking" {
  source = "../modules/networking"

  environment         = local.environment
  vpc_cidr           = local.vpc_cidr
  availability_zones = local.availability_zones
  
  private_subnet_cidrs = [
    cidrsubnet(local.vpc_cidr, 4, 0),
    cidrsubnet(local.vpc_cidr, 4, 1),
    cidrsubnet(local.vpc_cidr, 4, 2)
  ]
  
  public_subnet_cidrs = [
    cidrsubnet(local.vpc_cidr, 4, 3),
    cidrsubnet(local.vpc_cidr, 4, 4),
    cidrsubnet(local.vpc_cidr, 4, 5)
  ]

  enable_nat_gateway = true
  enable_vpn_gateway = local.environment == "prod"

  tags = local.common_tags
}

# EKS module for container orchestration
module "eks" {
  source = "../modules/eks"

  environment      = local.environment
  cluster_name     = "${local.environment}-insurance-platform"
  cluster_version  = local.eks_cluster_version
  vpc_id          = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids

  node_groups = {
    for name, config in local.eks_node_groups : name => {
      instance_types = config.instance_types
      capacity_type  = config.capacity_type
      min_size      = config.scaling_config.min_size
      max_size      = config.scaling_config.max_size
      desired_size  = config.scaling_config.desired_size
      labels        = merge(config.labels, local.common_tags)
      taints        = []
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

  cluster_encryption_config = {
    provider = {
      key_arn = aws_kms_key.eks_encryption.arn
    }
    resources = ["secrets"]
  }

  cluster_logging = {
    enabled_types = [
      "api",
      "audit",
      "authenticator",
      "controllerManager",
      "scheduler"
    ]
    retention_days = local.logging_config.retention_days
  }

  tags = local.common_tags
}

# KMS key for EKS encryption
resource "aws_kms_key" "eks_encryption" {
  description             = "KMS key for EKS cluster encryption"
  deletion_window_in_days = local.kms_config.deletion_window
  enable_key_rotation     = local.kms_config.enable_key_rotation

  tags = merge(
    local.common_tags,
    {
      Name = "${local.environment}-eks-encryption-key"
    }
  )
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.networking.vpc_id
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "eks_cluster_security_group_id" {
  description = "Security group ID for the EKS cluster"
  value       = module.eks.cluster_security_group_id
}