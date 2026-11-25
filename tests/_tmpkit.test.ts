import { it } from "vitest";
import { newRun, check, discsOf } from "../src/adventure/engine";
const fs = (await import(/* @vite-ignore */ "node:" + "fs")) as any;
it("kit", () => {
  const book = JSON.parse(fs.readFileSync("/home/user/lonewolf-vi/dist/07cd.json", "utf8"));
  const s = newRun(book, { name: "x", csRoll: 5, epRoll: 5, disciplines: discsOf(book).slice(0,3) as any, weaponskillRoll: 0, goldRoll: 0, mastered: [], picks: [[2,5,9,7,1]] });
  console.log(JSON.stringify({w:s.weapons,b:s.backpack,sp:s.special,m:s.meals,a:s.arrows,items:(s as any).items, offers:s.offers}));
  console.log(check(s,{item:"Fireseed"} as any), check(s,{item:"Lantern"} as any), check(s,{item:"Quiver"} as any));
});
