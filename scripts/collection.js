"use strict";

// Source for the Restful Booker Postman collection.
//
// npm run build writes collections/restful-booker.postman_collection.json.
// Requests run top to bottom. Pre-request scripts set the payload, and test
// scripts save the token and booking ids that later requests read back.

const COLLECTION_ID = "6f0c2e4a-91b7-4d5e-8a33-c1d4e7f09b2a";

const BOOKING_BODY = `{
  "firstname": "{{firstname}}",
  "lastname": "{{lastname}}",
  "totalprice": {{totalprice}},
  "depositpaid": {{depositpaid}},
  "bookingdates": {
    "checkin": "{{checkin}}",
    "checkout": "{{checkout}}"
  },
  "additionalneeds": "{{additionalneeds}}",
  "clientRef": "portfolio-demo"
}`;

const PATCH_BODY = `{
  "additionalneeds": "{{additionalneeds}}"
}`;

const AUTH_BODY = `{
  "username": "{{username}}",
  "password": "{{password}}"
}`;

const BAD_AUTH_BODY = `{
  "username": "{{username}}",
  "password": "not-the-demo-password"
}`;

function script(listen, source) {
  return {
    listen,
    script: {
      type: "text/javascript",
      exec: source.replace(/\s+$/, "").split("\n"),
    },
  };
}

function tests(...blocks) {
  return blocks.filter(Boolean).join("\n\n");
}

function header(key, value) {
  return { key, value };
}

function jsonHeaders(...extra) {
  return [
    header("Accept", "application/json"),
    header("Content-Type", "application/json"),
    ...extra,
  ];
}

function readHeaders(...extra) {
  return [header("Accept", "application/json"), ...extra];
}

const TOKEN_COOKIE = header("Cookie", "token={{token}}");
const INVALID_COOKIE = header("Cookie", "token=invalid-token");

function request(options) {
  const events = [];
  if (options.prerequest) {
    events.push(script("prerequest", options.prerequest));
  }
  if (options.tests) {
    events.push(script("test", options.tests));
  }

  const req = {
    method: options.method,
    header: options.header,
    url: options.url,
  };

  if (options.body !== undefined) {
    req.body = {
      mode: "raw",
      raw: options.body,
      options: {
        raw: {
          language: options.language || "json",
        },
      },
    };
  }

  return {
    name: options.name,
    description: options.description,
    event: events,
    request: req,
  };
}

function folder(name, description, item) {
  return { name, description, item };
}

function expectStatus(code, name) {
  return `pm.test(${JSON.stringify(name)}, function () {
  pm.response.to.have.status(${code});
});`;
}

function expectText(text, name) {
  return `pm.test(${JSON.stringify(name)}, function () {
  pm.expect(pm.response.text().trim()).to.eql(${JSON.stringify(text)});
});`;
}

function expectType(part, name) {
  return `pm.test(${JSON.stringify(name)}, function () {
  const contentType = pm.response.headers.get("Content-Type") || "";
  pm.expect(contentType).to.include(${JSON.stringify(part)});
});`;
}

function expectSchema(key, name) {
  return `pm.test(${JSON.stringify(name)}, function () {
  const schemas = JSON.parse(pm.collectionVariables.get("schemas"));
  pm.response.to.have.jsonSchema(schemas[${JSON.stringify(key)}]);
});`;
}

function requireChained(varName, regexLiteral, hint) {
  return `pm.test(${JSON.stringify(`${varName} was chained from an earlier request`)}, function () {
  pm.expect(pm.collectionVariables.get(${JSON.stringify(varName)}), ${JSON.stringify(hint)}).to.match(${regexLiteral});
});`;
}

function saveToken() {
  return `pm.test("token is saved for chained write requests", function () {
  const token = pm.response.json().token;
  pm.expect(token).to.match(/^[A-Za-z0-9]+$/);
  pm.collectionVariables.set("token", token);
  pm.collectionVariables.set("tokenCheckpoint", token);
});`;
}

function tokenUnchanged() {
  return `pm.test("failed login does not replace the saved token", function () {
  pm.expect(pm.collectionVariables.get("token")).to.eql(pm.collectionVariables.get("tokenCheckpoint"));
});

pm.test("failed login response has no token", function () {
  pm.expect(pm.response.json()).to.not.have.property("token");
});`;
}

