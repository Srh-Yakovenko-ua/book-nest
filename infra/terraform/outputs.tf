output "server_ipv4" {
  description = "Public IPv4 of the managed Hetzner server."
  value       = hcloud_server.app.ipv4_address
}

output "server_status" {
  description = "Power/lifecycle status of the managed server."
  value       = hcloud_server.app.status
}

output "r2_buckets" {
  description = "Names of the managed R2 buckets."
  value       = [cloudflare_r2_bucket.dev.name, cloudflare_r2_bucket.prod.name]
}

output "dns_records" {
  description = "Managed A-records keyed by role."
  value       = { for role, record in cloudflare_dns_record.app : role => record.name }
}
