import { describe, expect, it } from "vitest";

import { parsePersonaLabelGrilla } from "./grillaPersonaLabelDisplay.js";

describe("grillaPersonaLabelDisplay", () => {
  it("divide apellido/nombre y DNI - hs", () => {
    const r = parsePersonaLabelGrilla("CAMPOS, JAQUELINA GUADALUPE · DNI 35100564 · 40 hs");
    expect(r.linea1).toBe("CAMPOS, JAQUELINA GUADALUPE");
    expect(r.linea2).toBe("DNI 35100564 - 40 hs");
  });
});
