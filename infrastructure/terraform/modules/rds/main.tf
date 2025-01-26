# AWS RDS PostgreSQL Infrastructure Module
# Terraform >= 1.5.0
# AWS Provider ~> 5.0

# Configure AWS RDS subnet group for multi-AZ deployment
resource "aws_db_subnet_group" "campaign_db_subnet_group" {
  name        = "${var.environment}-campaign-db-subnet-group"
  subnet_ids  = var.private_subnet_ids
  description = "Subnet group for campaign database in ${var.environment}"

  tags = {
    Environment = var.environment
    Project     = "Insurance Lead Platform"
    ManagedBy   = "Terraform"
  }
}

# Configure AWS RDS instance for campaign management system
resource "aws_db_instance" "campaign_db" {
  identifier     = "${var.environment}-campaign-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class

  # Storage configuration
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type         = "gp3"
  storage_encrypted    = true
  kms_key_id          = var.kms_key_arn

  # High availability configuration
  multi_az = true

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.campaign_db_subnet_group.name
  vpc_security_group_ids = [var.app_security_group_id]

  # Backup configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  # Performance monitoring
  monitoring_interval       = 60
  monitoring_role_arn      = var.monitoring_role_arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports = [
    "postgresql",
    "upgrade"
  ]

  # Database parameters
  parameter_group_name = var.parameter_group_name

  # Upgrade and deletion protection
  auto_minor_version_upgrade = true
  deletion_protection       = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.environment}-campaign-db-final"
  copy_tags_to_snapshot    = true

  tags = {
    Environment = var.environment
    Project     = "Insurance Lead Platform"
    ManagedBy   = "Terraform"
  }
}

# Output definitions for database endpoints and identifiers
output "primary_endpoint" {
  description = "Primary RDS endpoint for campaign database"
  value       = aws_db_instance.campaign_db.endpoint
}

output "reader_endpoint" {
  description = "Read replica endpoint for campaign database"
  value       = aws_db_instance.campaign_db.reader_endpoint
}

output "db_instance_id" {
  description = "ID of the RDS instance"
  value       = aws_db_instance.campaign_db.id
}

output "db_resource_id" {
  description = "Resource ID of the RDS instance for CloudWatch metrics"
  value       = aws_db_instance.campaign_db.resource_id
}