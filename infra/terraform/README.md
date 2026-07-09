# book-nest infrastructure (Terraform)

Infrastructure-as-code for the Hetzner + Cloudflare resources that book-nest runs on.
Everything here is **import-first**: the config is written to match live reality, live
resources are adopted into state, and nothing is applied until `terraform plan` reports
`No changes`. That green no-op is the proof the adoption is correct.

## What this manages — and what it deliberately does not

Three layers, one owner each:

| Layer                                                                           | Tool                                                         | Managed here?                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------- |
| **Infra** — server, SSH key, DNS records, R2 buckets, (later) Cloudflare Access | **Terraform**                                                | yes                                                      |
| **Config** — docker engine, systemd prune timer, `~/booknest` bootstrap         | cloud-init / Ansible                                         | no (forward-looking; the live box is already configured) |
| **Deploy** — containers, images, Caddy                                          | `deploy/docker-compose.yml` + `.github/workflows/deploy.yml` | no (unchanged)                                           |

Terraform provisions the **machine and the wiring**; docker compose runs the app **on
it**. `deploy/*`, the root `docker-compose.yml`, and the GitHub deploy pipeline are out
of scope on purpose.

## Files

| File                       | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `versions.tf`              | Pinned Terraform + provider versions                               |
| `backend.tf`               | Remote state in Cloudflare R2 (S3-compatible, native lockfile)     |
| `providers.tf`             | Cloudflare + Hetzner providers, tokens via env                     |
| `variables.tf`             | Inputs; secrets are `sensitive` and never defaulted                |
| `outputs.tf`               | Server IP/status, bucket + record names                            |
| `dns.tf`                   | The four `A` records (`book-nest.net`, `dev.`, `mail.`, `db.`)     |
| `r2.tf`                    | The `book-nest-dev` / `book-nest-prod` buckets (`prevent_destroy`) |
| `hetzner.tf`               | The `nest-book` server + deploy SSH key (`prevent_destroy`)        |
| `imports.tf.example`       | Transient import blocks — copy, fill IDs, apply, delete            |
| `terraform.tfvars.example` | Non-secret input template                                          |

`media.book-nest.net` / `media.dev.book-nest.net` are R2 custom-domain records; they are
**left unmanaged** for now (Terraform never deletes records it does not declare, so this
is safe). Adopt them in Phase 1b when convenient.

## Prerequisites

1. **Terraform ≥ 1.10** (`terraform version`). OpenTofu ≥ 1.8 works as a drop-in.
2. **Hetzner API token** — Cloud console → project → Security → API Tokens → Read & Write.
3. **Cloudflare API token** — scoped: `Zone.DNS:Edit` (zone book-nest.net), `Workers R2
Storage:Edit`, and later `Access: Apps and Policies:Edit`. Not the global key.
4. **R2 state credentials** — an R2 API token (Object Read & Write) for the state bucket.

Export them (never commit):

```sh
export TF_VAR_cloudflare_api_token='...'
export TF_VAR_hcloud_token='...'
export AWS_ACCESS_KEY_ID='...'          # R2 access key id  (state backend)
export AWS_SECRET_ACCESS_KEY='...'      # R2 secret         (state backend)
```

## Phase 0 — one-time state bucket (chicken-and-egg)

The state backend can't store its own bucket, so create it once, by hand:

```sh
# Cloudflare dashboard → R2 → Create bucket → name: book-nest-tfstate  (private)
# or via the S3 API with the R2 token:
aws s3api create-bucket --bucket book-nest-tfstate \
  --endpoint-url https://440b6e63826c7fd04d634fb176eb576f.r2.cloudflarestorage.com
```

Then scaffold-check with no backend and no credentials:

```sh
cd infra/terraform
terraform fmt -recursive -check
terraform init -backend=false
terraform validate
```

When the token env is set and the bucket exists, initialise the real backend:

```sh
terraform init          # configures the R2 backend + downloads providers
cp terraform.tfvars.example terraform.tfvars    # fill cloudflare_zone_id, ssh_public_key
```

Fetch the zone id:

```sh
curl -s -H "Authorization: Bearer $TF_VAR_cloudflare_api_token" \
  "https://api.cloudflare.com/client/v4/zones?name=book-nest.net" | jq -r '.result[].id'
```

## Phase 1 — adopt Cloudflare DNS + R2 (lowest risk)

1. List the live records so you have their IDs **and** their real `proxied`/`ttl`:

   ```sh
   ZONE=<zone_id>
   curl -s -H "Authorization: Bearer $TF_VAR_cloudflare_api_token" \
     "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records?type=A" \
     | jq -r '.result[] | "\(.name)\t\(.id)\tproxied=\(.proxied)\tttl=\(.ttl)"'
   ```

2. Copy the template and fill IDs:

   ```sh
   cp imports.tf.example imports.tf
   # replace ZONE_ID/RECORD_ID_* with "<zone_id>/<record_id>" for each of the four records
   ```

