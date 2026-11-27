"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildCollection } = require("./collection");

const root = path.resolve(__dirname, "..");
const schemasDir = path.join(root, "schemas");

function readSchema(name) {
  const file = path.join(schemasDir, name);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const schemas = {
  booking: readSchema("booking.json"),
  token: readSchema("token.json"),
  authError: readSchema("auth-error.json"),
  bookingIdList: readSchema("booking-id-list.json"),
};

const collection = buildCollection(schemas);
const requests = [];

function walk(items) {
  for (const item of items) {
    if (item.item) {
      walk(item.item);
      continue;
    }
    requests.push(item);
  }
}

walk(collection.item);

const required = [
  "Ping",
  "Create token",
  "Reject bad credentials",
  "Reject non-JSON login",
  "Create booking",
  "Get booking",
  "Find booking by name",
  "Replace booking",
  "Confirm replaced booking",
  "Patch additional needs",
  "Confirm patched booking",
  "Delete booking",
  "Confirm booking deleted",
  "Create booking with empty body",
  "Create booking missing firstname",
  "Create booking with inverted dates",
  "Delete inverted-date booking",
  "Get unknown booking",
  "Create booking for authz checks",
  "Update without token",
  "Update with invalid token",
  "Delete without token",
  "Confirm authz booking unchanged",
  "Delete booking used for authz checks",
  "Confirm authz booking deleted",
  "Update deleted booking",
  "Delete deleted booking",
];

const names = requests.map((item) => item.name);
for (const name of required) {
  if (!names.includes(name)) {
    throw new Error(`Collection is missing request: ${name}`);
  }
}

function checkScript(label, source) {
  try {
    // Parse only. Scripts run later inside Newman.
    new Function(source);
  } catch (error) {
    throw new Error(`${label} is not valid JavaScript: ${error.message}`);
  }
}

for (const event of collection.event || []) {
  checkScript("collection pre-request", event.script.exec.join("\n"));
}

for (const item of requests) {
  for (const event of item.event || []) {
    checkScript(`${item.name} ${event.listen}`, event.script.exec.join("\n"));
  }
}

const outDir = path.join(root, "collections");
const outFile = path.join(outDir, "restful-booker.postman_collection.json");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(collection, null, 2)}\n`);
console.log(`Wrote ${path.relative(root, outFile)} (${names.length} requests)`);
