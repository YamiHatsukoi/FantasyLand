/**
 * Pixel-art sprites as text. Each sprite is 16x16. Symmetric sprites are written as
 * 8-character left halves and mirrored. '.' is transparent.
 */
export interface SpriteDef {
  rows: string[];
  pal: Record<string, string>;
}

const K = "#1b1b2a";
const mirror = (half: string[]) => half.map((r) => r + [...r].reverse().join(""));

const HUMAN = mirror([
  "........", ".....kkk", "....khhh", "...khhhh", "...khsss", "...ksess", "...ksrss", "....kssm",
  "...kkccc", "..kccccc", "..kscccb", "...kbbbb", "...kpppk", "...kppk.", "...kook.", "...kkkk.",
]);

function human(pal: Record<string, string>, patch: Record<number, string> = {}): SpriteDef {
  const patched = mirror(Object.values(patch));
  const keys = Object.keys(patch).map(Number);
  const rows = HUMAN.map((r, i) => (keys.includes(i) ? patched[keys.indexOf(i)] : r));
  return { rows, pal: { k: K, s: "#f2c29b", e: K, r: "#e8958f", m: "#b86a5a", o: "#5a3a1e", ...pal } };
}

const HAT = { 0: ".......k", 1: "......kt", 2: ".....ktt", 3: "...ktttt", 4: ".kkkkkkk" };
const CAP = { 0: "....kkkk", 1: "..kkrrwr", 2: ".krwwrrr", 3: ".krrrrwr", 4: "..kkkkkk" };

