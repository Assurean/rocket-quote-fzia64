# Environment and Region Configuration
environment = "staging"
aws_region  = "us-east-1"
availability_zones = [
  "us-east-1a",
  "us-east-1b",
  "us-east-1c"
]

# VPC and Networking Configuration
vpc_cidr = "10.1.0.0/16"
private_subnet_cidrs = [
  "10.1.1.0/24",
  "10.1.2.0/24", 
  "10.1.3.0/24"
]
public_subnet_cidrs = [
  "10.1.11.0/24",
  "10.1.12.0/24",
  "10.1.13.0/24"
]
enable_nat_gateway = true
enable_vpn_gateway = true

# EKS Cluster Configuration
eks_cluster_version = "1.27"
eks_node_groups = {
  default = {
    instance_types = ["c5.2xlarge"]
    capacity_type  = "ON_DEMAND"
    scaling_config = {
      desired_size = 3
      max_size     = 10
      min_size     = 2
    }
    labels = {
      environment = "staging"
      role        = "application"
    }
    taints = []
  }
}

# Database Instance Classes
mongodb_instance_class = "db.r6g.2xlarge"
redis_node_type       = "cache.r6g.2xlarge"
rds_instance_class    = "db.r6g.2xlarge"

# Security Configuration
enable_cluster_encryption = true
enable_waf               = true

# Resource Tags
tags = {
  Environment      = "staging"
  Project         = "Insurance-Lead-Platform"
  ManagedBy       = "Terraform"
  BusinessUnit    = "Digital"
  CostCenter      = "Insurance-Platform"
  SecurityLevel   = "High"
  DataProtection  = "Sensitive"
}

# Monitoring Configuration
cluster_logging = {
  enabled_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]
  retention_days = 30
}

# Backup Configuration
backup_retention_days = 7
enable_automated_backups = true

# Performance Configuration
performance_insights_enabled = true
monitoring_interval = 60