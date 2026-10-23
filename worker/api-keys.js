import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const supportedScopes = new Set(["eureka:read", "eureka:invoke"]);

function hashKey(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function createApiKeyStore(dataDirectory) {
  const file = join(dataDirectory, "api-keys.json");
  let writeQueue = Promise.resolve();

  async function readStore() {
    try {
      const value = JSON.parse(await readFile(file, "utf8"));
      return Array.isArray(value.keys) ? value : { keys: [] };
    } catch (error) {
      if (error.code === "ENOENT") return { keys: [] };
      throw error;
    }
  }

  function updateStore(update) {
    const operation = writeQueue.then(async () => {
      const state = await readStore();
      const result = await update(state);
      await mkdir(dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
      await rename(temporary, file);
      return result;
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  return {
    async verify(token, requiredScope) {
      if (typeof token !== "string" || !/^euk_live_[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: "invalid" };
      const digest = Buffer.from(hashKey(token), "hex");
      await writeQueue;
      const state = await readStore();
      let match = null;
      for (const key of state.keys) {
        if (key.revokedAt || !/^[a-f0-9]{64}$/.test(key.digest || "")) continue;
        if (timingSafeEqual(digest, Buffer.from(key.digest, "hex"))) match = key;
      }
      if (!match) return { ok: false, reason: "invalid" };
      if (!match.scopes?.includes(requiredScope)) return { ok: false, reason: "scope" };
      const previous = Date.parse(match.lastUsedAt || "") || 0;
      if (Date.now() - previous >= 5 * 60 * 1000) await updateStore(current => {
        const active = current.keys.find(key => key.id === match.id && !key.revokedAt);
        if (active) active.lastUsedAt = new Date().toISOString();
      });
      return { ok: true, keyId: match.id, scopes: [...match.scopes] };
    },
  };
}

export async function createApiKey({ dataDirectory, name, scopes = ["eureka:read", "eureka:invoke"] }) {
  const cleanName = typeof name === "string" ? name.trim().slice(0, 80) : "";
  if (!cleanName) throw new Error("Indica un nombre para identificar la clave.");
  const cleanScopes = [...new Set(scopes)];
  if (!cleanScopes.length || cleanScopes.some(scope => !supportedScopes.has(scope))) throw new Error(`Los permisos admitidos son: ${[...supportedScopes].join(", ")}.`);
  const token = `euk_live_${randomBytes(32).toString("base64url")}`;
  const file = join(dataDirectory, "api-keys.json");
  const operation = (async () => {
    let state;
    try { state = JSON.parse(await readFile(file, "utf8")); }
    catch (error) { if (error.code === "ENOENT") state = { keys: [] }; else throw error; }
    const now = new Date().toISOString();
    const entry = { id: `key_${randomUUID()}`, name: cleanName, digest: hashKey(token), scopes: cleanScopes, createdAt: now, lastUsedAt: null, revokedAt: null };
    state.keys ||= [];
    state.keys.push(entry);
    await mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(temporary, file);
    return { token, key: { id: entry.id, name: entry.name, scopes: entry.scopes, createdAt: entry.createdAt } };
  })();
  return operation;
}

export async function listApiKeys(dataDirectory) {
  const file = join(dataDirectory, "api-keys.json");
  try {
    const state = JSON.parse(await readFile(file, "utf8"));
    return (state.keys || []).map(({ digest, ...key }) => key);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function revokeApiKey(dataDirectory, id) {
  const file = join(dataDirectory, "api-keys.json");
  let state;
  try { state = JSON.parse(await readFile(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
  const key = (state.keys || []).find(item => item.id === id);
  if (!key) return false;
  if (!key.revokedAt) key.revokedAt = new Date().toISOString();
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(temporary, file);
  return true;
}
