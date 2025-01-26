# AWS IAM configuration for Multi-Vertical Insurance Lead Generation Platform
# Provider version: AWS ~> 5.0
# Terraform version >= 1.5.0

# Import required providers and variables
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Data sources for current AWS account and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# EKS node role trust policy
data "aws_iam_policy_document" "eks_node_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

# KMS administrator role trust policy
data "aws_iam_policy_document" "kms_admin_role_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    condition {
      test     = "Bool"
      variable = "aws:MultiFactorAuthPresent"
      values   = ["true"]
    }
  }
}

# KMS administrator policy
data "aws_iam_policy_document" "kms_admin_policy" {
  statement {
    effect = "Allow"
    actions = [
      "kms:Create*",
      "kms:Describe*",
      "kms:Enable*",
      "kms:List*",
      "kms:Put*",
      "kms:Update*",
      "kms:Revoke*",
      "kms:Disable*",
      "kms:Get*",
      "kms:Delete*",
      "kms:ScheduleKeyDeletion",
      "kms:CancelKeyDeletion"
    ]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [data.aws_region.current.name]
    }
  }
}

# Lead service trust policy
data "aws_iam_policy_document" "lead_service_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.eks.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${replace(data.aws_iam_openid_connect_provider.eks.url, "https://", "")}:sub"
      values   = ["system:serviceaccount:lead-service:lead-service"]
    }
  }
}

# Lead service permissions policy
data "aws_iam_policy_document" "lead_service_permissions" {
  statement {
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "kms:Decrypt",
      "kms:GenerateDataKey"
    ]
    resources = [
      "arn:aws:s3:::${local.name_prefix}-leads/*",
      "arn:aws:kms:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:key/*"
    ]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [data.aws_region.current.name]
    }
  }
}

# EKS node IAM role
resource "aws_iam_role" "eks_node_role" {
  name                 = "${local.name_prefix}-eks-node-role"
  assume_role_policy   = data.aws_iam_policy_document.eks_node_role_policy.json
  managed_policy_arns = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
    "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
  ]
  force_detach_policies = true
  max_session_duration  = 3600

  tags = local.common_tags
}

# KMS administrator role
resource "aws_iam_role" "kms_key_admin_role" {
  name                  = "${local.name_prefix}-kms-admin-role"
  assume_role_policy    = data.aws_iam_policy_document.kms_admin_role_policy.json
  permissions_boundary  = "arn:aws:iam::aws:policy/PowerUserAccess"
  force_detach_policies = true

  inline_policy {
    name   = "kms-key-administration"
    policy = data.aws_iam_policy_document.kms_admin_policy.json
  }

  tags = local.common_tags
}

# Lead service role with IRSA
resource "aws_iam_role" "lead_service_role" {
  name                  = "${local.name_prefix}-lead-service-role"
  assume_role_policy    = data.aws_iam_policy_document.lead_service_trust.json
  max_session_duration  = 3600

  inline_policy {
    name   = "lead-service-permissions"
    policy = data.aws_iam_policy_document.lead_service_permissions.json
  }

  tags = local.common_tags
}

# Data source for EKS OIDC provider
data "aws_iam_openid_connect_provider" "eks" {
  url = data.aws_eks_cluster.main.identity[0].oidc[0].issuer
}

# Data source for EKS cluster
data "aws_eks_cluster" "main" {
  name = var.eks_cluster.cluster_name
}

# Outputs
output "eks_node_role_arn" {
  description = "ARN of the EKS node IAM role"
  value       = aws_iam_role.eks_node_role.arn
}

output "kms_key_admin_role_arn" {
  description = "ARN of the KMS key administrator role"
  value       = aws_iam_role.kms_key_admin_role.arn
}