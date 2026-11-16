import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

/** Lightweight route metadata so Swagger discovers routes without replacing
 * Zod's strict runtime validation with JSON Schema validation. */
export const docsMeta = {
  register: { tags: ["auth"], summary: "Register a new account" },
  login: { tags: ["auth"], summary: "Log in with email and password" },
  refresh: { tags: ["auth"], summary: "Rotate the refresh token" },
  logout: { tags: ["auth"], summary: "Log out and revoke the session family" },
  me: { tags: ["auth"], summary: "Get the current user" },
  createProject: { tags: ["projects"], summary: "Create a project" },
  report: { tags: ["reports"], summary: "Generate a report from confirmed or draft data" },
} as const;

/** Machine-readable API description served at /api/docs and /api/docs/json. */
export async function registerApiDocs(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "What-if Report API",
        version: "1.0.0",
        description: "Authenticated API for projects, reports and analytics. All responses use a normalized error shape.",
      },
      servers: [{ url: "/" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
        schemas: {
          ErrorResponse: {
            type: "object",
            properties: {
              error: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  message: { type: "string" },
                  requestId: { type: "string" },
                  details: {},
                },
                required: ["code", "message", "requestId"],
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: "auth", description: "Registration, login and token refresh" },
        { name: "projects", description: "Project CRUD and draft lifecycle" },
        { name: "reports", description: "Report generation and analytics" },
        { name: "health", description: "Liveness and readiness probes" },
      ],
      // Explicit paths keep the document stable regardless of plugin
      // encapsulation order; route schemas still drive runtime docs UI.
      paths: {
        "/health": { get: { tags: ["health"], summary: "Liveness probe", responses: { 200: { description: "OK" } } } },
        "/ready": { get: { tags: ["health"], summary: "Readiness probe", responses: { 200: { description: "Ready" }, 503: { description: "Not ready" } } } },
        "/api/auth/register": {
          post: {
            tags: ["auth"], summary: "Register a new account", security: [],
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password", "displayName"], properties: { email: { type: "string" }, password: { type: "string", minLength: 8 }, displayName: { type: "string" } } } } } },
            responses: { 200: { description: "Registered with token pair" }, 400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } } },
          },
        },
        "/api/auth/login": {
          post: {
            tags: ["auth"], summary: "Log in", security: [],
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email", "password"], properties: { email: { type: "string" }, password: { type: "string" } } } } } },
            responses: { 200: { description: "Logged in" }, 401: { description: "Invalid credentials" } },
          },
        },
        "/api/auth/refresh": { post: { tags: ["auth"], summary: "Rotate refresh token", security: [], responses: { 200: { description: "New token pair" }, 401: { description: "Invalid token" } } } },
        "/api/auth/logout": { post: { tags: ["auth"], summary: "Log out", responses: { 200: { description: "Logged out" } } } },
        "/api/auth/me": { get: { tags: ["auth"], summary: "Current user", responses: { 200: { description: "User profile" }, 401: { description: "Unauthorized" } } } },
        "/api/projects": {
          get: { tags: ["projects"], summary: "List projects", parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } }, { name: "offset", in: "query", schema: { type: "integer", minimum: 0 } }], responses: { 200: { description: "Paginated list" } } },
          post: { tags: ["projects"], summary: "Create project", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name", "baseline"], properties: { name: { type: "string" }, baseline: { type: "object" } } } } } }, responses: { 201: { description: "Created" } } },
        },
        "/api/projects/{id}": {
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          get: { tags: ["projects"], summary: "Get project", responses: { 200: { description: "Project" }, 404: { description: "Not found" } } },
          patch: { tags: ["projects"], summary: "Update project", responses: { 200: { description: "Updated" }, 409: { description: "Version conflict" } } },
          delete: { tags: ["projects"], summary: "Delete project", responses: { 204: { description: "Deleted" } } },
        },
        "/api/projects/{id}/draft": { put: { tags: ["projects"], summary: "Update draft", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated draft" } } } },
        "/api/projects/{id}/apply": { post: { tags: ["projects"], summary: "Apply draft as baseline", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Applied" } } } },
        "/api/projects/{id}/revert": { post: { tags: ["projects"], summary: "Revert draft", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Reverted" } } } },
        "/api/projects/{id}/report": { post: { tags: ["reports"], summary: "Generate report", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "draft", in: "query", schema: { type: "boolean" } }], responses: { 200: { description: "Report model" } } } },
        "/api/projects/{id}/analytics": { get: { tags: ["reports"], summary: "Analytics summary", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Analytics" } } } },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/api/docs",
    uiConfig: { docExpansion: "list", deepLinking: false },
  });
}
