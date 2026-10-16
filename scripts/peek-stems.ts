import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { unzipSync } from "fflate";

config({ path: ".env", quiet: true });
config({ path: ".env.local", quiet: true });

const main = async () => {
  const song = await readFile("/tmp/polivid-last-song.mp3");
  const form = new FormData();
  form.append("file", new Blob([song], { type: "audio/mpeg" }), "song.mp3");
  const response = await fetch("https://api.elevenlabs.io/v1/music/stem-separation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!.trim() },
    body: form,
  });
  console.log(JSON.stringify({ status: response.status, type: response.headers.get("content-type") }));
  if (!response.ok) {
    console.log((await response.text()).slice(0, 400));
    return;
  }
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  console.log(JSON.stringify(Object.entries(files).map(([name, bytes]) => ({ name, bytes: bytes.byteLength }))));
};

void main();
