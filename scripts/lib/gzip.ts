import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export function writeJsonGz(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, zlib.gzipSync(Buffer.from(JSON.stringify(value)), { level: 6 }));
}

export function readJsonGz<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8")) as T;
  } catch {
    return fallback;
  }
}
