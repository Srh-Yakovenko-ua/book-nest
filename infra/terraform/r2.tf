resource "cloudflare_r2_bucket" "dev" {
  account_id = var.cloudflare_account_id
  name       = "book-nest-dev"
  location   = var.r2_location

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [location, storage_class]
  }
}

resource "cloudflare_r2_bucket" "prod" {
  account_id = var.cloudflare_account_id
  name       = "book-nest-prod"
  location   = var.r2_location

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [location, storage_class]
  }
}
