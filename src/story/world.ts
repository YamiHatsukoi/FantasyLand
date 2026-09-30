import type { Element } from "../combat/types";
import { ARC } from "../data/world/arc";
import "../data/world";
import { FLOOR_EVENTS, FLOOR_GUARDIAN, SPECS, sigId, type FloorSpec } from "../world/floorSpec";
import { FINALE } from "./finale";
import type { Attr, Choice, Scene, StoryEvent } from "./types";

/**
 * Builds the per-floor story events from the floor specs and the main arc:
 * lore ruins, echoes, monster nests, hazards, resource veins, natives, altars, the
 * main-story beat, and a gatekeeper fight that reveals the boss's memory.
 */

const HAZARD: Record<Element, { title: string; text: string; attr: Attr; pass: string; fail: string }> = {
  fire: { title: "Mạch Lửa Ngầm", text: "Mặt đất phía trước nứt toác, hơi nóng bốc lên hừng hực. Lối đi duy nhất là nhảy qua những tảng đá đang đỏ rực.", attr: "agi", pass: "Bạn nhảy qua nhẹ như chim, và nhặt được vài thứ quý kẹt giữa khe đá.", fail: "Một tảng đá sụp dưới chân. Bạn thoát ra được, nhưng bị bỏng nặng." },
  ice: { title: "Bão Tuyết Bất Chợt", text: "Gió lạnh ập tới, tuyết quất vào mặt như roi. Bạn phải giữ tỉnh táo để không lạc đường.", attr: "wil", pass: "Bạn nghiến răng bước tiếp và tìm được một hang trú ẩn còn sót đồ của ai đó.", fail: "Cái lạnh ngấm vào xương. Bạn lết ra khỏi cơn bão, run bần bật." },
  lightning: { title: "Cánh Đồng Sét", text: "Những tia sét đánh xuống liên tục theo một nhịp kỳ lạ. Phải canh đúng thời điểm để băng qua.", attr: "agi", pass: "Bạn chạy giữa hai nhịp sét, và thấy một khối kim loại bị sét đánh chảy thành thỏi.", fail: "Một tia sét đánh sượt qua. Tóc bạn dựng đứng, cả người tê dại." },
  water: { title: "Dòng Nước Xiết", text: "Một dòng nước chảy xiết chắn ngang đường. Bên kia bờ có thứ gì đó lấp lánh.", attr: "str", pass: "Bạn bám đá lội qua và vớt được vật lấp lánh.", fail: "Dòng nước cuốn bạn đi một đoạn dài trước khi bạn bám được vào bờ." },
  earth: { title: "Vách Đá Lở", text: "Tiếng ầm ầm vang lên phía trên. Đá bắt đầu lăn xuống con dốc.", attr: "str", pass: "Bạn đẩy bật một tảng đá lớn sang bên, lộ ra một hốc chứa khoáng thạch.", fail: "Đá đè trúng vai bạn. Đau điếng." },
  wind: { title: "Vực Gió Cắt", text: "Một cây cầu hẹp bắc qua vực sâu, gió thổi ngang từng đợt đủ sức hất bay một người.", attr: "agi", pass: "Bạn cúi thấp, bước theo nhịp gió và qua được. Bên kia có một tổ chim bỏ hoang đầy đồ lấp lánh.", fail: "Một cơn gió hất bạn khỏi cầu. Bạn túm được dây thừng, nhưng tay đã rớm máu." },
  light: { title: "Ánh Sáng Chói Loà", text: "Ánh sáng phản chiếu từ mọi hướng, chói tới mức mở mắt ra cũng đau.", attr: "int", pass: "Bạn tính được góc phản chiếu, lần theo bóng tối hiếm hoi mà đi, và tìm thấy thứ bị ánh sáng che giấu.", fail: "Bạn đi lạc giữa biển ánh sáng hàng giờ, mắt bỏng rát." },
  dark: { title: "Bóng Tối Đặc Quánh", text: "Bóng tối ở đây dày như nước. Có tiếng thì thầm gọi tên bạn từ trong đó.", attr: "wil", pass: "Bạn không trả lời. Tiếng thì thầm lùi lại, để lại một món đồ như lời xin lỗi.", fail: "Bạn quay đầu lại. Thứ gì đó lạnh lẽo chạm vào gáy bạn." },
  poison: { title: "Sương Độc", text: "Một làn sương màu lạ lan tới, cây cỏ nơi nó đi qua héo rũ.", attr: "wil", pass: "Bạn nín thở băng qua và nhặt được những bông hoa chỉ nở trong sương độc.", fail: "Bạn hít phải một hơi. Cổ họng bỏng rát, đầu óc quay cuồng." },
  arcane: { title: "Mê Cung Ma Lực", text: "Không gian gấp khúc như tờ giấy bị vò. Bước một bước sang trái lại xuất hiện ở phía trên.", attr: "int", pass: "Bạn giải được quy luật của nó và lấy được viên tinh thể ở trung tâm.", fail: "Bạn bước sai một nhịp và bị không gian ép lại. Đầu óc như bị kéo dãn." },
  physical: { title: "Hố Sụt", text: "Mặt đất lún xuống dưới chân.", attr: "agi", pass: "Bạn nhảy ra kịp.", fail: "Bạn rơi xuống hố." },
};