function saveBookingId(varName) {
  return `pm.test("booking id is saved for chained requests", function () {
  const bookingId = pm.response.json().bookingid;
  pm.expect(bookingId).to.be.a("number").and.above(0);
  pm.collectionVariables.set(${JSON.stringify(varName)}, String(bookingId));
  console.log(${JSON.stringify(`${varName}=`)} + bookingId);
});`;
}

function expectStored(name) {
  return `pm.test(${JSON.stringify(name)}, function () {
  const payload = pm.response.json();
  const booking = Object.prototype.hasOwnProperty.call(payload, "booking") ? payload.booking : payload;
  pm.expect(booking.firstname).to.eql(pm.collectionVariables.get("firstname"));
  pm.expect(booking.lastname).to.eql(pm.collectionVariables.get("lastname"));
  pm.expect(booking.totalprice).to.eql(Number(pm.collectionVariables.get("totalprice")));
  pm.expect(booking.depositpaid).to.eql(pm.collectionVariables.get("depositpaid") === "true");
  pm.expect(booking.bookingdates.checkin).to.eql(pm.collectionVariables.get("checkin"));
  pm.expect(booking.bookingdates.checkout).to.eql(pm.collectionVariables.get("checkout"));
  pm.expect(booking.additionalneeds).to.eql(pm.collectionVariables.get("additionalneeds"));
  pm.expect(booking).to.not.have.property("clientRef");
});`;
}

function expectInvertedDates() {
  return `pm.test("checkout before checkin is currently accepted", function () {
  const dates = pm.response.json().booking.bookingdates;
  pm.expect(dates.checkout < dates.checkin).to.eql(true);
});`;
}

function expectFoundInFilter() {
  return `pm.test("filtered ids include the created booking and not the whole dataset", function () {
  const ids = pm.response.json().map(function (row) { return row.bookingid; });
  pm.expect(ids).to.include(Number(pm.collectionVariables.get("bookingId")));
  pm.expect(ids.length).to.be.above(0).and.below(5);
});`;
}

function jsonOk(schemaKey, schemaName) {
  return tests(
    expectStatus(200, "status is 200"),
    expectType("application/json", "content type is JSON"),
    expectSchema(schemaKey, schemaName)
  );
}

function plainError(code, body) {
  return tests(
    expectStatus(code, `status is ${code}`),
    expectType("text/plain", "content type is plain text"),
    expectText(body, `body is ${body}`)
  );
}

function assignBooking(fields) {
  return [
    "// Unique first name so this run does not collide with other users of the public demo.",
    "const suffix = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);",
    `pm.collectionVariables.set("firstname", ${JSON.stringify(fields.prefix)} + suffix);`,
    `pm.collectionVariables.set("lastname", ${JSON.stringify(fields.lastname)});`,
    `pm.collectionVariables.set("totalprice", ${JSON.stringify(String(fields.totalprice))});`,
    `pm.collectionVariables.set("depositpaid", ${JSON.stringify(String(fields.depositpaid))});`,
    `pm.collectionVariables.set("checkin", ${JSON.stringify(fields.checkin)});`,
    `pm.collectionVariables.set("checkout", ${JSON.stringify(fields.checkout)});`,
    `pm.collectionVariables.set("additionalneeds", ${JSON.stringify(fields.additionalneeds)});`,
  ].join("\n");
}

function setFields(fields) {
  const lines = ["// Values the next response must echo."];
  for (const [key, value] of Object.entries(fields)) {
    lines.push(
      `pm.collectionVariables.set(${JSON.stringify(key)}, ${JSON.stringify(String(value))});`
    );
  }
  return lines.join("\n");
}

function schemaBootstrap(schemas) {
  return [
    "// Embedded from schemas/*.json by scripts/build-collection.js.",
    "// Request tests read this variable so every assertion uses the same contract.",
    `const schemas = ${JSON.stringify(schemas, null, 2)};`,
    'pm.collectionVariables.set("schemas", JSON.stringify(schemas));',
  ].join("\n");
}

