import { BlockList, isIP } from "node:net";

/**
 * Addresses a server-side fetch must never reach: this machine, the private network
 * around it, cloud metadata endpoints, and ranges that are reserved or not routable.
 */
const blocked = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(network, prefix, "ipv6");
}

/** The IPv4 address inside an IPv4-mapped IPv6 one (`::ffff:10.0.0.1`), or null. */
const mappedIpv4 = (address: string) => {
  const dotted = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (dotted) return dotted[1] ?? null;
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(address);
  if (!hex) return null;
  const high = Number.parseInt(hex[1] ?? "", 16);
  const low = Number.parseInt(hex[2] ?? "", 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
};

/** True only for an address on the public internet. Anything that does not parse is refused. */
export const isPublicAddress = (address: string): boolean => {
  const bare = address.replace(/^\[|\]$/g, "").split("%")[0] ?? "";
  const family = isIP(bare);
  if (family === 4) return !blocked.check(bare, "ipv4");
  if (family !== 6) return false;
  const mapped = mappedIpv4(bare);
  if (mapped) return isPublicAddress(mapped);
  return !blocked.check(bare, "ipv6");
};

export class UnsafeUrlError extends Error {
  constructor(message = "That link can't be opened from here.") {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * Parses a link someone pasted and refuses the ones no page fetch should follow:
 * other schemes, embedded sign-in details, odd ports, and addresses that are not public.
 * A host name still has to pass the address check when it is resolved.
 */
export const parsePublicUrl = (raw: string): URL => {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new UnsafeUrlError("That doesn't look like a link. Paste the full address, starting with https://.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("Only web links work here. Paste one that starts with https://.");
  }
  if (url.username || url.password) throw new UnsafeUrlError();
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError();
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new UnsafeUrlError();
  }
  if (isIP(host) && !isPublicAddress(host)) throw new UnsafeUrlError();
  if (!isIP(host) && !host.includes(".")) throw new UnsafeUrlError();
  return url;
};
