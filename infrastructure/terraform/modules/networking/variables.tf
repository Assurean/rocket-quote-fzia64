# Terraform version constraint
terraform {
  required_version = ">=1.5.0"
}

# Environment variable with validation
variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# VPC CIDR block with validation
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

# Availability zones list with validation
variable "availability_zones" {
  description = "List of availability zones for multi-AZ deployment"
  type        = list(string)
  
  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least 2 availability zones must be specified for high availability"
  }
}

# Private subnet CIDRs with validation
variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets, one per AZ"
  type        = list(string)
  
  validation {
    condition     = length(var.private_subnet_cidrs) == length(var.availability_zones)
    error_message = "Number of private subnet CIDRs must match number of availability zones"
  }
}

# Public subnet CIDRs with validation
variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets, one per AZ"
  type        = list(string)
  
  validation {
    condition     = length(var.public_subnet_cidrs) == length(var.availability_zones)
    error_message = "Number of public subnet CIDRs must match number of availability zones"
  }
}

# NAT Gateway configuration
variable "enable_nat_gateway" {
  description = "Enable NAT Gateway for private subnet internet access"
  type        = bool
  default     = true
}

# VPN Gateway configuration
variable "enable_vpn_gateway" {
  description = "Enable VPN Gateway for secure administrative access"
  type        = bool
  default     = false
}

# Resource tags
variable "tags" {
  description = "Tags to apply to all networking resources"
  type        = map(string)
  default = {
    ManagedBy = "Terraform"
    Project   = "Insurance Lead Platform"
  }
}