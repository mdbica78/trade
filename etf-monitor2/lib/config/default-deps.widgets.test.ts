import { expect, it } from "vitest";
import { drizzle } from "drizzle-orm/neon-http";
import type { Db } from "../db/index";
import { defaultAdapterRegistry } from "../extraction/adapters/default-registry";
import { createWidgetsConfigDeps } from "./default-deps";

it("wires widgets to the injected query builder, batch runner, adapter registry and clock", () => {
  const db = drizzle.mock() as unknown as Db;
  const deps = createWidgetsConfigDeps(db);
  expect(deps.db).toBe(db);
  expect(typeof deps.run).toBe("function");
  expect(deps.registry).toBe(defaultAdapterRegistry);
  expect(deps.now()).toBeInstanceOf(Date);
});
