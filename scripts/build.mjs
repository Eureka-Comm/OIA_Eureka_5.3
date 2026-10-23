import { cp, mkdir, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });
await cp(resolve(root, "worker"), resolve(dist, "server"), { recursive: true });
console.log(`Built ${dist}`);
