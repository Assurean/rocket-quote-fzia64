# AWS EKS configuration for Multi-Vertical Insurance Lead Generation Platform
# Provider version: AWS ~> 5.0
# Terraform version >= 1.5.0

# Local variables for EKS configuration
locals {
  cluster_name = "${var.environment}-insurance-platform-eks"
  node_groups_config = {
    application = {
      instance_types = ["c5.2xlarge", "c5a.2xlarge", "c6g.2xlarge"]
      capacity_type  = "SPOT"
      min_size      = 2
      max_size      = 20
      desired_size  = 3
      labels = {
        role        = "application"
        environment = var.environment
      }
    }
    system = {
      instance_types = ["c5.2xlarge"]
      capacity_type  = "ON_DEMAND"
      min_size      = 2
      max_size      = 4
      desired_size  = 2
      labels = {
        role        = "system"
        environment = var.environment
      }
    }
  }
}

# EKS cluster module configuration
module "eks" {
  source = "../modules/eks"

  environment         = var.environment
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  cluster_version    = var.eks_cluster_config.version
  cluster_name       = local.cluster_name

  # Node groups configuration
  node_groups = {
    for name, config in local.node_groups_config : name => {
      instance_types = config.instance_types
      capacity_type  = config.capacity_type
      min_size      = config.min_size
      max_size      = config.max_size
      desired_size  = config.desired_size
      labels        = config.labels
      taints        = []
    }
  }

  # Cluster add-ons configuration
  cluster_addons = {
    vpc-cni = {
      version           = "v1.12.0-eksbuild.1"
      resolve_conflicts = "OVERWRITE"
      configuration_values = jsonencode({
        env = {
          ENABLE_PREFIX_DELEGATION = "true"
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
    aws-ebs-csi-driver = {
      version           = "v1.13.0-eksbuild.1"
      resolve_conflicts = "OVERWRITE"
      configuration_values = ""
    }
  }

  # Cluster encryption configuration
  cluster_encryption_config = {
    provider = {
      key_arn = module.kms.eks_key_arn
    }
    resources = ["secrets"]
  }

  # Cluster logging configuration
  cluster_logging = {
    enabled_types = [
      "api",
      "audit",
      "authenticator",
      "controllerManager",
      "scheduler"
    ]
    retention_days = 90
  }

  # Cluster security group rules
  cluster_security_group_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }
  }
}

# Data source for EKS cluster authentication
data "aws_eks_cluster_auth" "cluster" {
  name = module.eks.cluster_name
}

# Output definitions
output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint URL"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "eks_cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "eks_cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data for cluster authentication"
  value       = module.eks.cluster_certificate_authority_data
}