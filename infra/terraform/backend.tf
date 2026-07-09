terraform {
  backend "s3" {
    bucket = "book-nest-tfstate"
    key    = "infra/terraform.tfstate"
    region = "auto"

    endpoints = {
      s3 = "https://440b6e63826c7fd04d634fb176eb576f.r2.cloudflarestorage.com"
    }

    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true

    use_lockfile = true
  }
}
