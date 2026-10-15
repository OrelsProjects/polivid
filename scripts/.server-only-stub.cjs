const Module = require("node:module");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return require.resolve("./.empty.cjs");
  return original.call(this, request, ...rest);
};
