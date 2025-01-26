# AWS ElastiCache Redis configuration for session management and caching
# Provider version: AWS ~> 5.0
# Redis version: 7.0

# Subnet group for Redis cluster deployment
resource "aws_elasticache_subnet_group" "redis" {
  name        = "${var.environment}-redis-subnet-group"
  description = "Redis subnet group for ${var.environment} environment"
  subnet_ids  = module.networking.private_subnets

  tags = {
    Environment = var.environment
    Name        = "${var.environment}-redis-subnet-group"
    ManagedBy   = "terraform"
    Service     = "session-cache"
  }
}

# Parameter group with optimized settings for session management
resource "aws_elasticache_parameter_group" "redis" {
  family      = "redis7"
  name        = "${var.environment}-redis-params"
  description = "Optimized Redis parameters for ${var.environment} environment"

  # Performance and memory optimization parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "maxclients"
    value = "65000"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "activedefrag"
    value = "yes"
  }

  parameter {
    name  = "active-defrag-threshold-lower"
    value = "10"
  }

  parameter {
    name  = "active-defrag-threshold-upper"
    value = "100"
  }

  tags = {
    Environment = var.environment
    Name        = "${var.environment}-redis-params"
    ManagedBy   = "terraform"
    Service     = "session-cache"
  }
}

# Security group for Redis cluster
resource "aws_security_group" "redis" {
  name        = "${var.environment}-redis-sg"
  description = "Security group for Redis cluster in ${var.environment}"
  vpc_id      = module.networking.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    cidr_blocks     = module.networking.private_subnets_cidr_blocks
    description     = "Redis access from private subnets"
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
    Name        = "${var.environment}-redis-sg"
    ManagedBy   = "terraform"
    Service     = "session-cache"
  }
}

# Redis replication group with enhanced security and high availability
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id          = "${var.environment}-redis"
  description                   = "Redis cluster for ${var.environment} with enhanced security"
  node_type                     = var.redis_node_type
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  subnet_group_name            = aws_elasticache_subnet_group.redis.name
  security_group_ids           = [aws_security_group.redis.id]
  
  # High availability configuration
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  num_cache_clusters          = 2
  
  # Security configuration
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token_enabled         = true
  
  # Engine configuration
  engine                      = "redis"
  engine_version             = "7.0"
  
  # Maintenance and backup configuration
  maintenance_window         = "sun:05:00-sun:07:00"
  snapshot_window           = "03:00-05:00"
  snapshot_retention_limit  = 7
  apply_immediately        = false
  auto_minor_version_upgrade = true
  
  # Notification configuration
  notification_topic_arn    = var.sns_topic_arn

  tags = {
    Environment        = var.environment
    Name              = "${var.environment}-redis"
    ManagedBy         = "terraform"
    Service           = "session-cache"
    BackupRetention   = "7days"
    EncryptionEnabled = "true"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# CloudWatch alarms for Redis monitoring
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${var.environment}-redis-cpu-utilization"
  alarm_description   = "Redis cluster CPU utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ElastiCache"
  period             = "300"
  statistic          = "Average"
  threshold          = "75"
  alarm_actions      = [var.sns_topic_arn]
  ok_actions         = [var.sns_topic_arn]

  dimensions = {
    CacheClusterId = "${var.environment}-redis"
  }

  tags = {
    Environment = var.environment
    Service     = "session-cache"
    ManagedBy   = "terraform"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "${var.environment}-redis-memory-utilization"
  alarm_description   = "Redis cluster memory utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "DatabaseMemoryUsagePercentage"
  namespace          = "AWS/ElastiCache"
  period             = "300"
  statistic          = "Average"
  threshold          = "80"
  alarm_actions      = [var.sns_topic_arn]
  ok_actions         = [var.sns_topic_arn]

  dimensions = {
    CacheClusterId = "${var.environment}-redis"
  }

  tags = {
    Environment = var.environment
    Service     = "session-cache"
    ManagedBy   = "terraform"
  }
}