const ELEMENT_ESS: Partial<Record<Element, string>> = {
  fire: "essence_fire", ice: "essence_ice", lightning: "essence_lightning", water: "essence_water", earth: "essence_earth",
  wind: "essence_wind", light: "essence_light", dark: "essence_dark", poison: "essence_poison", arcane: "essence_arcane",
};
const EL_NAME: Record<Element, string> = {
  physical: "Sức Mạnh", fire: "Lửa", ice: "Băng", lightning: "Sét", water: "Nước", earth: "Đất", wind: "Gió", light: "Ánh Sáng", dark: "Bóng Tối", poison: "Độc", arcane: "Huyền Bí",
};

const sentences = (t: string) => t.split(/(?<=[.!?…])\s+/).filter((x) => x.length > 3);

function ev(id: string, title: string, scenes: Record<string, Scene>, portrait?: string): StoryEvent {
  return { id, title, start: "a", scenes, portrait };
}

function floorEvents(s: FloorSpec): StoryEvent[] {
  const n = s.n;
  const out: StoryEvent[] = [];
  const lore = sentences(s.lore);
  const sig = sigId(n);
  const hz = HAZARD[s.el] ?? HAZARD.earth;
  const ess = ELEMENT_ESS[s.el] ?? "mana_crystal";

  out.push(ev(`lore${n}`, `Dấu Tích ${s.biome}`, {
    a: {
      text: `Giữa ${s.places[1] ?? s.biome}, bạn bắt gặp tàn tích của những người từng sống ở đây: một bức tường khắc chữ, những đồ vật bị bỏ lại giữa chừng như chủ nhân chỉ vừa mới rời đi một phút.`,
      choices: [
        { text: "Đọc những dòng khắc.", next: "read" },
        { text: "Lục tìm đồ vật.", check: { attr: "luck", dc: 11, pass: "find", fail: "nothing" } },
        { text: "Rời đi.", end: true, keep: true },
      ],
    },
    read: { text: `Những dòng chữ lạ bỗng trở nên dễ hiểu, như thể Vực Sâu dịch chúng cho bạn:\n\n"${s.lore}"`, fx: [{ flag: `lore_${n}` }, { xpF: 4 }] },
    find: { text: "Dưới lớp bụi là vài món đồ còn dùng được — và một thứ chỉ thế giới này mới có.", fx: [{ give: { [sig]: 1 } }, { loot: 3 }] },
    nothing: { text: "Chỉ có bụi. Nhưng khi bạn quay đi, bạn có cảm giác ai đó vừa thở phào.", fx: [{ loot: 1 }] },
  }));

  out.push(ev(`echo${n}`, "Tiếng Vọng", {
    a: {
      text: `Gió ở ${s.places[7] ?? s.biome} mang theo một giọng nói không có chủ:\n\n"…${lore[lore.length - 1] ?? s.lore}"\n\nGiọng nói lặp đi lặp lại, như một bản ghi âm bị kẹt.`,
      choices: [
        { text: "Lắng nghe tới hết.", fx: [{ mp: 0.5 }, { flag: `echo_${n}` }], next: "b" },
        { text: "Đi tiếp.", end: true },
      ],
    },
    b: { text: "Giọng nói dừng lại, như vừa được ai đó nghe thấy lần đầu tiên sau rất lâu. Bạn thấy lòng nhẹ đi một chút." },
  }));

  out.push(ev(`nest${n}`, `Sào Huyệt ${s.mobs[0]?.[0] ?? "Quái Vật"}`, {
    a: {
      text: `Bạn tìm thấy một sào huyệt đầy xương và vỏ trứng. Giữa đống đổ nát lấp lánh những thứ quái vật tha về — và chúng đang ở nhà.`,
      choices: [
        { text: "Tấn công sào huyệt.", fx: [{ battle: { win: "win", levelAdd: 2 } }] },
        { text: "Lẻn vào lấy đồ.", check: { attr: "agi", dc: 14, pass: "sneak", fail: "caught" } },
        { text: "Rời đi.", end: true, keep: true },
      ],
    },
    win: { text: "Sào huyệt đã sạch bóng. Bạn nhặt nhạnh chiến lợi phẩm.", fx: [{ give: { [sig]: 2 } }, { loot: 4 }, { goldF: 25 }] },
    sneak: { text: "Bạn lẻn vào và ra như một cái bóng.", fx: [{ give: { [sig]: 1 } }, { loot: 2 }] },
    caught: { text: "Một con quái mở mắt. Cả bầy lao tới!", fx: [{ battle: { win: "win", levelAdd: 3 } }] },
  }));

  out.push(ev(`hazard${n}`, hz.title, {
    a: {
      text: hz.text,
      choices: [
        { text: "Vượt qua.", check: { attr: hz.attr, dc: 12 + Math.floor(n / 12), pass: "pass", fail: "fail" } },
        { text: "Tìm đường vòng (mất thời gian).", end: true, keep: true },
      ],
    },
    pass: { text: hz.pass, fx: [{ loot: 3 }, { give: { [ess]: 1 } }, { xpF: 3 }] },
    fail: { text: hz.fail, fx: [{ hurt: 0.25 }, { loot: 1 }] },
  }));

  out.push(ev(`vein${n}`, `Mạch ${s.sig[0]}`, {
    a: {
      text: `Một mạch ${s.sig[0].toLowerCase()} lộ ra giữa ${s.places[9] ?? "vùng đất"}. ${s.sig[3]}`,
      choices: [
        { text: "Khai thác cẩn thận.", fx: [{ give: { [sig]: 2 } }, { loot: 2 }], next: "done" },
        { text: "Đào sâu hơn (may rủi).", check: { attr: "luck", dc: 13, pass: "rich", fail: "collapse" } },
      ],
    },
    done: { text: "Bạn gói ghém cẩn thận. Mạch khoáng khép lại như chưa từng mở." },
    rich: { text: "Bạn đào trúng lõi mạch. Cả một khối lớn!", fx: [{ give: { [sig]: 4 } }, { loot: 3 }, { give: { mana_crystal: 1 } }] },
    collapse: { text: "Mạch sụp. Bạn chỉ kịp vơ được một ít.", fx: [{ give: { [sig]: 1 } }, { hurt: 0.1 }] },
  }));

  const native: Choice[] = [
    { text: "\"Ở đây có chuyện gì vậy?\"", next: "talk" },
    { text: "Chia cho họ đồ ăn (1 Bánh Mì).", cond: { has: "bread" }, fx: [{ take: { bread: 1 } }, { give: { [sig]: 2 } }, { xpF: 3 }], next: "thanks" },
    { text: "Tạm biệt.", end: true, keep: true },
  ];
  out.push(ev(`native${n}`, `Cư Dân ${s.biome}`, {
    a: {
      text: `Một cư dân của ${s.biome} ngồi bên vệ đường, nhìn bạn bằng đôi mắt không ngạc nhiên cũng không sợ hãi.\n\n"Lại một người từ trên xuống. Các người luôn vội vàng. Ở đây chẳng có gì phải vội — mùa không bao giờ đổi, trẻ con không bao giờ lớn, và hôm qua giống hệt hôm nay."`,
      choices: native,
    },
    talk: { text: `"${lore[0] ?? s.lore}"\n\nHọ ngừng lại, như cố nhớ điều gì. "Lạ thật. Tôi kể chuyện này mỗi ngày, nhưng chưa bao giờ nhớ được đoạn kết."`, fx: [{ flag: `native_${n}` }], choices: native.slice(1) },
    thanks: { text: "Họ nhận lấy mẩu bánh bằng hai tay, như nhận một thứ gì thiêng liêng. \"Đã lâu lắm rồi không có gì mới để ăn.\" Họ dúi vào tay bạn một thứ quý giá của thế giới này." },
  }));

  out.push(ev(`altar${n}`, `Điện Thờ ${EL_NAME[s.el]}`, {
    a: {
      text: `Một điện thờ cổ dành cho sức mạnh ${EL_NAME[s.el].toLowerCase()} của thế giới này. Trên bệ còn dấu tay của những người từng cầu nguyện.`,
      choices: [
        { text: "Dâng 1 Tinh Thể Ma Lực.", cond: { has: "mana_crystal" }, fx: [{ take: { mana_crystal: 1 } }, { give: { [ess]: 2 } }, { heal: 1 }, { mp: 1 }], next: "bless" },
        { text: "Cầu nguyện.", check: { attr: "wil", dc: 13, pass: "bless2", fail: "silent" } },
        { text: "Rời đi.", end: true, keep: true },
      ],
    },
    bless: { text: "Ánh sáng từ điện thờ tràn qua cả đội. Mọi vết thương khép lại." },
    bless2: { text: "Một luồng sức mạnh dịu dàng đáp lại lời cầu nguyện.", fx: [{ heal: 0.5 }, { give: { [ess]: 1 } }] },
    silent: { text: "Điện thờ im lặng. Có lẽ vị thần của nó đã ngủ." },
  }));

  const beat = ARC[n];
  if (beat) {
    const scenes: Record<string, Scene> = {};
    beat.scenes.forEach((text, i) => {
      scenes[i === 0 ? "a" : `s${i}`] = {
        text, speaker: beat.speaker, portrait: beat.portrait,
        ...(i < beat.scenes.length - 1 ? { choices: [{ text: "Tiếp tục…", next: `s${i + 1}` }] } : {}),
      };
    });
    const last = scenes[beat.scenes.length === 1 ? "a" : `s${beat.scenes.length - 1}`];
    const endFx = [{ flag: `arc_${n}` }, { xpF: 8 }, ...(beat.give ? [{ give: beat.give }] : [])];
    if (beat.choices?.length) {
      last.choices = beat.choices.map((c, i) => ({ text: c.text, cond: c.cond, hide: c.hide, next: `c${i}`, fx: [...(c.keep ? [] : endFx), ...(c.flag ? [{ flag: c.flag }] : []), ...(c.give ? [{ give: c.give }] : []), ...(c.recruit ? [{ recruit: c.recruit }] : [])] }));
      beat.choices.forEach((c, i) => { scenes[`c${i}`] = { text: c.reply, speaker: beat.speaker, portrait: beat.portrait, keep: c.keep }; });
    } else last.fx = endFx;
    out.push({ id: `beat${n}`, title: beat.title, start: "a", portrait: beat.portrait, scenes });
  }

  if (n === 100) {
    out.push(FINALE);
    FLOOR_GUARDIAN[n] = FINALE.id;
  } else if (n > 3) {
    out.push({
      id: `guard${n}`, title: "Boss Canh Cửa", start: "route",
      scenes: {
        route: { text: "", route: [{ cond: { flag: `f${n}_cleared` }, to: "done" }, { to: "a" }] },
        a: {
          text: `Ở tận cùng ${s.biome}, lối xuống tầng dưới bị chặn bởi Boss Canh Cửa: ${s.boss[0]}. Một chiếc Gai Đen cắm sâu giữa ngực nó, rỉ ra thứ nhựa đen đặc quánh.\n\nNhững chiếc gai trong túi bạn đập dồn dập, như đang gọi.`,
          choices: [
            { text: "Chiến đấu!", fx: [{ battle: { win: "win", noFlee: true } }] },
            { text: "Chưa phải lúc. Rút lui.", end: true, keep: true },
          ],
        },
        win: {
          text: `${s.boss[0]} khuỵu xuống. Khi bạn rút chiếc Gai Đen ra, một ký ức tràn vào đầu bạn — không phải của bạn:\n\n"${s.mem}"`,
          fx: [{ give: { black_thorn: 1 } }, { clearFloor: true }, { flag: `mem_${n}` }, { xpF: 14 }, { goldF: 70 }],
          choices: [{ text: "…", next: "after" }],
        },
        after: { text: "Ký ức tan đi như sương. Cầu thang xuống tầng tiếp theo đã mở." },
        done: { text: "Nơi này giờ im lặng. Cầu thang xuống tầng dưới ở ngay gần đây.", keep: true },
      },
    });
    FLOOR_GUARDIAN[n] = `guard${n}`;
  }

  FLOOR_EVENTS[n] = [
    ...(beat ? [{ id: `beat${n}`, region: 5 }] : []),
    { id: `lore${n}`, region: 1 }, { id: `native${n}`, region: 2 }, { id: `hazard${n}`, region: 3 },
    { id: `nest${n}`, region: 6 }, { id: `echo${n}`, region: 7 }, { id: `vein${n}`, region: 9 }, { id: `altar${n}`, region: 10 },
  ];
  return out;
}

export const WORLD_EVENTS: StoryEvent[] = Object.values(SPECS).flatMap(floorEvents);
