---
paths:
  - "docker-compose.yml"
  - "apps/*/vitest.config.ts"
  - "apps/api/src/test/**"
  - "turbo.json"
---

# Why the test and database limits are what they are

- **Test load is capped, and the cap is memory-driven, not CPU-driven.** Both Vitest configs honour `VITEST_MAX_WORKERS` (default `min(3, cores)`). The default is 3 because turbo runs `@app/api` and `@app/web` tests concurrently, so the root `pnpm test` spawns **two** pools; at 6 each that was 12 forks holding ~4.8 GB, which pushed the 24 GB dev machine into swap. Total CPU work is flat across worker counts (~90s user for a 17-file module); only wall time and peak footprint move: 6 workers ≈ 28s wall, 2 workers ≈ 51s.
- **The local Postgres is capped in `docker-compose.yml`** (`cpus: 2.5`, `mem_limit: 1200m`) and runs with `synchronous_commit=off` + `wal_level=minimal` + `max_wal_senders=0`. Truncate-heavy test runs used to drive it to 181% CPU / 2 GB unbounded. These settings can lose the last few transactions if the host crashes mid-write, never corrupt the database: acceptable for a re-seedable local DB, never copy them to a server.
- **Docker Desktop is set to 4 CPUs / 4 GB.** The VM reserves its whole allocation from the host, so an 8 GB allocation cost ~5 GB of real RAM to run ~1.4 GB of containers.
- **API tests need Postgres, Redis and Mailpit**, not only `db`. With Redis or Mailpit down, auth and trash tests hit 30s timeouts that look like your bug: `docker compose up -d db redis mailpit`.
