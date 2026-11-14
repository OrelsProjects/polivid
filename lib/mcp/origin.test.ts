import assert from "node:assert/strict";
import test from "node:test";
import { mcpResourceUrl, protectedResourceMetadataUrl, publicOrigin } from "./origin";

const withEnv = (value: string | undefined, run: () => void) => {
  const before = process.env.APP_PUBLIC_URL;
  if (value === undefined) delete process.env.APP_PUBLIC_URL;
  else process.env.APP_PUBLIC_URL = value;
  try {
    run();
  } finally {
    if (before === undefined) delete process.env.APP_PUBLIC_URL;
    else process.env.APP_PUBLIC_URL = before;
  }
};

test("APP_PUBLIC_URL counts only for its origin", () => {
  for (const value of ["https://www.example.com", "https://www.example.com/", "https://www.example.com/api/mcp"]) {
    withEnv(value, () => {
      assert.equal(publicOrigin(), "https://www.example.com");
      assert.equal(mcpResourceUrl(), "https://www.example.com/api/mcp");
      assert.equal(protectedResourceMetadataUrl(), "https://www.example.com/.well-known/oauth-protected-resource/api/mcp");
    });
  }
});

test("without a usable APP_PUBLIC_URL the request origin is used", () => {
  withEnv(undefined, () => assert.equal(publicOrigin(new Request("http://localhost:3100/api/mcp")), "http://localhost:3100"));
  withEnv("not a url", () => assert.equal(publicOrigin(new Request("https://a.example/x")), "https://a.example"));
});
