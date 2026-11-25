/**
 * Registers a partner product, or rotates its secrets. Prints the partner secret and the webhook
 * secret once: only a hash of the partner secret is stored, so it can't be shown again.
 *
 * Usage: npm run partner:create -- <id> "<Name>" "<Brand name>" [webhookUrl]
 */
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashToken, newToken } from "@/lib/mcp/auth/tokens";

const main = async () => {
  const [id, name, brandName, webhookUrl] = process.argv.slice(2);
  if (!id || !/^[a-z0-9-]{2,32}$/.test(id) || !name || !brandName) {
    console.error('Usage: npm run partner:create -- <id> "<Name>" "<Brand name>" [webhookUrl]');
    process.exit(1);
  }
  if (webhookUrl && !/^https:\/\//.test(webhookUrl) && !/^http:\/\/localhost[:/]/.test(webhookUrl)) {
    console.error("The webhook URL must be https (or http://localhost for testing).");
    process.exit(1);
  }
  const secret = newToken("partner");
  const webhookSecret = `whsec_${randomBytes(32).toString("base64url")}`;
  const data = { name, brandName, secretHash: hashToken(secret), webhookUrl: webhookUrl || null, webhookSecret, active: true };
  await db.partner.upsert({ where: { id }, create: { id, ...data }, update: data });
  console.log(`Partner "${id}" is ready. Save these now; the partner secret can't be shown again.\n`);
  console.log(`VIDEO_PARTNER_SECRET=${secret}`);
  console.log(`VIDEO_WEBHOOK_SECRET=${webhookSecret}`);
  process.exit(0);
};

main().catch((error) => {
  console.error("Could not register the partner", error);
  process.exit(1);
});
