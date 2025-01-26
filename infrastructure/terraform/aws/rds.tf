# RDS PostgreSQL configuration for campaign management system
# AWS Provider version: ~> 5.0
# Terraform version: >= 1.5.0

# KMS key for RDS encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption - ${var.environment}"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  multi_region           = true

  tags = {
    Environment     = var.environment
    Project         = "Insurance Lead Platform"
    ManagedBy       = "Terraform"
    SecurityLevel   = "High"
    DataType        = "Campaign Data"
  }
}

# RDS parameter group
resource "aws_db_parameter_group" "campaign_db" {
  name_prefix = "campaign-db-${var.environment}"
  family      = "postgres15"
  description = "Custom parameter group for campaign database"

  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/4}"
  }

  parameter {
    name  = "work_mem"
    value = "64MB"
  }

  parameter {
    name  = "maintenance_work_mem"
    value = "256MB"
  }

  parameter {
    name  = "effective_cache_size"
    value = "{DBInstanceClassMemory*3/4}"
  }

  parameter {
    name  = "autovacuum"
    value = "1"
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# RDS subnet group
resource "aws_db_subnet_group" "campaign_db" {
  name_prefix = "campaign-db-${var.environment}"
  description = "Subnet group for campaign database"
  subnet_ids  = module.networking.private_subnet_ids

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Security group for RDS
resource "aws_security_group" "campaign_db" {
  name_prefix = "campaign-db-${var.environment}"
  description = "Security group for campaign database"
  vpc_id      = module.networking.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.cluster_security_group_id]
    description     = "PostgreSQL access from EKS cluster"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Primary RDS instance
resource "aws_db_instance" "campaign_db_primary" {
  identifier = "campaign-db-${var.environment}"
  
  # Engine configuration
  engine                = "postgres"
  engine_version        = "15.4"
  instance_class        = var.database_config.postgresql.instance_class
  
  # Storage configuration
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn
  
  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.campaign_db.name
  vpc_security_group_ids = [aws_security_group.campaign_db.id]
  multi_az              = var.database_config.postgresql.multi_az
  
  # Database configuration
  db_name  = "campaign_db"
  username = "campaign_admin"
  password = random_password.db_password.result
  port     = 5432
  
  # Backup and maintenance
  backup_retention_period = var.database_config.postgresql.backup_retention
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  copy_tags_to_snapshot  = true
  skip_final_snapshot    = false
  final_snapshot_identifier = "campaign-db-final-${var.environment}"
  deletion_protection    = true
  
  # Monitoring and logging
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id = aws_kms_key.rds.arn
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  # Parameter and option groups
  parameter_group_name = aws_db_parameter_group.campaign_db.name
  
  tags = {
    Environment      = var.environment
    Project         = "Insurance Lead Platform"
    ManagedBy       = "Terraform"
    SecurityLevel   = "High"
    DataType        = "Campaign Data"
    Backup          = "Required"
  }
}

# Read replicas
resource "aws_db_instance" "campaign_db_replica" {
  count = 2

  identifier = "campaign-db-replica-${count.index + 1}-${var.environment}"
  
  # Replica configuration
  replicate_source_db = aws_db_instance.campaign_db_primary.id
  instance_class      = var.database_config.postgresql.instance_class
  
  # Network configuration
  vpc_security_group_ids = [aws_security_group.campaign_db.id]
  
  # Storage configuration
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn
  
  # Monitoring and logging
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id = aws_kms_key.rds.arn
  
  tags = {
    Environment     = var.environment
    Project         = "Insurance Lead Platform"
    ManagedBy       = "Terraform"
    SecurityLevel   = "High"
    DataType        = "Campaign Data"
    Role            = "Read Replica"
  }
}

# Random password generation for RDS
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# IAM role for enhanced monitoring
resource "aws_iam_role" "rds_monitoring" {
  name_prefix = "rds-monitoring-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Outputs
output "campaign_db_primary_endpoint" {
  description = "Primary RDS endpoint for campaign database"
  value       = aws_db_instance.campaign_db_primary.endpoint
  sensitive   = true
}

output "campaign_db_reader_endpoint" {
  description = "Reader endpoint for campaign database replicas"
  value       = aws_db_instance.campaign_db_primary.endpoint
  sensitive   = true
}

output "campaign_db_resource_id" {
  description = "RDS resource ID for monitoring and maintenance"
  value       = aws_db_instance.campaign_db_primary.resource_id
}