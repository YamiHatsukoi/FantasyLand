export type ObstacleKind =
  | "tree" | "pine" | "cactus" | "rock" | "dead_tree" | "mangrove" | "crystal"
  | "ice_spike" | "giant_mushroom" | "coral" | "bamboo" | "pillar" | "lava_rock" | "sakura" | "palm";

export type DecorKind =
  | "flowers" | "grass" | "pebbles" | "bones" | "reeds" | "snow" | "embers"
  | "sparkles" | "leaves" | "shells" | "glow";

export interface Biome {
  id: string;
  name: string;
  ground: [string, string, string];
  alt: [string, string, string];
  water: [string, string, string];
  wall: [string, string];
  obstacle: ObstacleKind;
  obs: [string, string, string, string]; // dark, mid, light, trunk
  decor: DecorKind;
  decorColors: string[];
  waterLevel: number;
  obstacleLevel: number;
  bg: [string, string];
  night?: boolean;
  nodes: { item: string; node: "herb_node" | "rock_node" | "wood_node" | "crystal_node"; w: number }[];
}

const B = (b: Biome) => b;

export const BIOMES: Record<string, Biome> = {
  forest: B({
    id: "forest", name: "Rừng Nguyên Sinh",
    ground: ["#3f7d3a", "#4a8a42", "#356e32"], alt: ["#8a6a42", "#7a5c38", "#9a784a"],
    water: ["#2a5a8a", "#4a8ac0", "#a8d8f0"], wall: ["#1c3a20", "#2a4a2c"],
    obstacle: "tree", obs: ["#1f4d25", "#2c6b33", "#4a9a4a", "#5a3a1e"],
    decor: "flowers", decorColors: ["#f7d44c", "#f78fb3", "#ffffff", "#b3a4ff"],
    waterLevel: 0.3, obstacleLevel: 0.3, bg: ["#12301a", "#2c5a30"],
    nodes: [{ item: "wood", node: "wood_node", w: 4 }, { item: "herb", node: "herb_node", w: 4 }, { item: "stone", node: "rock_node", w: 2 }, { item: "iron_ore", node: "rock_node", w: 2 }, { item: "mushroom_cap", node: "herb_node", w: 1 }],
  }),
  desert: B({
    id: "desert", name: "Sa Mạc",
    ground: ["#e0b870", "#d6aa60", "#ecc888"], alt: ["#c8904a", "#b8803e", "#d8a060"],
    water: ["#2a8a9a", "#4ab8c0", "#b8f0e8"], wall: ["#8a5a30", "#a8703c"],
    obstacle: "cactus", obs: ["#2f6b33", "#4f9a45", "#8fd46a", "#6a4a2a"],
    decor: "bones", decorColors: ["#f4efe6", "#d8cfc0"],
    waterLevel: 0.2, obstacleLevel: 0.18, bg: ["#5a3a1a", "#c8904a"],
    nodes: [{ item: "sandstone", node: "rock_node", w: 4 }, { item: "cactus_fruit", node: "herb_node", w: 3 }, { item: "amber", node: "crystal_node", w: 1 }, { item: "iron_ore", node: "rock_node", w: 2 }, { item: "bone", node: "wood_node", w: 1 }],
  }),
  swamp: B({
    id: "swamp", name: "Đầm Lầy",
    ground: ["#3a4a2e", "#445636", "#324028"], alt: ["#4a3e2a", "#3e3424", "#56482e"],
    water: ["#1e3a32", "#2e5a4a", "#6ac0a0"], wall: ["#141e18", "#1e2a22"],
    obstacle: "mangrove", obs: ["#1a2e1e", "#2a4a2c", "#3e6a3a", "#3a2a1a"],
    decor: "glow", decorColors: ["#8fffd0", "#ffe45a", "#c8a0ff"],
    waterLevel: 0.44, obstacleLevel: 0.26, bg: ["#0e1a16", "#2a4a3a"], night: true,
    nodes: [{ item: "peat", node: "rock_node", w: 3 }, { item: "glowmoss", node: "herb_node", w: 3 }, { item: "bog_iron", node: "rock_node", w: 2 }, { item: "wood", node: "wood_node", w: 2 }, { item: "soul_wax", node: "crystal_node", w: 1 }],
  }),
  tundra: B({
    id: "tundra", name: "Băng Nguyên",
    ground: ["#e8f0f8", "#d8e4f0", "#f4f8fc"], alt: ["#a8c0d8", "#98b0c8", "#b8d0e8"],
    water: ["#3a6a9a", "#6aa0d0", "#e0f4ff"], wall: ["#5a7a9a", "#7a9aba"],
    obstacle: "pine", obs: ["#1a3a3a", "#2a5a4a", "#e8f4f8", "#4a3a2a"],
    decor: "snow", decorColors: ["#ffffff", "#c8e0f8"],
    waterLevel: 0.28, obstacleLevel: 0.26, bg: ["#2a4a6a", "#a8c8e8"],
    nodes: [{ item: "stone", node: "rock_node", w: 3 }, { item: "iron_ore", node: "rock_node", w: 3 }, { item: "mana_crystal", node: "crystal_node", w: 1 }, { item: "wood", node: "wood_node", w: 2 }],
  }),
  volcano: B({
    id: "volcano", name: "Núi Lửa",
    ground: ["#3a2a2a", "#4a3030", "#2e2222"], alt: ["#5a3a2a", "#6a4230", "#4a3024"],
    water: ["#c83a1a", "#ff7a2a", "#ffe06a"], wall: ["#1a1212", "#2a1a1a"],
    obstacle: "lava_rock", obs: ["#1a1414", "#3a2a28", "#6a4a40", "#ff6a2a"],
    decor: "embers", decorColors: ["#ff7a2a", "#ffc83a"],
    waterLevel: 0.3, obstacleLevel: 0.25, bg: ["#2a0e0a", "#8a2a1a"], night: true,
    nodes: [{ item: "iron_ore", node: "rock_node", w: 4 }, { item: "stone", node: "rock_node", w: 2 }, { item: "monster_core", node: "crystal_node", w: 1 }, { item: "mana_crystal", node: "crystal_node", w: 1 }],
  }),
  crystal: B({
    id: "crystal", name: "Hang Pha Lê",
    ground: ["#2a2a4a", "#323258", "#24243e"], alt: ["#3a3a6a", "#44447a", "#30305a"],
    water: ["#1a3a6a", "#3a6aba", "#a8d8ff"], wall: ["#0e0e1e", "#1a1a32"],
    obstacle: "crystal", obs: ["#2a4a8a", "#5a8ae0", "#c8e8ff", "#6a3ab0"],
    decor: "sparkles", decorColors: ["#c8e8ff", "#ff9af0", "#fff6a8"],
    waterLevel: 0.26, obstacleLevel: 0.3, bg: ["#0a0a22", "#3a3a8a"], night: true,
    nodes: [{ item: "mana_crystal", node: "crystal_node", w: 3 }, { item: "stone", node: "rock_node", w: 2 }, { item: "iron_ore", node: "rock_node", w: 2 }],
  }),
  fungal: B({
    id: "fungal", name: "Rừng Nấm Khổng Lồ",
    ground: ["#4a3a5a", "#54426a", "#40324e"], alt: ["#6a5a3a", "#5a4a30", "#7a6a44"],
    water: ["#2a4a5a", "#4a7a8a", "#a8e0e8"], wall: ["#1e1628", "#2a2036"],
    obstacle: "giant_mushroom", obs: ["#6a2a5a", "#b04a8a", "#f0a0d8", "#e8dcc0"],
    decor: "glow", decorColors: ["#8fffd0", "#ff9af0"],
    waterLevel: 0.28, obstacleLevel: 0.3, bg: ["#1a0e2a", "#5a3a7a"], night: true,
    nodes: [{ item: "mushroom_cap", node: "herb_node", w: 4 }, { item: "herb", node: "herb_node", w: 2 }, { item: "mana_crystal", node: "crystal_node", w: 1 }, { item: "wood", node: "wood_node", w: 2 }],
  }),
  reef: B({
    id: "reef", name: "Rạn San Hô Cạn",
    ground: ["#e8d8b0", "#f0e0bc", "#dcc8a0"], alt: ["#8ac8c8", "#7ab8b8", "#9ad8d8"],
    water: ["#1a6a9a", "#3aa0c8", "#c8f4ff"], wall: ["#1a4a6a", "#2a6a8a"],
    obstacle: "coral", obs: ["#b02a4a", "#ff6a7a", "#ffc0c8", "#e8a060"],
    decor: "shells", decorColors: ["#ffb0c0", "#fff0e0", "#a0e0ff"],
    waterLevel: 0.42, obstacleLevel: 0.22, bg: ["#0a3a5a", "#3aa0c8"],
    nodes: [{ item: "pearl", node: "crystal_node", w: 1 }, { item: "stone", node: "rock_node", w: 3 }, { item: "slime_gel", node: "herb_node", w: 2 }],
  }),
  bamboo: B({
    id: "bamboo", name: "Rừng Trúc",
    ground: ["#5a8a3a", "#669a44", "#4e7a32"], alt: ["#a8905a", "#98804e", "#b8a06a"],
    water: ["#2a6a7a", "#4a9aaa", "#b0e8f0"], wall: ["#2a3a1a", "#3a4a2a"],
    obstacle: "bamboo", obs: ["#3a6a2a", "#6aaa3a", "#b8e07a", "#8a7a3a"],
    decor: "grass", decorColors: ["#3a6a2a", "#8aca5a"],
    waterLevel: 0.26, obstacleLevel: 0.34, bg: ["#1a3a1a", "#6aaa3a"],
    nodes: [{ item: "wood", node: "wood_node", w: 4 }, { item: "herb", node: "herb_node", w: 3 }, { item: "stone", node: "rock_node", w: 2 }],
  }),
  ruins: B({
    id: "ruins", name: "Phế Đô",
    ground: ["#6a6a62", "#74746a", "#5e5e58"], alt: ["#8a8478", "#9a9488", "#7a7468"],
    water: ["#2a4a5a", "#4a6a7a", "#a0c0d0"], wall: ["#2a2a28", "#3a3a36"],
    obstacle: "pillar", obs: ["#4a4a44", "#9a9488", "#d8d0c0", "#6a6258"],
    decor: "pebbles", decorColors: ["#9a9a92", "#4a8a3a"],
    waterLevel: 0.24, obstacleLevel: 0.28, bg: ["#2a2a28", "#8a8478"],
    nodes: [{ item: "stone", node: "rock_node", w: 4 }, { item: "iron_ore", node: "rock_node", w: 2 }, { item: "linen", node: "herb_node", w: 1 }, { item: "mana_crystal", node: "crystal_node", w: 1 }],
  }),
  autumn: B({
    id: "autumn", name: "Rừng Thu",
    ground: ["#8a6a2a", "#9a7a34", "#7a5c24"], alt: ["#6a4a2a", "#5a3e24", "#7a5632"],
    water: ["#2a5a7a", "#4a8aaa", "#b0d8e8"], wall: ["#3a2a14", "#4a3a1e"],
    obstacle: "tree", obs: ["#8a2a1a", "#d8602a", "#f0b04a", "#4a2e18"],
    decor: "leaves", decorColors: ["#e0602a", "#f0b04a", "#a02a1a"],
    waterLevel: 0.28, obstacleLevel: 0.3, bg: ["#3a1a0a", "#c8602a"],
    nodes: [{ item: "wood", node: "wood_node", w: 4 }, { item: "herb", node: "herb_node", w: 3 }, { item: "hide", node: "herb_node", w: 1 }],
  }),
  sakura: B({
    id: "sakura", name: "Cao Nguyên Anh Đào",
    ground: ["#7aaa5a", "#86b666", "#6e9a50"], alt: ["#e8d0c8", "#f0dcd4", "#dcc0b8"],
    water: ["#4a7aba", "#7aaae0", "#e0f0ff"], wall: ["#4a5a3a", "#5a6a4a"],
    obstacle: "sakura", obs: ["#c85a8a", "#f090b8", "#ffd8e8", "#5a3a2a"],
    decor: "flowers", decorColors: ["#ffc0d8", "#ffffff", "#ff90b8"],
    waterLevel: 0.26, obstacleLevel: 0.24, bg: ["#3a2a4a", "#f090b8"],
    nodes: [{ item: "herb", node: "herb_node", w: 3 }, { item: "wood", node: "wood_node", w: 3 }, { item: "mana_crystal", node: "crystal_node", w: 1 }],
  }),
  bonewaste: B({
    id: "bonewaste", name: "Hoang Mạc Xương",
    ground: ["#5a5048", "#665a50", "#4e4640"], alt: ["#7a7064", "#6a6056", "#8a8072"],
    water: ["#3a1a2a", "#6a2a4a", "#c07aa0"], wall: ["#1a1614", "#2a2420"],
    obstacle: "dead_tree", obs: ["#1a1614", "#3a302a", "#6a5a4a", "#3a302a"],
    decor: "bones", decorColors: ["#e8e0d0", "#b8b0a0"],
    waterLevel: 0.22, obstacleLevel: 0.2, bg: ["#1a1010", "#5a4040"], night: true,
    nodes: [{ item: "bone", node: "wood_node", w: 4 }, { item: "stone", node: "rock_node", w: 2 }, { item: "monster_core", node: "crystal_node", w: 1 }, { item: "soul_wax", node: "crystal_node", w: 1 }],
  }),
  jungle: B({
    id: "jungle", name: "Rừng Mưa",
    ground: ["#2a6a2a", "#347a34", "#225a22"], alt: ["#6a4a2a", "#5a3e24", "#7a5632"],
    water: ["#1a5a5a", "#2a8a7a", "#9ae0d0"], wall: ["#0e2a12", "#1a3a1e"],
    obstacle: "palm", obs: ["#1a4a1a", "#2a7a2a", "#6ac04a", "#6a4a2a"],
    decor: "grass", decorColors: ["#1a4a1a", "#6ac04a"],
    waterLevel: 0.32, obstacleLevel: 0.34, bg: ["#0a2a10", "#2a7a2a"],
    nodes: [{ item: "wood", node: "wood_node", w: 3 }, { item: "herb", node: "herb_node", w: 4 }, { item: "slime_gel", node: "herb_node", w: 1 }],
  }),
  glacier: B({
    id: "glacier", name: "Sông Băng",
    ground: ["#b8d8f0", "#a8c8e8", "#c8e4f8"], alt: ["#e8f4fc", "#f4faff", "#dcecf8"],
    water: ["#1a3a6a", "#2a5a9a", "#a8d0f0"], wall: ["#3a5a8a", "#5a7aaa"],
    obstacle: "ice_spike", obs: ["#4a7ab0", "#8ab8e8", "#e8f8ff", "#3a5a8a"],
    decor: "sparkles", decorColors: ["#ffffff", "#c8f0ff"],
    waterLevel: 0.34, obstacleLevel: 0.26, bg: ["#1a2a4a", "#8ab8e8"],
    nodes: [{ item: "mana_crystal", node: "crystal_node", w: 2 }, { item: "stone", node: "rock_node", w: 3 }, { item: "iron_ore", node: "rock_node", w: 2 }],
  }),
};

/** Biome rotation for procedurally themed floors 4..100. */
export const BIOME_CYCLE = ["tundra", "fungal", "volcano", "reef", "bamboo", "crystal", "autumn", "ruins", "sakura", "bonewaste", "jungle", "glacier", "forest", "desert", "swamp"];
