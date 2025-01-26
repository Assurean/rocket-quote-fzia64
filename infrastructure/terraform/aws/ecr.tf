# AWS ECR Repositories for Multi-Vertical Insurance Lead Generation Platform
# Provider version: AWS ~> 5.0
# Terraform version >= 1.5.0

# KMS key for ECR repository encryption
resource "aws_kms_key" "ecr_key" {
  description             = "KMS key for ECR repository encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Environment     = var.environment
    Service        = "ecr-encryption"
    ManagedBy      = "terraform"
    SecurityLevel  = "high"
    CostCenter     = "platform-services"
  }
}

resource "aws_kms_alias" "ecr_key_alias" {
  name          = "alias/${var.environment}-ecr-key"
  target_key_id = aws_kms_key.ecr_key.key_id
}

# Lead Service Repository
resource "aws_ecr_repository" "lead_service" {
  name                 = "${var.environment}-lead-service"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key        = aws_kms_key.ecr_key.arn
  }

  tags = {
    Environment   = var.environment
    Service      = "lead-service"
    ManagedBy    = "terraform"
    SecurityLevel = "high"
    CostCenter   = "platform-services"
  }
}

# Campaign Service Repository
resource "aws_ecr_repository" "campaign_service" {
  name                 = "${var.environment}-campaign-service"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key        = aws_kms_key.ecr_key.arn
  }

  tags = {
    Environment   = var.environment
    Service      = "campaign-service"
    ManagedBy    = "terraform"
    SecurityLevel = "high"
    CostCenter   = "platform-services"
  }
}

# ML Service Repository
resource "aws_ecr_repository" "ml_service" {
  name                 = "${var.environment}-ml-service"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key        = aws_kms_key.ecr_key.arn
  }

  tags = {
    Environment   = var.environment
    Service      = "ml-service"
    ManagedBy    = "terraform"
    SecurityLevel = "high"
    CostCenter   = "platform-services"
  }
}

# RTB Service Repository
resource "aws_ecr_repository" "rtb_service" {
  name                 = "${var.environment}-rtb-service"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key        = aws_kms_key.ecr_key.arn
  }

  tags = {
    Environment   = var.environment
    Service      = "rtb-service"
    ManagedBy    = "terraform"
    SecurityLevel = "high"
    CostCenter   = "platform-services"
  }
}

# Validation Service Repository
resource "aws_ecr_repository" "validation_service" {
  name                 = "${var.environment}-validation-service"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key        = aws_kms_key.ecr_key.arn
  }

  tags = {
    Environment   = var.environment
    Service      = "validation-service"
    ManagedBy    = "terraform"
    SecurityLevel = "high"
    CostCenter   = "platform-services"
  }
}

# Lifecycle policy for all repositories
resource "aws_ecr_lifecycle_policy" "policy" {
  for_each   = toset([
    aws_ecr_repository.lead_service.name,
    aws_ecr_repository.campaign_service.name,
    aws_ecr_repository.ml_service.name,
    aws_ecr_repository.rtb_service.name,
    aws_ecr_repository.validation_service.name
  ])
  repository = each.value

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 30 production images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v", "prod"]
          countType     = "imageCountMoreThan"
          countNumber   = 30
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last 10 staging images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["staging"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 3
        description  = "Remove untagged images after 3 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 3
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}