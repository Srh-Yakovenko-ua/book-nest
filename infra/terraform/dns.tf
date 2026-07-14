locals {
  a_records = {
    root = { name = "book-nest.net", proxied = true }
    dev  = { name = "dev.book-nest.net", proxied = true }
    mail = { name = "mail.book-nest.net", proxied = true }
    db   = { name = "db.book-nest.net", proxied = true }
  }
}

resource "cloudflare_dns_record" "app" {
  for_each = local.a_records

  zone_id = var.cloudflare_zone_id
  name    = each.value.name
  type    = "A"
  content = var.server_ipv4
  ttl     = 1
  proxied = each.value.proxied
}
