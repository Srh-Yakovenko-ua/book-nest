let bootstrapPromise;

async function bootstrap() {
  const { bootstrapNestApp } = await import("../apps/api/dist/bootstrap.js");
  const app = await bootstrapNestApp();
  return app.getHttpAdapter().getInstance();
}

export default async function handler(req, res) {
  try {
    if (!bootstrapPromise) {
      bootstrapPromise = bootstrap().catch((err) => {
        bootstrapPromise = undefined;
        throw err;
      });
    }
    const expressApp = await bootstrapPromise;
    expressApp(req, res);
  } catch (err) {
    console.error("[api] bootstrap failed", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "BootstrapFailed",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
