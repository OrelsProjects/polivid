/**
 * Lets scripts/worker.ts load server code outside Next.js.
 *
 * Server modules import "server-only", which throws unless the react-server condition is set. That
 * condition can't be used here: some of the same modules import next/navigation, which needs the
 * full React build. So this maps "server-only" to an empty module and the worker runs with plain
 * Node conditions. It only ever runs on the server, so the guard has nothing to protect.
 */
/* eslint-disable @typescript-eslint/no-require-imports -- a --require preload must be CommonJS */
const Module = require("node:module");
const path = require("node:path");

const EMPTY = path.join(__dirname, "server-only-empty.cjs");
const resolve = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return EMPTY;
  return resolve.call(this, request, ...rest);
};