3. If any record's real `proxied` differs from `dns.tf`, edit `dns.tf` to match reality —
   do not let Terraform flip it. `mail.` and `db.` are the likeliest mismatches (they front
   admin UIs, may be DNS-only / grey-cloud), so check those first in the step-1 output. Same
   for the R2 bucket `location` (already `ignore_changes`, so a mismatch is harmless).

4. Plan and **reconcile until it is a pure no-op**:

   ```sh
   terraform plan -detailed-exitcode
   # exit 0 = no changes (safe). exit 2 = a diff is present → do NOT apply; reconcile the .tf.
   # goal: "N to import, 0 to add, 0 to change, 0 to destroy"
   # any "~ change" on an imported record means dns.tf disagrees with reality — fix dns.tf.
   ```

5. Apply the import, then drop the transient blocks:

   ```sh
   terraform apply        # performs the import; must report 0 changed / 0 destroyed
   rm imports.tf
   terraform plan         # sanity: "No changes"
   ```

### Phase 1b — the media custom domains stay unmanaged (for now)

`media.book-nest.net` / `media.dev.book-nest.net` are R2 custom domains. **Do not try to
adopt them yet:** the Cloudflare v5 provider's `cloudflare_r2_custom_domain` resource has no
import support, and since both domains already exist live, a plain `resource` + `apply`
would try to _create_ a domain that already exists and fail with an API conflict. Leaving
them out is safe — Terraform never deletes records it does not declare. Adopt them only once
the provider gains import for this resource; track the provider changelog.

## Phase 2 — adopt the Hetzner server (highest risk)

The server holds the Postgres volumes. `hcloud_server.app` and `hcloud_ssh_key.deploy`
carry `prevent_destroy` and `ignore_changes` on the base-image / location / ssh fields so
an inexact guess can never trigger a replace.

1. Get the numeric IDs:

   ```sh
   curl -s -H "Authorization: Bearer $TF_VAR_hcloud_token" \
     https://api.hetzner.cloud/v1/servers  | jq -r '.servers[]  | "\(.name)\t\(.id)"'
   curl -s -H "Authorization: Bearer $TF_VAR_hcloud_token" \
     https://api.hetzner.cloud/v1/ssh_keys | jq -r '.ssh_keys[] | "\(.name)\t\(.id)"'
   ```

2. Put them in `imports.tf` (`SERVER_ID`, `SSH_KEY_ID`), set `ssh_public_key` in tfvars.
3. `terraform plan` → **must be `0 to change, 0 to destroy`.** If a `replace` appears,
   stop and reconcile `hetzner.tf` (usually `server_type`/`name`) — never apply a replace.
4. `terraform apply`, then `rm imports.tf`.

### Phase 2b (optional) — a managed firewall (intentional create)

Adds a Hetzner firewall (SSH + HTTP/HTTPS only; DB ports stay bound to localhost). This is
a real create, so review the plan. Add to `hetzner.tf`:

```hcl
resource "hcloud_firewall" "edge" {
  name = "booknest-edge"
  dynamic "rule" {
    for_each = ["22", "80", "443"]
    content {
      direction  = "in"
      protocol   = "tcp"
      port       = rule.value
      source_ips = ["0.0.0.0/0", "::/0"]
    }
  }
}
```

Attach with `hcloud_firewall_attachment` (keeps the server resource a clean no-op). Verify
your SSH port is 22 before applying, or you can lock yourself out.

## Phase 3 (optional) — Cloudflare Access for db.book-nest.net

Ties into the paused DB-admin-UI plan. This is genuinely new (create, not import) and needs
a Zero Trust IdP configured. Template:

```hcl
resource "cloudflare_zero_trust_access_application" "cloudbeaver" {
  zone_id          = var.cloudflare_zone_id
  name             = "BookNest DB"
  domain           = "db.book-nest.net"
  type             = "self_hosted"
  session_duration = "24h"
}

resource "cloudflare_zero_trust_access_policy" "cloudbeaver_owner" {
  account_id = var.cloudflare_account_id
  name       = "Owner only"
  decision   = "allow"
  # include = [{ email = { email = "you@example.com" } }]
}
```

## Safety rules (non-negotiable during adoption)

- **Never `apply` a plan you have not read.** During adoption the only acceptable change
  set is imports + `0 change / 0 destroy`. Gate it mechanically: `terraform plan
-detailed-exitcode` returns `2` when any diff is present — treat non-zero as "stop".
- **The catastrophic half is already hard-blocked.** `prevent_destroy` on the server and both
  buckets makes any replace/destroy plan _fail_, not just discouraged — the `-detailed-exitcode`
  gate above only guards the benign in-place `~` drift that would otherwise break the no-op.
- **Secrets never enter state.** Do not import secret-bearing resources (R2 access keys,
  JWT secrets, GitHub Actions secrets). tfstate stores values in plaintext; keep it in the
  private R2 bucket and out of git.
- `prevent_destroy` guards the server and both buckets. Removing it is a deliberate act.
- Provider tokens come from env only. `terraform.tfvars` and `imports.tf` are gitignored.

## Daily use, once adopted

```sh
terraform fmt -recursive
terraform validate
terraform plan
terraform apply
```