export const SPRITES: Record<string, SpriteDef> = {
  // ---------------------------------------------------------------- heroes
  hero_warrior: human({ h: "#6b3f22", c: "#3b6fd6", b: "#c9a227", p: "#4a3a2a" }),
  hero_mage: human({ h: "#d9d2f5", c: "#7b4bc4", b: "#e6c35a", p: "#3a2a5a", t: "#5a3494" }, HAT),
  hero_ranger: human({ h: "#3a6b3a", c: "#3e8a3a", b: "#7a5230", p: "#4a3a2a" }),
  hero_rogue: human({ h: "#26262e", c: "#3a3a4a", b: "#a33a3a", p: "#26262e", s: "#e8b890" }),
  hero_cleric: human({ h: "#f0d26a", c: "#ecebf5", b: "#e0b03a", p: "#9a8fb0" }),
  hero_guardian: human({ h: "#b04a2a", c: "#9aa4b0", b: "#c9a227", p: "#555a66" }),
  lyra: human({ h: "#dfe8ee", c: "#2f7a4a", b: "#9a6a3a", p: "#2a4a32", s: "#f5d6b8" }, { 5: "..sksess" }),
  bram: human({ c: "#b0763a", b: "#7a4a22", p: "#6a4a2a", s: "#efe0c0", r: "#e8a39a", w: "#f4efe6" }, CAP),
  samira: human({ h: "#2a1a12", c: "#e0a040", b: "#b0302a", p: "#8a5a2a", s: "#c68a5a" }),
  morwen: human({ h: "#3a5a4a", c: "#2a4a3a", b: "#8be04e", p: "#1f2f2a", t: "#1f3a2e", s: "#d8e0c8" }, HAT),
  kaito: human({ h: "#1a1a1a", c: "#2a2a3a", b: "#d8b030", p: "#2a2a3a", s: "#e8c8a0" }),
  hana: human({ h: "#1a1a2a", c: "#c83a3a", b: "#e8e0d0", p: "#3a3a4a", s: "#f2d0b0" }),
  villager: human({ h: "#8a6a4a", c: "#a0a060", b: "#6a5a3a", p: "#5a4a3a" }),
  nomad: human({ h: "#e8e0d0", c: "#d8c090", b: "#8a3a2a", p: "#a08060", s: "#b07a4a" }),

  sprout: {
    rows: mirror([
      "........", "......kk", ".kk..kgg", "kggk.kgl", "kglgkggg", ".kgggkgg", "..kkkkkk", "....kssk".slice(0, 8),
      "...kssss", "..ksseks", "..ksssss", "..kssmss", "...kssss", "....kkss", "...kgk.k", "...kk...",
    ]),
    pal: { k: K, g: "#5fcf5f", l: "#b8f59a", s: "#f4e6b8", e: K, m: "#c77a5a" },
  },

  // a straw training dummy with a target on its chest (sanctuary practice)
  training_dummy: {
    rows: mirror([
      "........", ".....kkk", "....kyyy", "...kykyy", "....kyyy", ".....kkk", "kkkkkkoo", "kooooookr",
      "kkkkkrww", "....krwr", "....krww", ".....krr", "......ko", "......ko", ".....kko", "....kkkk",
    ].map((r) => r.slice(0, 8))),
    pal: { k: K, y: "#e8cc78", o: "#9a6a3a", r: "#d43a3a", w: "#f4efe6" },
  },

  // ---------------------------------------------------------------- floor 1
  slime: {
    rows: mirror([
      "........", "........", "........", "........", "......kk", "....kkgg", "...kgglg", "..kglggg",
      "..kggggg", ".kgggwkg", ".kgggwkg", ".kgggggg", ".kdggggg", "..kddddd", "...kkkkk", "........",
    ]),
    pal: { k: K, g: "#6fcf5a", l: "#c8f7a8", d: "#3f9a3a", w: "#ffffff" },
  },
  wolf: {
    rows: mirror([
      "........", ".k......", ".kk.....", ".kgk....", ".kggkkkk", ".kgggggg", ".kgwkggg", ".kgggggg",
      "..kggglk", "..kgglll", "...kgggl", "..kggggg", ".kgggggg", ".kggkggg", ".kllklll", ".kkkkkkk",
    ]),
    pal: { k: K, g: "#7d8591", l: "#c9ced6", w: "#f5d442" },
  },
  mushroom: {
    rows: mirror([
      "........", "....kkkk", "..kkrrrr", ".krrwwrr", ".krrwwrr", "krrrrrrw", "krwwrrrr", "kkkkkkkk",
      "...kssss", "...kskss", "...kssss", "...ksssm", "...kssss", "...kssss", "..kffkkk", "..kkk...",
    ]),
    pal: { k: K, r: "#d8433a", w: "#f4efe6", s: "#efe0c0", m: "#7a3a2a", f: "#8a5a3a" },
  },
  wasp: {
    rows: mirror([
      "......k.", ".......k", ".kk..kkk", "kwwkkyyy", "kwwwkeyy", ".kwwkyyy", "..kkkkbb", "....kbbb",
      "....kyyy", "...kbbbb", "...kyyyy", "...kbbbb", "....kyyy", ".....kbb", "......kb", ".......k",
    ]),
    pal: { k: K, y: "#f2c230", b: "#2a2a2a", w: "#cfe8ff", e: "#d23a3a" },
  },
  boar: {
    rows: mirror([
      "........", "........", ".kk.....", ".kbk...s", ".kbbkkkk", ".kbbbbbb", ".kbekbbb", ".kbbbbbb",
      ".kbbkppp", ".kwbkpkp", ".kwbbkkk", "..kbbbbb", ".kbbbbbb", ".kbbkkbb", ".kddk.kd", ".kkk..kk",
    ]),
    pal: { k: K, b: "#8a5a3a", e: "#e04a3a", p: "#e8a0a0", w: "#f4efe6", d: "#8a8f86", s: "#a8aca4" },
  },
  sapling: {
    rows: mirror([
      "....kkkk", "..kkgggg", ".kgglggg", "kggggggl", "kglggggg", ".kgggggg", "..kkkggg", "...kkbbb",
      "...kbebb", "...kbbbb", "...kbbbo", "...kbbbb", "..kbkbbb", ".kbk.kbb", ".kk..kbk", "......kk",
    ]),
    pal: { k: K, g: "#3f8f3a", l: "#7fcf5a", b: "#7a5230", e: "#ffe45a", o: "#2a1a0e" },
  },
  treant: {
    rows: mirror([
      "..kk.kkk", ".kggkggg", "kgglgggg", "kggggglg", "kglggggg", ".kgggggg", "..kkkkbb", "kk..kbbb",
      ".kbkkbeb", "..kbbbbb", "...kbkoo", "...kbbbb", "..kbmbbb", ".kbbkbbb", "kbbk.kbb", "kkk...kk",
    ]),
    pal: { k: K, g: "#2f6b33", l: "#5fae4a", b: "#6b4a2a", e: "#ffd84a", o: "#2a1a0e", m: "#4f9a45" },
  },

  // ---------------------------------------------------------------- floor 2
  scorpion: {
    rows: mirror([
      ".......k", "......ka", ".kk...ka", "kaak...k", "kaaak.ka", ".kaak.ka", "..kaakaa", "...kaaaa",
      "..kakeaa", ".kaaaaaa", "kakaaaaa", "k.kaaaaa", ".k.kaaaa", "k.k.kaaa", "..k..kkk", "........",
    ]),
    pal: { k: K, a: "#d9912b", e: "#1b1b2a" },
  },
  lizard: {
    rows: mirror([
      "........", "........", "....kkkk", "...kllll", "..klekll", "..klllll", "...klkkk", "....kkll",
      "k..kllll", "kk.kllyl", ".kkklyyy", "...kllyl", "..kkllll", ".kl.kkll", ".k...kll", "......kk",
    ]),
    pal: { k: K, l: "#d8a860", y: "#f0d890", e: "#2a8a2a" },
  },
  mummy: {
    rows: mirror([
      "....kkkk", "...kwwww", "..kwwddw", "..kwkeww", "..kwwwwd", "..kdwwww", "...kwwww", "..kkwdww",
      ".kwwkwww", "kwwdkwdw", "kwk.kwww", "kk..kdww", "....kwww", "....kwdw", "....kwwk", "....kkk.",
    ]),
    pal: { k: K, w: "#e8dcc0", d: "#b8a888", e: "#5affd0" },
  },
  vulture: {
    rows: mirror([
      "........", ".....kkk", "....kppp", "....kpep", ".....kpy", "k.....ky", "kbk..kkk", "kbbkkbbb",
      ".kbbbbww", "..kbbbww", "...kbbbw", "....kbbb", ".....kbb", "....kyky", "....kk.k", "........",
    ]),
    pal: { k: K, p: "#e8a0a0", e: "#1b1b2a", y: "#e0b030", b: "#5a3a2a", w: "#e8dcc0" },
  },
  djinn: {
    rows: mirror([
      "......kk", ".....kyy", "....kyyy", "...kbbbb", "..kbbbbb", "..kbebbb", "..kbbbbb", "...kbbmb",
      "k..kkbbb", "kbkbbbbb", ".kbbbbbb", "...kbbbb", "....kbbb", ".....kbb", "......kb", ".......k",
    ]),
    pal: { k: K, b: "#e0c070", y: "#fff0a0", e: "#ff5a3a", m: "#8a5a2a" },
  },
  cactus: {
    rows: mirror([
      "......kk", ".....kgg", ".....kgl", "..k..kgg", ".kgk.kgg", ".kgk.kge", ".kgkkkgg", ".kggggll",
      "..kkkkgg", ".....kgo", ".....kgg", ".....kgg", ".....kgg", "....kkgg", "...kssss", "...kkkkk",
    ]),
    pal: { k: K, g: "#4f9a45", l: "#8fd46a", e: "#ff4a3a", o: "#2a1a0e", s: "#d8b070" },
  },
  wyrm: {
    rows: mirror([
      "........", "....kkkk", "...kaaaa", "..kaaaaa", ".kaaeaaa", ".kaaaaaa", ".kawawaw", ".kaoooo".padEnd(8, "o"),
      ".kawawaw", "..kaaaaa", "..kdaaaa", "...kdaaa", "...kdaaa", "..kddaaa", ".kddkkaa", ".kkk..kk",
    ]),
    pal: { k: K, a: "#c89040", d: "#8a6030", e: "#ff3a3a", w: "#f4efe6", o: "#3a1a0a" },
  },

  // ---------------------------------------------------------------- floor 3
  frogman: {
    rows: mirror([
      "........", "..kkk...", ".kwwgk..", ".kwkgkkk", "..kggggg", ".kgggggg", ".kgoooog".slice(0, 8), "..kggggg",
      "...kllll", "..kgllll", ".kggklll", ".kg.kgll", "...kgggg", "...kgg.k", "..kggk..", "..kkk...",
    ]),
    pal: { k: K, g: "#4a8a5a", l: "#b8d890", w: "#f5e14a", o: "#2a1a1a" },
  },
  wisp: {
    rows: mirror([
      "........", ".......k", "......kb", ".....kbl", "....kbll", "...kblll", "...kblww", "..kbllwe",
      "..kbllww", "..kbllll", "...kblll", "....kbll", ".....kbb", "......kk", "........", "........",
    ]),
    pal: { k: "#1a2a4a", b: "#3a8aff", l: "#8fd8ff", w: "#ffffff", e: "#1a2a4a" },
  },
  drowned: {
    rows: mirror([
      "....kkkk", "...khhhh", "..khhggg", "..khgggg", "..kgekgg", "..kggggg", "...kgmmm", "..kkkggg",
      ".kccckcc", "kgcccccc", "kgkccccc", "kk.kcccc", "...kcckc", "...kgk.k", "...kgk..", "...kk...",
    ]),
    pal: { k: K, h: "#3a4a3a", g: "#8aa890", e: "#e0ff5a", m: "#2a3a2a", c: "#4a5a6a" },
  },
  leech: {
    rows: mirror([
      "........", "........", "........", "....kkkk", "...krrrr", "..krmmmr", "..krmkkm", "..krrrrr",
      "..kdrrrr", "..kdrrrr", "...kdrrr", "...kdrrr", "....kdrr", "....kddr", ".....kkk", "........",
    ]),
    pal: { k: K, r: "#6a3a4a", m: "#e0708a", d: "#4a2a3a" },
  },
  crab: {
    rows: mirror([
      "........", ".kk.....", "krrk....", "krrk....", ".krk.k.k", "..kk.kek", "...kkrrr", "..krrrrr",
      ".krrrrrr", ".krssrrr", ".krrrrrr", "..krrrrr", ".k.kkkkk", "k.k.k.k.", "........", "........",
    ]),
    pal: { k: K, r: "#6a7a8a", s: "#a0b0c0", e: "#1b1b2a" },
  },
  ghost: {
    rows: mirror([
      "........", ".....kkk", "....kwww", "...kwwww", "...kwkww", "...kwkww", "...kwwww", "..kwwwwo",
      "..kwwwww", ".kwwwwww", "kyykwwww", "kyykwwww", ".kk.kwww", "....kwkw", "....k.k.", "........",
    ]),
    pal: { k: "#3a3a5a", w: "#d8e0f0", o: "#8a90b0", y: "#ffb030" },
  },
  queen: {
    rows: mirror([
      "..k.k.k.", "..kykyky", "..kyyyyy", "...khhhh", "..khhsss", "..khseks", "..khssss", "..khhsmm",
      ".khhkkcc", ".khkcccc", "..kccccc", "..kcccpc", "..kccccc", ".kcccccc", ".kcccccc", ".kkkkkkk",
    ]),
    pal: { k: K, y: "#e0c040", h: "#1a4a5a", s: "#a8c8c8", e: "#5affff", m: "#3a5a6a", c: "#2a5a7a", p: "#1a1a2a" },
  },

  // ---------------------------------------------------------------- map objects
  chest: {
    rows: mirror([
      "........", "........", "........", "........", "..kkkkkk", ".kbbbbbb", ".kbybbbb", ".kkkkkkk",
      ".kbbbbky", ".kbbbbky", ".kbybbbk", ".kbbbbbb", ".kkkkkkk", "........", "........", "........",
    ]),
    pal: { k: K, b: "#9a5a2a", y: "#f2c230" },
  },
  campfire: {
    rows: mirror([
      "........", "........", "........", ".......r", "......ro", "......ro", ".....roy", ".....ryy",
      "....royy", "....royy", "..kbbkro", "..kbbbbb", "...kkbbb", "....kkkk", "........", "........",
    ].map((r) => r.padEnd(8, "."))),
    pal: { k: K, r: "#e04a2a", o: "#ff9a3a", y: "#ffe45a", b: "#7a5230" },
  },
  stairs: {
    rows: mirror([
      "kkkkkkkk", "kssssssss".slice(0, 8), "kdddddddd".slice(0, 8), "kkkkkkkk", "k.kssssss".slice(0, 8), "k.kdddddd".slice(0, 8), "k.kkkkkk", "k.k.ksss",
      "k.k.kddd", "k.k.kkkk", "k.k.k.ks", "k.k.k.kd", "k.k.k.kk", "k.k.k.k.", "k.k.k.k.", "kkkkkkkk",
    ]),
    pal: { k: "#0e0e18", s: "#8a8f96", d: "#4a4e56" },
  },
  portal: {
    rows: mirror([
      "....kkkk", "..kkpppp", ".kpplllp", ".kplwwll", "kpllwwww", "kplwwwww", "kplwwwww", "kplwwwww",
      "kplwwwww", "kplwwwww", "kpllwwww", ".kplwwll", ".kpplllp", "..kkpppp", "....kkkk", "........",
    ]),
    pal: { k: "#2a1a4a", p: "#7a4ad8", l: "#b08aff", w: "#e8dcff" },
  },
  marker: {
    rows: mirror([
      "......kk", ".....kyy", ".....kyy", ".....kyy", ".....kyy", ".....kyy", ".....kyy", "......kk",
      "........", "......kk", ".....kyy", "......kk", "........", "........", "........", "........",
    ]),
    pal: { k: K, y: "#ffe14a" },
  },
  question: {
    rows: mirror([
      ".....kkk", "....kyyy", "...kyykk", "...kkk..", "......kk", ".....kyy", ".....kyk", "......kk",
      "........", "......kk", ".....kyy", "......kk", "........", "........", "........", "........",
    ]),
    pal: { k: K, y: "#8fd8ff" },
  },
  herb_node: {
    rows: mirror([
      "........", "........", "........", "........", "........", ".....k..", "..k.kgk.", ".kgkkgk.",
      ".kglkgkk", "..kglkgl", "..kgglgg", "...kkggg", "....kkkk", "........", "........", "........",
    ]),
    pal: { k: K, g: "#3f9f3a", l: "#9fef7a" },
  },
  rock_node: {
    rows: mirror([
      "........", "........", "........", "........", "........", "........", "....kkkk", "...kssss",
      "..ksslso", "..ksssss", ".ksossss", ".kdsssss", ".kdddddd", "..kkkkkk", "........", "........",
    ]),
    pal: { k: K, s: "#9a9ea4", l: "#d0d4d8", d: "#6a6e74", o: "#c87a4a" },
  },
  wood_node: {
    rows: mirror([
      "........", "........", "........", "........", "........", "........", "........", ".kkkkkkk",
      "kbbbbbbb", "kbwbbbbb", "kbbbbbbb", ".kkkkkkk", "........", "........", "........", "........",
    ]),
    pal: { k: K, b: "#8a5a2a", w: "#d8b07a" },
  },
  crystal_node: {
    rows: mirror([
      "........", "........", "........", "......k.", ".....kck", ".k..kccw", "kck.kcww", "kcwkkcww",
      "kcwkcccw", ".kckcccc", ".kkkcccc", "..kkkkkk", "........", "........", "........", "........",
    ]),
    pal: { k: "#1a2a4a", c: "#5ab0ff", w: "#d0f0ff" },
  },
};
