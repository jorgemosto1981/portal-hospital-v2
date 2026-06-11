import { describe, expect, it } from "vitest";

import {
  actorPortalTeoriaDesdeShell,
  PORTAL_FEATURE_SHELL,
} from "./actorPortalTeoriaDesdeShell.js";

describe("actorPortalTeoriaDesdeShell", () => {
  it("shell jefe: no RRHH aunque el claim sea jefe+RRHH", () => {
    const a = actorPortalTeoriaDesdeShell({
      shell: PORTAL_FEATURE_SHELL.JEFE,
      personaId: "per_1",
      esJefeClaim: true,
    });
    expect(a.esRrhh).toBe(false);
    expect(a.esJefe).toBe(true);
    expect(a.id).toBe("per_1");
  });

  it("shell rrhh: institucional y sin jefe en actor", () => {
    const a = actorPortalTeoriaDesdeShell({
      shell: PORTAL_FEATURE_SHELL.RRHH,
      personaId: "per_2",
      esJefeClaim: true,
    });
    expect(a.esRrhh).toBe(true);
    expect(a.esJefe).toBe(false);
  });
});
