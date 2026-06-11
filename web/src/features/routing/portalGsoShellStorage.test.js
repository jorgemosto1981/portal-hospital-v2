import { describe, expect, it } from "vitest";

import {
  readLastVisitedGsoShell,
  shellGsoDesdePathname,
  writeLastVisitedGsoShell,
  LAST_VISITED_GSO_SHELL_KEY,
} from "./portalGsoShellStorage.js";

describe("portalGsoShellStorage", () => {
  it("shellGsoDesdePathname solo en rutas GSO", () => {
    expect(shellGsoDesdePathname("/portal/jefe/grilla-operativa")).toBe("jefe");
    expect(shellGsoDesdePathname("/portal/jefe/solicitudes")).toBeNull();
  });

  it("read/write last visited", () => {
    const mem = new Map();
    const storage = {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => mem.set(k, v),
    };
    writeLastVisitedGsoShell("rrhh", storage);
    expect(storage.getItem(LAST_VISITED_GSO_SHELL_KEY)).toBe("rrhh");
    expect(readLastVisitedGsoShell(storage)).toBe("rrhh");
  });
});
