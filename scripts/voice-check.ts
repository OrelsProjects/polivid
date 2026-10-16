import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { changeVoice, separateVocal } from "../lib/music/sing-as";

const main = async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (["require", "prefer", "verify-ca"].includes(url.searchParams.get("sslmode") ?? "")) url.searchParams.set("uselibpqcompat", "true");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const character = await db.character.findUniqueOrThrow({
    where: { id: "2be356ee-146a-4bbd-a478-93f612ba8375" },
    select: { providerVoiceId: true, voiceSource: true },
  });
  await db.$disconnect();
  const song = new Uint8Array(await readFile("/tmp/polivid-last-song.mp3"));
  const stems = await separateVocal(song);
  const sung = await changeVoice(stems.vocal, character.providerVoiceId!);
  const desktop = path.join(os.homedir(), "Desktop", "voice-check");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(desktop, { recursive: true });
  await writeFile(path.join(desktop, "1-original-singer-vocal.mp3"), stems.vocal);
  await writeFile(path.join(desktop, "2-orel-vocal.mp3"), sung);
  stems.backing.forEach((_, index) => index);
  console.log(JSON.stringify({ voiceSource: character.voiceSource, backing: stems.backing.length, folder: desktop }));
};

void main();
