# AWS Provider version ~> 5.0
# Terraform version >= 1.5.0

variable "environment" {
  type        = string
  description = "Deployment environment identifier (dev/staging/prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the EKS cluster will be deployed"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for EKS node groups deployment"
}

variable "cluster_name" {
  type        = string
  description = "Name of the EKS cluster"
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version for the EKS cluster"
  default     = "1.27"
}

variable "node_groups" {
  type = map(object({
    instance_types = list(string)
    min_size      = number
    max_size      = number
    desired_size  = number
    labels        = map(string)
    taints = list(object({
      key    = string
      value  = string
      effect = string
    }))
    capacity_type = string
  }))
  description = "Configuration for EKS managed node groups including instance types, scaling settings, and Kubernetes labels"
  default = {
    application = {
      instance_types = ["c5.2xlarge", "c5a.2xlarge"]
      min_size      = 2
      max_size      = 20
      desired_size  = 3
      labels = {
        role        = "application"
        environment = "prod"
      }
      taints        = []
      capacity_type = "ON_DEMAND"
    }
    system = {
      instance_types = ["c5.xlarge"]
      min_size      = 2
      max_size      = 4
      desired_size  = 2
      labels = {
        role        = "system"
        environment = "prod"
      }
      taints = [
        {
          key    = "system"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      ]
      capacity_type = "ON_DEMAND"
    }
  }
}

variable "cluster_addons" {
  type = map(object({
    version              = string
    resolve_conflicts    = string
    configuration_values = string
  }))
  description = "Map of EKS cluster addon configurations including version and conflict resolution strategy"
  default = {
    vpc-cni = {
      version              = "v1.12.0-eksbuild.1"
      resolve_conflicts    = "OVERWRITE"
      configuration_values = "{\"env\":{\"ENABLE_PREFIX_DELEGATION\":\"true\",\"WARM_PREFIX_TARGET\":\"1\"}}"
    }
    coredns = {
      version              = "v1.9.3-eksbuild.3"
      resolve_conflicts    = "OVERWRITE"
      configuration_values = ""
    }
    kube-proxy = {
      version              = "v1.27.1-eksbuild.1"
      resolve_conflicts    = "OVERWRITE"
      configuration_values = ""
    }
  }
}

variable "cluster_encryption_config" {
  type = object({
    provider = object({
      key_arn = string
    })
    resources = list(string)
  })
  description = "Configuration for EKS cluster encryption using KMS"
  default = {
    provider = {
      key_arn = ""
    }
    resources = ["secrets"]
  }
}

variable "cluster_logging" {
  type = object({
    enabled_types  = list(string)
    retention_days = number
  })
  description = "Configuration for EKS control plane logging"
  default = {
    enabled_types = [
      "api",
      "audit",
      "authenticator",
      "controllerManager",
      "scheduler"
    ]
    retention_days = 90
  }
}

variable "tags" {
  type        = map(string)
  description = "Tags to be applied to all EKS cluster resources"
  default = {
    Project             = "Insurance-Lead-Platform"
    ManagedBy          = "Terraform"
    Environment        = "prod"
    SecurityLevel      = "high"
    DataClassification = "sensitive"
  }
}