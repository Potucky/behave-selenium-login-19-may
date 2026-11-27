"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const reports = path.join(root, "reports");
fs.mkdirSync(reports, { recursive: true });

const newman = path.join(root, "node_modules", ".bin", "newman");
const collection = path.join(root, "collections", "restful-booker.postman_collection.json");
const environment = path.join(root, "environments", "restful-booker.postman_environment.json");

const args = [
  "run",
  collection,
  "--environment",
  environment,
  "--timeout-request",
  "30000",
  "--timeout-script",
  "10000",
  "--reporters",
  "cli,junit,htmlextra",
  "--reporter-junit-export",
  path.join(reports, "junit.xml"),
  "--reporter-htmlextra-export",
  path.join(reports, "newman-report.html"),
  "--reporter-htmlextra-title",
  "Restful Booker API",
  "--reporter-htmlextra-browserTitle",
  "Restful Booker API tests",
  "--reporter-htmlextra-showFolderDescription",
  "--reporter-htmlextra-logs",
  "--reporter-htmlextra-skipHeaders",
  "Cookie,Authorization",
  "--reporter-htmlextra-hideRequestBody",
  "Create token,Reject bad credentials,Reject non-JSON login",
  "--reporter-htmlextra-hideResponseBody",
  "Create token",
];

// Optional overrides. Unset variables keep the values in the environment file.
const overrides = [
  ["BASE_URL", "baseUrl"],
  ["BOOKER_USERNAME", "username"],
  ["BOOKER_PASSWORD", "password"],
];

for (const [envName, key] of overrides) {
  const value = process.env[envName];
  if (value) {
    args.push("--env-var", `${key}=${value}`);
  }
}

const result = spawnSync(newman, args, { cwd: root, stdio: "inherit" });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
