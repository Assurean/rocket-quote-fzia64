# Output definitions for the networking module
# Terraform version: >= 1.5.0
# AWS Provider version: ~> 5.0
# VPC Module version: ~> 5.0

output "vpc_id" {
  description = "ID of the created VPC for attaching resources and configuring security groups"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs across multiple AZs for deploying internal services with high availability"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "List of public subnet IDs across multiple AZs for load balancers and public-facing resources"
  value       = module.vpc.public_subnets
}

output "nat_public_ips" {
  description = "List of public Elastic IPs created for NAT Gateways to enable private subnet internet access"
  value       = module.vpc.nat_public_ips
}

output "private_route_table_ids" {
  description = "List of private route table IDs for configuring secure internal network routing"
  value       = module.vpc.private_route_table_ids
}

output "public_route_table_ids" {
  description = "List of public route table IDs for configuring external network routing"
  value       = module.vpc.public_route_table_ids
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC for security group and network ACL configuration"
  value       = module.vpc.vpc_cidr_block
}

output "vpc_flow_log_group_name" {
  description = "The name of the CloudWatch log group for VPC flow logs monitoring and analysis"
  value       = module.vpc.vpc_flow_log_cloudwatch_log_group_name
}

output "vpc_flow_log_id" {
  description = "The ID of the VPC Flow Log for network traffic auditing and compliance"
  value       = module.vpc.vpc_flow_log_id
}

output "availability_zones" {
  description = "List of availability zones where the VPC resources are deployed"
  value       = module.vpc.azs
}

output "vpc_endpoint_s3_id" {
  description = "ID of the S3 VPC endpoint for secure internal AWS service access"
  value       = module.vpc.vpc_endpoints["s3"].id
}

output "vpc_endpoint_dynamodb_id" {
  description = "ID of the DynamoDB VPC endpoint for secure internal AWS service access"
  value       = module.vpc.vpc_endpoints["dynamodb"].id
}