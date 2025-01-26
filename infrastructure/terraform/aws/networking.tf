# AWS Provider version ~> 5.0
# Terraform version >= 1.5.0

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Core networking module configuration for Multi-Vertical Insurance Lead Generation Platform
module "networking" {
  source = "../modules/networking"

  # Basic VPC Configuration
  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones

  # Subnet Configuration with CIDR blocks calculated from VPC CIDR
  private_subnet_cidrs = [
    cidrsubnet(var.vpc_cidr, 4, 0), # 10.0.0.0/20
    cidrsubnet(var.vpc_cidr, 4, 1), # 10.0.16.0/20
    cidrsubnet(var.vpc_cidr, 4, 2)  # 10.0.32.0/20
  ]
  
  public_subnet_cidrs = [
    cidrsubnet(var.vpc_cidr, 4, 3), # 10.0.48.0/20
    cidrsubnet(var.vpc_cidr, 4, 4), # 10.0.64.0/20
    cidrsubnet(var.vpc_cidr, 4, 5)  # 10.0.80.0/20
  ]

  # NAT Gateway Configuration - Single NAT in non-prod environments
  enable_nat_gateway = true
  enable_vpn_gateway = var.environment == "prod"

  # Resource Tags
  tags = {
    Environment      = var.environment
    Project         = "Insurance Lead Platform"
    ManagedBy       = "Terraform"
    SecurityLevel   = "High"
    CostCenter     = "NetworkInfra"
    ComplianceScope = "PCI-DSS"
  }
}

# Output definitions for network resources
output "vpc_id" {
  description = "ID of the created VPC for resource association"
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for secure service deployment"
  value       = module.networking.private_subnet_ids
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for internet-facing resources"
  value       = module.networking.public_subnet_ids
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC for network planning"
  value       = module.networking.vpc_cidr_block
}

output "nat_gateway_ids" {
  description = "IDs of NAT gateways for monitoring and maintenance"
  value       = module.networking.nat_public_ips
}

output "vpc_flow_log_group_name" {
  description = "Name of the CloudWatch log group for VPC flow logs"
  value       = module.networking.vpc_flow_log_group_name
}

output "vpc_flow_log_id" {
  description = "ID of the VPC Flow Log for monitoring network traffic"
  value       = module.networking.vpc_flow_log_id
}