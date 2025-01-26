# Output definitions for RDS PostgreSQL module
# Terraform >= 1.5.0

output "primary_endpoint" {
  description = "Primary RDS endpoint for campaign database connections in the format of host:port"
  value       = aws_db_instance.campaign_db.endpoint
}

output "reader_endpoint" {
  description = "Read replica endpoint for read-only campaign database connections, enabling load distribution"
  value       = aws_db_instance.campaign_db.reader_endpoint
}

output "db_instance_id" {
  description = "Unique identifier of the RDS instance for CloudWatch metrics collection and monitoring"
  value       = aws_db_instance.campaign_db.id
}

output "db_security_group_id" {
  description = "ID of the primary security group controlling network access to the RDS instance"
  value       = aws_db_instance.campaign_db.vpc_security_group_ids[0]
}

output "db_subnet_group_name" {
  description = "Name of the DB subnet group defining the VPC subnets where the RDS instance is deployed"
  value       = aws_db_subnet_group.campaign_db_subnet_group.name
}