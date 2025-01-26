# Terraform outputs configuration for Multi-Vertical Insurance Lead Generation Platform
# AWS Provider version: ~> 5.0
# Last Updated: 2024

# EKS Cluster Outputs
output "eks_cluster_endpoint" {
  description = "EKS cluster API endpoint URL for secure service deployment"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}

output "eks_cluster_name" {
  description = "EKS cluster name for service configuration and access"
  value       = module.eks.cluster_name
}

output "eks_cluster_security_group_id" {
  description = "Security group ID for EKS cluster network access control"
  value       = module.eks.cluster_security_group_id
}

# RDS Database Outputs
output "rds_primary_endpoint" {
  description = "Primary RDS endpoint for campaign database write operations"
  value       = module.rds.primary_endpoint
  sensitive   = true
}

output "rds_reader_endpoint" {
  description = "RDS reader endpoint for high-performance read operations"
  value       = module.rds.reader_endpoint
  sensitive   = true
}

output "rds_security_group_id" {
  description = "Security group ID for RDS database access control"
  value       = module.rds.security_group_id
}

# MongoDB (DocumentDB) Outputs
output "mongodb_cluster_endpoint" {
  description = "DocumentDB cluster endpoint for lead data storage operations"
  value       = module.mongodb.cluster_endpoint
  sensitive   = true
}

output "mongodb_reader_endpoint" {
  description = "DocumentDB reader endpoint for scalable read operations"
  value       = module.mongodb.reader_endpoint
  sensitive   = true
}

output "mongodb_security_group_id" {
  description = "Security group ID for DocumentDB access control"
  value       = module.mongodb.security_group_id
}

# Networking Outputs
output "vpc_id" {
  description = "VPC ID for network configuration and security"
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs for secure service deployment"
  value       = module.networking.private_subnet_ids
}

output "availability_zones" {
  description = "List of availability zones for multi-AZ deployment"
  value       = module.networking.availability_zones
}