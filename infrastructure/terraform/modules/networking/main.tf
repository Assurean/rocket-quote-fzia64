# Core networking module for Multi-Vertical Insurance Lead Generation Platform
# Version: 1.0.0
# Provider version: AWS ~> 5.0
# VPC module version: ~> 5.0

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# VPC Module configuration using terraform-aws-modules/vpc/aws
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  # Basic VPC Configuration
  name = "${var.environment}-insurance-platform-vpc"
  cidr = var.vpc_cidr

  # Availability Zones and Subnet Configuration
  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  # NAT Gateway Configuration - Single NAT in non-prod environments
  enable_nat_gateway     = var.enable_nat_gateway
  single_nat_gateway     = var.environment != "prod"
  one_nat_gateway_per_az = var.environment == "prod"

  # DNS Configuration
  enable_dns_hostnames = true
  enable_dns_support   = true

  # VPC Flow Logs Configuration
  enable_flow_log                                = true
  create_flow_log_cloudwatch_log_group          = true
  create_flow_log_cloudwatch_iam_role           = true
  flow_log_max_aggregation_interval             = 60
  flow_log_cloudwatch_log_group_retention_in_days = 30
  flow_log_traffic_type                         = "ALL"

  # Default Security Group Configuration
  manage_default_security_group = true
  default_security_group_ingress = []
  default_security_group_egress  = []

  # VPC Endpoints for AWS Services
  enable_s3_endpoint       = true
  enable_dynamodb_endpoint = true

  # Resource Tags
  tags = merge(
    var.tags,
    {
      Environment = var.environment
      Project     = "insurance-platform"
      ManagedBy   = "terraform"
    }
  )

  # Subnet-specific Tags for Kubernetes (if needed)
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
    "Type"                           = "private"
  }

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
    "Type"                  = "public"
  }
}

# Output Definitions
output "vpc_id" {
  description = "ID of the created VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnets
}

output "nat_public_ips" {
  description = "List of public Elastic IPs created for NAT Gateway"
  value       = module.vpc.nat_public_ips
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "vpc_flow_log_group_name" {
  description = "The name of the CloudWatch log group for VPC flow logs"
  value       = module.vpc.vpc_flow_log_cloudwatch_log_group_name
}

output "vpc_flow_log_id" {
  description = "The ID of the VPC Flow Log"
  value       = module.vpc.vpc_flow_log_id
}