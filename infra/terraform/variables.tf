variable "cloudflare_api_token" {
  description = "Scoped Cloudflare API token (Zone:DNS:Edit, Workers R2 Storage:Edit, Access:Edit). Provide via TF_VAR_cloudflare_api_token env — never commit."
  type        = string
  sensitive   = true
}

variable "hcloud_token" {
  description = "Hetzner Cloud API token (Read & Write). Provide via TF_VAR_hcloud_token env — never commit."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID. Matches the R2 endpoint subdomain (already public in deploy/docker-compose.yml)."
  type        = string
  default     = "440b6e63826c7fd04d634fb176eb576f"
}

variable "cloudflare_zone_id" {
  description = "Zone ID for book-nest.net. Not secret; set in terraform.tfvars. Fetch via the API call in README."
  type        = string
}

variable "server_ipv4" {
  description = "Public IPv4 of the Hetzner server (DNS A-record target)."
  type        = string
  default     = "46.224.83.71"
}

variable "ssh_public_key" {
  description = "Public SSH key registered in Hetzner for deploy access (matches the CI DEPLOY_SSH_KEY pair)."
  type        = string
  default     = ""
}

variable "r2_location" {
  description = "R2 bucket location hint. Only used on create; ignored on import (see lifecycle in r2.tf)."
  type        = string
  default     = "weur"
}
