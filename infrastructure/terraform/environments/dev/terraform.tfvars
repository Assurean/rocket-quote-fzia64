# Development Environment Configuration for Multi-Vertical Insurance Lead Generation Platform
# AWS Region and Environment
environment = "dev"
aws_region  = "us-east-1"

# VPC Configuration - Single AZ for dev
availability_zones = ["us-east-1a"]
vpc_cidr          = "10.0.0.0/16"
private_subnets   = ["10.0.1.0/24"]
public_subnets    = ["10.0.101.0/24"]

# EKS Cluster Configuration
eks_cluster_version = "1.27"
eks_node_groups = {
  default = {
    instance_types = ["t3.large"]
    scaling_config = {
      desired_size = 2
      max_size     = 3
      min_size     = 1
    }
  }
}

# Database Instance Classes - Development Sized
mongodb_instance_class = "db.t3.xlarge"
redis_node_type       = "cache.t3.medium"
rds_instance_class    = "db.t3.large"

# Security Configuration
enable_cluster_encryption = true
enable_waf              = true

# Backup Configuration
backup_retention_days = 7

# Resource Tags
tags = {
  Environment = "dev"
  Project     = "Insurance-Lead-Platform"
  ManagedBy   = "Terraform"
}