function buildCollection(schemas) {
  const createdBooking = {
    description: "POST /booking response. The new id is returned beside the stored booking.",
    type: "object",
    additionalProperties: false,
    required: ["bookingid", "booking"],
    properties: {
      bookingid: { type: "integer", minimum: 1 },
      booking: schemas.booking,
    },
  };

  const embedded = {
    booking: schemas.booking,
    createdBooking,
    token: schemas.token,
    authError: schemas.authError,
    bookingIdList: schemas.bookingIdList,
  };

  return {
    info: {
      _postman_id: COLLECTION_ID,
      name: "Restful Booker API",
      description: [
        "Portfolio demo collection for the public Restful Booker API.",
        "Run the folders in order. Later requests reuse the token and booking ids saved by earlier ones.",
        "Username and password default to the public demo credentials published by that API (admin / password123).",
        "Generated from scripts/collection.js. Edit that file, then run npm run build.",
      ].join("\n\n"),
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl", value: "https://restful-booker.herokuapp.com" },
      { key: "username", value: "admin" },
      { key: "password", value: "password123" },
      { key: "token", value: "" },
      { key: "tokenCheckpoint", value: "" },
      { key: "bookingId", value: "" },
      { key: "negativeBookingId", value: "" },
      { key: "edgeBookingId", value: "" },
      { key: "firstname", value: "" },
      { key: "lastname", value: "" },
      { key: "totalprice", value: "" },
      { key: "depositpaid", value: "" },
      { key: "checkin", value: "" },
      { key: "checkout", value: "" },
      { key: "additionalneeds", value: "" },
    ],
    event: [script("prerequest", schemaBootstrap(embedded))],
    item: [
      folder(
        "01 Health",
        "Liveness check. GET /ping returns 201 and the plain text Created.",
        [
          request({
            name: "Ping",
            description: "Confirms the demo process is accepting requests before the suite creates anything.",
            method: "GET",
            header: readHeaders(),
            url: "{{baseUrl}}/ping",
            tests: tests(
              expectStatus(201, "status is 201 Created"),
              expectType("text/plain", "content type is plain text"),
              expectText("Created", "body reports the service is up")
            ),
          }),
        ]
      ),
      folder(
        "02 Authentication",
        "Creates the token write requests send as a Cookie, then checks that a bad password and a non-JSON content type do not issue a token or replace the saved one. A failed login is HTTP 200 with reason Bad credentials.",
        [
          request({
            name: "Create token",
            description: "POST /auth with the public demo username and password. Saves the token for later writes.",
            method: "POST",
            header: jsonHeaders(),
            url: "{{baseUrl}}/auth",
            body: AUTH_BODY,
            tests: tests(
              jsonOk("token", "body matches the token schema"),
              saveToken()
            ),
          }),
          request({
            name: "Reject bad credentials",
            description: "Same user, wrong password. The saved token from Create token must stay in place.",
            method: "POST",
            header: jsonHeaders(),
            url: "{{baseUrl}}/auth",
            body: BAD_AUTH_BODY,
            tests: tests(
              jsonOk("authError", "body matches the auth error schema"),
              tokenUnchanged()
            ),
          }),
          request({
            name: "Reject non-JSON login",
            description: "The demo treats a login that is not application/json as bad credentials, even when the body is the right JSON text.",
            method: "POST",
            header: [
              header("Accept", "application/json"),
              header("Content-Type", "text/plain"),
            ],
            url: "{{baseUrl}}/auth",
            body: AUTH_BODY,
            language: "text",
            tests: tests(
              jsonOk("authError", "body matches the auth error schema"),
              tokenUnchanged()
            ),
          }),
        ]
      ),
      folder(
        "03 Booking lifecycle",
        "One booking, created with a unique name, then read, filtered, replaced, partially updated, and deleted. Later requests use the id and token saved above. Writes send an unknown clientRef field, which must not be stored.",
        [
          request({
            name: "Create booking",
            description: "POST /booking. No token is required to create. Saves bookingId.",
            method: "POST",
            header: jsonHeaders(),
            url: "{{baseUrl}}/booking",
            body: BOOKING_BODY,
            prerequest: assignBooking({
              prefix: "Port",
              lastname: "Newman",
              totalprice: 222,
              depositpaid: true,
              checkin: "2026-06-01",
              checkout: "2026-06-10",
              additionalneeds: "Breakfast",
            }),
            tests: tests(
              jsonOk("createdBooking", "body matches the created-booking schema"),
              saveBookingId("bookingId"),
              expectStored("created booking echoes the request and drops clientRef")
            ),
          }),
          request({
            name: "Get booking",
            description: "GET /booking/:id. The stored document must match the create payload.",
            method: "GET",
            header: readHeaders(),
            url: "{{baseUrl}}/booking/{{bookingId}}",
            tests: tests(
              requireChained("bookingId", "/^[0-9]+$/", "Run Create booking first."),
              jsonOk("booking", "body matches the booking schema"),
              expectStored("stored booking matches the create payload")
            ),
          }),
          request({
            name: "Find booking by name",
            description: "GET /booking?firstname&lastname. The filter must return this run's id and not the full dataset.",
            method: "GET",
            header: readHeaders(),
            url: "{{baseUrl}}/booking?firstname={{firstname}}&lastname={{lastname}}",
            tests: tests(
              requireChained("bookingId", "/^[0-9]+$/", "Run Create booking first."),
              jsonOk("bookingIdList", "body matches the booking id list schema"),
              expectFoundInFilter()
            ),
          }),
          request({
            name: "Replace booking",
            description: "PUT /booking/:id with the Cookie token. Replaces every field.",
            method: "PUT",
            header: jsonHeaders(TOKEN_COOKIE),
            url: "{{baseUrl}}/booking/{{bookingId}}",
            body: BOOKING_BODY,
            prerequest: setFields({
              lastname: "Updated",
              totalprice: 333,
              depositpaid: false,
              checkin: "2026-07-01",
              checkout: "2026-07-10",
              additionalneeds: "Lunch",
            }),
            tests: tests(
              requireChained("token", "/^[A-Za-z0-9]+$/", "Run Create token first."),
              requireChained("bookingId", "/^[0-9]+$/", "Run Create booking first."),
              jsonOk("booking", "body matches the booking schema"),
              expectStored("replacement echoes the new payload and drops clientRef")
            ),
          }),
          request({
            name: "Confirm replaced booking",
            description: "Read-after-write. The replacement must be what a later GET returns, not only what PUT echoed.",
            method: "GET",
            header: readHeaders(),
            url: "{{baseUrl}}/booking/{{bookingId}}",
            tests: tests(
              requireChained("bookingId", "/^[0-9]+$/", "Run Create booking first."),
              jsonOk("booking", "body matches the booking schema"),
              expectStored("stored booking matches the replacement")
            ),
          }),
          request({
            name: "Patch additional needs",
            description: "PATCH /booking/:id changes additionalneeds only. Price, dates, and name must stay at the replaced values.",
            method: "PATCH",
            header: jsonHeaders(TOKEN_COOKIE),
            url: "{{baseUrl}}/booking/{{bookingId}}",
            body: PATCH_BODY,
            prerequest: setFields({ additionalneeds: "Dinner" }),
            tests: tests(
              requireChained("token", "/^[A-Za-z0-9]+$/", "Run Create token first."),
              requireChained("bookingId", "/^[0-9]+$/", "Run Create booking first."),
              jsonOk("booking", "body matches the booking schema"),
              expectStored("partial update changes additionalneeds and keeps the other fields")
            ),
          }),
          request({
            name: "Confirm patched booking",
            description: "Read-after-write for the partial update.",
            method: "GET",
            header: readHeaders(),
            url: "{{baseUrl}}/booking/{{bookingId}}",
            tests: tests(
              requireChained("bookingId", "/^[0-9]+$/", "Run Create booking first."),
              jsonOk("booking", "body matches the booking schema"),
              expectStored("stored booking matches the partial update")
            ),
          }),
          request({
            name: "Delete booking",
            description: "DELETE /booking/:id with the Cookie token. The demo returns 201 Created.",
            method: "DELETE",
            header: readHeaders(TOKEN_COOKIE),
            url: "{{baseUrl}}/booking/{{bookingId}}",
            tests: tests(
              requireChained("token", "/^[A-Za-z0-9]+$/", "Run Create token first."),
              requireChained("bookingId", "/^[0-9]+$/", "Run Create booking first."),
              expectStatus(201, "status is 201 Created"),
              expectText("Created", "body acknowledges the delete")
            ),
          }),
          request({
            name: "Confirm booking deleted",
            description: "The deleted id must now 404.",
            method: "GET",
            header: readHeaders(),
            url: "{{baseUrl}}/booking/{{bookingId}}",
            tests: tests(
              requireChained("bookingId", "/^[0-9]+$/", "Run Create booking first."),
              plainError(404, "Not Found")
            ),
          }),
        ]
      ),
      folder(
        "04 Negative cases",
        "Authorization failures, unknown ids, malformed creates, and a characterization of the missing stay-date check. Bookings created here are deleted before the folder ends.",
        [
          request({
            name: "Create booking with empty body",
            description: "POST /booking {}. The demo responds with a plain-text 500 rather than a structured 400.",
            method: "POST",
            header: jsonHeaders(),
            url: "{{baseUrl}}/booking",
            body: "{}",
            tests: plainError(500, "Internal Server Error"),
          }),
          request({
            name: "Create booking missing firstname",
            description: "A payload without firstname is also a plain-text 500.",
            method: "POST",
            header: jsonHeaders(),
            url: "{{baseUrl}}/booking",
            body: `{
  "lastname": "Newman",
  "totalprice": 100,
  "depositpaid": true,
  "bookingdates": {
    "checkin": "2026-06-01",
    "checkout": "2026-06-02"
  },
  "additionalneeds": "Breakfast"
}`,
            tests: plainError(500, "Internal Server Error"),
          }),
          request({
            name: "Create booking with inverted dates",
            description: "Checkout is before checkin. The demo accepts the stay and echoes the dates. This locks that gap so a future validation change fails the suite on purpose.",
            method: "POST",
            header: jsonHeaders(),
            url: "{{baseUrl}}/booking",
            body: BOOKING_BODY,
            prerequest: assignBooking({
              prefix: "Edge",
              lastname: "Dates",
              totalprice: 150,
              depositpaid: true,
              checkin: "2026-08-10",
              checkout: "2026-08-01",
              additionalneeds: "Late checkout",
            }),
            tests: tests(
              jsonOk("createdBooking", "body matches the created-booking schema"),
              saveBookingId("edgeBookingId"),
              expectStored("inverted dates are echoed and clientRef is dropped"),
              expectInvertedDates()
            ),
          }),
          request({
            name: "Delete inverted-date booking",
            description: "Removes the characterization booking so the shared demo is not left with it.",
            method: "DELETE",
            header: readHeaders(TOKEN_COOKIE),
            url: "{{baseUrl}}/booking/{{edgeBookingId}}",
            tests: tests(
              requireChained("token", "/^[A-Za-z0-9]+$/", "Run Create token first."),
              requireChained("edgeBookingId", "/^[0-9]+$/", "Run Create booking with inverted dates first."),
              expectStatus(201, "status is 201 Created"),
              expectText("Created", "body acknowledges the delete")
            ),
          }),
          request({
            name: "Get unknown booking",
            description: "GET /booking/999999999. An id the demo has not issued returns 404.",
            method: "GET",
            header: readHeaders(),
            url: "{{baseUrl}}/booking/999999999",
            tests: plainError(404, "Not Found"),
          }),
          request({
            name: "Create booking for authz checks",
            description: "A second booking used only to prove writes fail closed without a valid token. Deleted at the end of the folder.",
            method: "POST",
            header: jsonHeaders(),
            url: "{{baseUrl}}/booking",
            body: BOOKING_BODY,
            prerequest: assignBooking({
              prefix: "Authz",
              lastname: "Check",
              totalprice: 80,
              depositpaid: false,
              checkin: "2026-09-01",
              checkout: "2026-09-04",
              additionalneeds: "None",
            }),
            tests: tests(
              jsonOk("createdBooking", "body matches the created-booking schema"),
              saveBookingId("negativeBookingId"),
              expectStored("authz booking echoes the request and drops clientRef")
            ),
          }),
          request({
            name: "Update without token",
            description: "PUT with no Cookie. The booking must stay unchanged and the response is 403.",
            method: "PUT",
            header: jsonHeaders(),
            url: "{{baseUrl}}/booking/{{negativeBookingId}}",
            body: BOOKING_BODY,
            tests: tests(
              requireChained("negativeBookingId", "/^[0-9]+$/", "Run Create booking for authz checks first."),
              plainError(403, "Forbidden")
            ),
          }),
          request({
            name: "Update with invalid token",
            description: "PUT with Cookie token=invalid-token. Also 403. Does not clear the real token.",
            method: "PUT",
            header: jsonHeaders(INVALID_COOKIE),
            url: "{{baseUrl}}/booking/{{negativeBookingId}}",
            body: BOOKING_BODY,
            tests: tests(
              requireChained("negativeBookingId", "/^[0-9]+$/", "Run Create booking for authz checks first."),
              requireChained("token", "/^[A-Za-z0-9]+$/", "Run Create token first."),
              plainError(403, "Forbidden")
            ),
          }),
          request({
            name: "Delete without token",
            description: "DELETE with no Cookie is 403, so the booking still exists for the authorized delete below.",
            method: "DELETE",
            header: readHeaders(),
            url: "{{baseUrl}}/booking/{{negativeBookingId}}",
            tests: tests(
              requireChained("negativeBookingId", "/^[0-9]+$/", "Run Create booking for authz checks first."),
              plainError(403, "Forbidden")
            ),
          }),
          request({
            name: "Confirm authz booking unchanged",
            description: "The forbidden writes must leave the stored booking as it was created.",
            method: "GET",
            header: readHeaders(),
            url: "{{baseUrl}}/booking/{{negativeBookingId}}",
            tests: tests(
              requireChained("negativeBookingId", "/^[0-9]+$/", "Run Create booking for authz checks first."),
              jsonOk("booking", "body matches the booking schema"),
              expectStored("forbidden writes left the stored booking unchanged")
            ),
          }),
          request({
            name: "Delete booking used for authz checks",
            description: "Authorized delete of the negative-path booking.",
            method: "DELETE",
            header: readHeaders(TOKEN_COOKIE),
            url: "{{baseUrl}}/booking/{{negativeBookingId}}",
            tests: tests(
              requireChained("token", "/^[A-Za-z0-9]+$/", "Run Create token first."),
              requireChained("negativeBookingId", "/^[0-9]+$/", "Run Create booking for authz checks first."),
              expectStatus(201, "status is 201 Created"),
              expectText("Created", "body acknowledges the delete")
            ),
          }),
          request({
            name: "Confirm authz booking deleted",
            description: "The authz booking id must 404 after the authorized delete.",
            method: "GET",
            header: readHeaders(),
            url: "{{baseUrl}}/booking/{{negativeBookingId}}",
            tests: tests(
              requireChained("negativeBookingId", "/^[0-9]+$/", "Run Create booking for authz checks first."),
              plainError(404, "Not Found")
            ),
          }),
          request({
            name: "Update deleted booking",
            description: "PUT to an id that was just deleted. The demo returns 405 Method Not Allowed, not 404.",
            method: "PUT",
            header: jsonHeaders(TOKEN_COOKIE),
            url: "{{baseUrl}}/booking/{{negativeBookingId}}",
            body: BOOKING_BODY,
            tests: tests(
              requireChained("token", "/^[A-Za-z0-9]+$/", "Run Create token first."),
              requireChained("negativeBookingId", "/^[0-9]+$/", "Run Create booking for authz checks first."),
              plainError(405, "Method Not Allowed")
            ),
          }),
          request({
            name: "Delete deleted booking",
            description: "DELETE of an already removed id is also 405.",
            method: "DELETE",
            header: readHeaders(TOKEN_COOKIE),
            url: "{{baseUrl}}/booking/{{negativeBookingId}}",
            tests: tests(
              requireChained("token", "/^[A-Za-z0-9]+$/", "Run Create token first."),
              requireChained("negativeBookingId", "/^[0-9]+$/", "Run Create booking for authz checks first."),
              plainError(405, "Method Not Allowed")
            ),
          }),
        ]
      ),
    ],
  };
}

module.exports = { buildCollection };
