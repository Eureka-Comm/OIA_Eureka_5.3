import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const stages = new Set(["understand", "analyze", "decide", "act", "install", "learn"]);
const kinds = new Set(["document", "code", "data", "test", "interface", "configuration"]);
const owners = new Set(["EM Core", "EM Structurer", "EM Descriptor", "EM Predictor", "EM Prescriptor", "EM Actioner", "EM Installer", "EM Publisher"]);
const safePath = value => typeof value === "string" && value.length <= 240 && !value.startsWith("/") && !value.split(/[\\/]/).some(part => !part || part === "." || part === "..") && /^[\p{L}\p{N}._/-]+$/u.test(value);

export function createFactory({ root = process.env.EUREKA_FACTORY_DIR || "/app/data/factory", readJson, json }) {
  const file = id => join(root, id + ".json");
  let queue = Promise.resolve();
  const save = workspace => {
    const operation = queue.then(async () => {
      await mkdir(root, { recursive: true });
      const tmp = file(workspace.id) + ".tmp";
      await writeFile(tmp, JSON.stringify(workspace), { mode: 0o600 });
      await rename(tmp, file(workspace.id));
      return workspace;
    });
    queue = operation.catch(() => {});
    return operation;
  };
  const get = async id => {
    await queue;
    try { return JSON.parse(await readFile(file(id), "utf8")); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  const list = async () => {
    await queue;
    await mkdir(root, { recursive: true });
    const names = await readdir(root);
    const entries = await Promise.all(names.filter(name => /^[a-f0-9-]{36}\.json$/.test(name)).map(name => readFile(join(root, name), "utf8").then(JSON.parse).catch(() => null)));
    return entries.filter(Boolean).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  };
  return async (request, response, url) => {
    if (!url.pathname.startsWith("/v1/factory/")) return false;
    const base = "/v1/factory/workspaces";
    if (request.method === "GET" && url.pathname === "/v1/factory/status") {
      json(response, 200, { service: "eureka-factory", version: "0.1.0", status: "available", mode: "native-api", capabilities: ["resource-workspaces", "conversation-linking", "resource-bundles"], execution: "harness", note: "API interna Eureka; no invoca el complemento de OpenAI." });
      return true;
    }
    if (request.method === "POST" && url.pathname === base) {
      try {
        const body = await readJson(request);
        for (const key of ["name", "problem", "outcome"]) if (typeof body[key] !== "string" || !body[key].trim() || body[key].length > 4000) return json(response, 400, { error: key + " es obligatorio y admite hasta 4 000 caracteres." }), true;
        const stage = body.stage || "understand";
        if (!stages.has(stage)) return json(response, 400, { error: "Etapa Factory no válida." }), true;
        const resources = body.resources || [];
        if (!Array.isArray(resources) || resources.length > 50) return json(response, 400, { error: "Se admiten hasta 50 recursos." }), true;
        let total = 0;
        const normalized = resources.map(resource => {
          if (!resource || !kinds.has(resource.kind) || !owners.has(resource.owner) || !safePath(resource.path) || typeof resource.content !== "string" || resource.content.length > 1_000_000) throw new Error("Cada recurso requiere tipo, propietario, ruta relativa segura y contenido de hasta 1 MB.");
          total += Buffer.byteLength(resource.content, "utf8");
          if (total > 5_000_000) throw new Error("El total de recursos supera 5 MB.");
          return { kind: resource.kind, owner: resource.owner, path: resource.path, purpose: String(resource.purpose || "").slice(0, 1000), content: resource.content, acceptance: Array.isArray(resource.acceptance) ? resource.acceptance.slice(0, 20).map(item => String(item).slice(0, 500)) : [], ...(resource.evidence ? { evidence: String(resource.evidence).slice(0, 2000) } : {}) };
        });
        const now = new Date().toISOString();
        const workspace = { id: randomUUID(), taskId: typeof body.taskId === "string" ? body.taskId.slice(0, 128) : null, name: body.name.trim(), problem: body.problem.trim(), outcome: body.outcome.trim(), stage, status: "prepared", resources: normalized, createdAt: now, updatedAt: now, events: [{ type: "FactoryWorkspacePrepared", at: now, actor: "Eureka-0" }] };
        await save(workspace);
        json(response, 201, workspace);
      } catch (error) { json(response, error.status || 400, { error: error.message || "No se pudo preparar el espacio Factory." }); }
      return true;
    }
    if (request.method === "GET" && url.pathname === base) { json(response, 200, { workspaces: await list() }); return true; }
    const match = url.pathname.match(/^\/v1\/factory\/workspaces\/([a-f0-9-]{36})(?:\/(package|stage))?$/);
    if (match && request.method === "GET") {
      const workspace = await get(match[1]);
      if (!workspace) json(response, 404, { error: "No se encontró el espacio Factory." });
      else if (match[2] === "package") json(response, 200, { packageVersion: "0.1.0", workspaceId: workspace.id, name: workspace.name, resources: workspace.resources, execution: "delegated-to-harness" });
      else json(response, 200, workspace);
      return true;
    }
    if (match && match[2] === "stage" && request.method === "POST") {
      try {
        const body = await readJson(request);
        if (!stages.has(body.stage)) { json(response, 400, { error: "Etapa Factory no válida." }); return true; }
        const workspace = await get(match[1]);
        if (!workspace) { json(response, 404, { error: "No se encontró el espacio Factory." }); return true; }
        workspace.stage = body.stage;
        workspace.updatedAt = new Date().toISOString();
        workspace.events.push({ type: "FactoryStageAdvanced", at: workspace.updatedAt, actor: "EM Core", stage: body.stage });
        await save(workspace);
        json(response, 200, workspace);
      } catch (error) { json(response, error.status || 400, { error: error.message }); }
      return true;
    }
    json(response, 404, { error: "Ruta Factory no encontrada." });
    return true;
  };
}
