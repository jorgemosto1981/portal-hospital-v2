import TicketeraPatronB from "../../pages/TicketeraPatronB.jsx";
import TicketeraPatronC from "../../pages/TicketeraPatronC.jsx";
import { PATRON_SALDO_B, PATRON_SALDO_C } from "./ticketeraUtils.js";

export const WIZARD_BY_PATRON = {
  [PATRON_SALDO_B]: TicketeraPatronB,
  [PATRON_SALDO_C]: TicketeraPatronC,
};
