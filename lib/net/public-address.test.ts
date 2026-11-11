import assert from "node:assert/strict";
import test from "node:test";
import { isPublicAddress, parsePublicUrl, UnsafeUrlError } from "./public-address";

test("ordinary internet addresses pass", () => {
  for (const address of ["93.184.216.34", "8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "[2606:4700:4700::1111]"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
});

test("this machine, private networks, and metadata endpoints are refused", () => {
  for (const address of [
    "127.0.0.1",
    "127.255.255.254",
    "0.0.0.0",
    "10.0.0.5",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fe80::1%eth0",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:169.254.169.254",
    "64:ff9b::7f00:1",
  ]) {
    assert.equal(isPublicAddress(address), false, address);
  }
});

test("anything that is not an address is refused", () => {
  for (const address of ["", "example.com", "999.1.1.1", "1.2.3", "not-an-ip"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("172.32.0.1"), true, "just outside the private block");
  assert.equal(isPublicAddress("::ffff:8.8.8.8"), true);
});

test("a pasted link must be a plain public web address", () => {
  assert.equal(parsePublicUrl(" https://example.com/a?b=1 ").hostname, "example.com");
  assert.equal(parsePublicUrl("http://example.com:80/").hostname, "example.com");
  for (const link of [
    "not a link",
    "ftp://example.com/file",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://localhost:3100/",
    "http://app.localhost/",
    "http://printer.local/",
    "http://db.internal/",
    "http://intranet/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/admin",
    "https://user:pass@example.com/",
    "https://example.com:8443/",
    "http://example.com:22/",
  ]) {
    assert.throws(() => parsePublicUrl(link), UnsafeUrlError, link);
  }
});
