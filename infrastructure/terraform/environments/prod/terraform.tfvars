# Production Environment Configuration for Multi-Vertical Insurance Lead Generation Platform
# AWS Provider version ~> 5.0
# Terraform version >= 1.5.0

# Core environment settings
environment = "prod"
aws_region  = "us-east-1"

# Availability zones configuration
availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

# VPC and networking configuration
vpc_cidr = "10.0.0.0/16"
private_subnet_cidrs = [
  "10.0.1.0/24",
  "10.0.2.0/24",
  "10.0.3.0/24"
]
public_subnet_cidrs = [
  "10.0.101.0/24",
  "10.0.102.0/24",
  "10.0.103.0/24"
]
enable_nat_gateway = true
enable_vpn_gateway = true
enable_flow_logs   = true

# EKS cluster configuration
eks_cluster_version = "1.27"
eks_node_groups = {
  default = {
    instance_types = ["c5.2xlarge"]
    capacity_type  = "ON_DEMAND"
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
  system = {
    instance_types = ["c5.xlarge"]
    capacity_type  = "ON_DEMAND"
    scaling_config = {
      desired_size = 2
      max_size     = 4
      min_size     = 2
    }
    labels = {
      role        = "system"
      environment = "prod"
    }
    taints = [
      {
        key    = "system"
        value  = "true"
        effect = "NO_SCHEDULE"
      }
    ]
  }
}

# Database configuration
mongodb_instance_class = "db.r6g.2xlarge"
redis_node_type       = "cache.r6g.2xlarge"
rds_instance_class    = "db.r6g.2xlarge"

# Security configuration
enable_cluster_encryption = true
enable_waf               = true
enable_enhanced_monitoring = true
backup_retention_days    = 30

# Resource tags
tags = {
  Environment        = "prod"
  Project           = "Insurance-Lead-Platform"
  ManagedBy         = "Terraform"
  BusinessUnit      = "LeadGen"
  CostCenter        = "Production"
  SecurityLevel     = "High"
  DataClassification = "Sensitive"
  Owner             = "Platform-Team"
}

# Cluster add-ons configuration
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

# Logging configuration
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