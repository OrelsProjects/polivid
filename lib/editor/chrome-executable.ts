import "server-only";
import { access, cp, readFile, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureBrowser } from "@remotion/renderer";

/** macOS blocks helper processes launched from these folders from reading Chrome's own files. */
const SANDBOXED_HOME_DIRS = new Set(["Documents", "Desktop", "Downloads"]);

const isMacProtectedPath = (executablePath: string) => {
  if (process.platform !== "darwin") return false;
  const relative = path.relative(os.homedir(), executablePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
  const [top] = relative.split(path.sep);
  return top !== undefined && SANDBOXED_HOME_DIRS.has(top);
};

const executableOutsideProtectedFolders = async (sourceExecutable: string) => {
  if (!isMacProtectedPath(sourceExecutable)) return sourceExecutable;

  const sourceDir = path.dirname(sourceExecutable);
  const versionPath = path.join(sourceDir, "..", "..", "VERSION");
  const version = (await readFile(versionPath, "utf8").catch(() => "unknown")).trim() || "unknown";
  const destDir = path.join(
    os.homedir(),
    "Library",
    "Caches",
    "polivid-chrome",
    version,
    path.basename(sourceDir),
  );
  const destExecutable = path.join(destDir, path.basename(sourceExecutable));

  try {
    await access(destExecutable);
    return destExecutable;
  } catch {
    const staging = `${destDir}.partial`;
    await rm(staging, { recursive: true, force: true });
    await cp(sourceDir, staging, { recursive: true });
    await rm(destDir, { recursive: true, force: true });
    await rename(staging, destDir);
    return destExecutable;
  }
};

let chromeExecutable: Promise<string> | null = null;

/** Chrome Headless Shell path that can actually start on this machine. */
export const chromeForRender = () => {
  if (chromeExecutable) return chromeExecutable;
  chromeExecutable = ensureBrowser()
    .then(async (status) => {
      if (status.type !== "local-puppeteer-browser" && status.type !== "user-defined-path") {
        throw new Error("Chrome for video export is not installed.");
      }
      return executableOutsideProtectedFolders(status.path);
    })
    .catch((error: unknown) => {
      chromeExecutable = null;
      throw error;
    });
  return chromeExecutable;
};
