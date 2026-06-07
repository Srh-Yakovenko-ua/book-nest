import { type INestApplication } from "@nestjs/common";
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

export function buildOpenApiConfig(): Omit<OpenAPIObject, "components" | "paths"> {
  return new DocumentBuilder()
    .setTitle("book-nest API")
    .setDescription("REST API for the book-nest project")
    .setVersion("1.0")
    .addBearerAuth({ bearerFormat: "JWT", scheme: "bearer", type: "http" })
    .addCookieAuth("refreshToken")
    .build();
}

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, buildOpenApiConfig()));
}
