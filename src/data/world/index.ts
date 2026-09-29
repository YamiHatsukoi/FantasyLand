import { registerSpecs } from "../../world/floorSpec";
import "./arc02";
import "./arc03";
import { FLOORS_01 } from "./floors01";
import { FLOORS_02 } from "./floors02";
import { FLOORS_03 } from "./floors03";

registerSpecs([...FLOORS_01, ...FLOORS_02, ...FLOORS_03]);
