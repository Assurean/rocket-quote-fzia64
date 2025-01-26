# Terraform AWS RDS Module Variables
# Terraform version requirements: >= 1.5.0

# Environment specification
variable "environment" {
  description = "Deployment environment (dev, staging, prod) with specific configuration per environment"
  type        = string
  
  validation {
    condition     = can(regex("^(dev|staging|prod)$", var.environment))
    error_message = "Environment must be dev, staging, or prod"
  }
}

# Network configuration
variable "vpc_id" {
  description = "ID of the VPC where RDS instances will be deployed for network isolation"
  type        = string
  
  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must be valid AWS VPC identifier"
  }
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for RDS deployment across multiple availability zones"
  type        = list(string)
  
  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least two private subnets required for high availability"
  }
}

# Instance configuration
variable "db_instance_class" {
  description = "RDS instance class optimized for high performance and concurrent connections"
  type        = string
  default     = "db.r6g.xlarge"
  
  validation {
    condition     = can(regex("^db\\.(t3|r6g|r6i)\\.", var.db_instance_class))
    error_message = "Instance class must be a valid RDS instance type"
  }
}

# Security configuration
variable "app_security_group_id" {
  description = "Security group ID controlling access from application layer to RDS instances"
  type        = string
  
  validation {
    condition     = can(regex("^sg-", var.app_security_group_id))
    error_message = "Security group ID must be valid AWS security group identifier"
  }
}

# High availability configuration
variable "multi_az" {
  description = "Enable Multi-AZ deployment for automatic failover and high availability"
  type        = bool
  default     = true
}

# Encryption configuration
variable "storage_encrypted" {
  description = "Enable storage encryption using AWS KMS for data at rest protection"
  type        = bool
  default     = true
}

# Backup configuration
variable "backup_retention_period" {
  description = "Number of days to retain automated backups for disaster recovery"
  type        = number
  default     = 30
  
  validation {
    condition     = var.backup_retention_period >= 7
    error_message = "Backup retention period must be at least 7 days"
  }
}

# Monitoring configuration
variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds for performance tracking"
  type        = number
  default     = 60
  
  validation {
    condition     = contains([0, 1, 5, 10, 15, 30, 60], var.monitoring_interval)
    error_message = "Monitoring interval must be 0, 1, 5, 10, 15, 30, or 60"
  }
}