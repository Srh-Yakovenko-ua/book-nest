resource "hcloud_ssh_key" "deploy" {
  name       = "booknest-deploy"
  public_key = var.ssh_public_key

  lifecycle {
    ignore_changes = [public_key]
  }
}

resource "hcloud_server" "app" {
  name        = "nest-book"
  server_type = "cx23"
  image       = "ubuntu-24.04"
  location    = "nbg1"
  ssh_keys    = [hcloud_ssh_key.deploy.name]

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [image, location, datacenter, ssh_keys, user_data]
  }
}
