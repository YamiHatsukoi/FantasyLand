import type { Attr, Effect, StoryEvent } from "./types";

/**
 * The big pool of roadside "?" encounters. Each is written as a short scene with a few choices;
 * a helper turns it into a normal story event. Rare ones show up far less often.
 */
interface Opt {
  t: string;
  cost?: number; // gold
  take?: Record<string, number>;
  check?: [Attr, number];
  fight?: boolean;
  ok: string;
  okfx?: Effect[];
  bad?: string;
  badfx?: Effect[];
  again?: boolean; // return to the choices afterwards (shops, games)
}

export interface RoadsideMeta { look: string; rare?: boolean }
export const ROADSIDE_META: Record<string, RoadsideMeta> = {};

function R(id: string, title: string, look: string, text: string, opts: Opt[], rare = false): StoryEvent {
  ROADSIDE_META[id] = { look, rare };
  const scenes: StoryEvent["scenes"] = { a: { text, choices: [] } };
  opts.forEach((o, i) => {
    const fx: Effect[] = [];
    if (o.cost) fx.push({ gold: -o.cost });
    if (o.take) fx.push({ take: o.take });
    const choice: NonNullable<StoryEvent["scenes"][string]["choices"]>[number] = { text: o.cost ? `${o.t} (${o.cost} vàng)` : o.t };
    if (o.cost) choice.cond = { gold: o.cost };
    else if (o.take) choice.cond = { has: Object.keys(o.take)[0], n: Object.values(o.take)[0] };
    scenes[`o${i}`] = { text: o.ok, fx: o.okfx, next: o.again ? "a" : undefined };
    if (o.check) {
      scenes[`f${i}`] = { text: o.bad ?? "Không thành.", fx: o.badfx, next: o.again ? "a" : undefined };
      choice.check = { attr: o.check[0], dc: o.check[1], pass: `o${i}`, fail: `f${i}` };
      if (fx.length) choice.fx = fx;
    } else if (o.fight) {
      choice.fx = [...fx, { battle: { win: `o${i}` } }];
    } else {
      choice.fx = fx.length ? fx : undefined;
      choice.next = `o${i}`;
    }
    scenes.a.choices!.push(choice);
  });
  scenes.a.choices!.push({ text: "Rời đi.", end: true, keep: true });
  return { id, title, start: "a", scenes };
}

export const ROADSIDE: StoryEvent[] = [
  // ---------------------------------------------------------------- wanderers and traders
  R("r_tinker", "Thợ Hàn Rong", "person:tinker", "Một ông thợ hàn lưng còng đẩy xe đồ nghề kêu lách cách. \"Kiếm mẻ? Giáp thủng? Ta vá hết, rẻ thôi!\"", [
    { t: "Nhờ mài sắc vũ khí cho cả đội", cost: 60, ok: "Tia lửa bắn tung. Lưỡi vũ khí sáng loáng như mới.", okfx: [{ xpF: 3 }, { give: { mana_crystal: 1 } }] },
    { t: "Mua đồ phế liệu ông thu nhặt", cost: 40, ok: "Ông đưa bạn một túi đầy đồ lặt vặt.", okfx: [{ loot: 3 }] },
  ]),
  R("r_herbwife", "Bà Lang Hái Thuốc", "person:herbwife", "Một bà cụ lưng đeo gùi thuốc đang nhổ cỏ dại. \"Đường sâu hiểm lắm, cháu mang theo ít thuốc chưa?\"", [
    { t: "Mua 3 Thuốc Hồi Máu", cost: 55, ok: "Bà gói thuốc bằng lá chuối, buộc dây gai cẩn thận.", okfx: [{ give: { potion_hp: 3 } }], again: true },
    { t: "Mua 2 Thuốc Giải Độc", cost: 30, ok: "\"Nhớ uống trước khi mặt tím tái nhé.\"", okfx: [{ give: { antidote: 2 } }], again: true },
    { t: "Giúp bà hái thuốc", check: ["int", 10], ok: "Bạn nhận ra đúng loại cỏ quý. Bà cười móm mém, chia cho bạn một phần.", okfx: [{ give: { herb: 4 } }, { xpF: 3 }], bad: "Bạn nhổ nhầm cả nắm cỏ độc. Bà thở dài, xua bạn đi.", badfx: [{ hurt: 0.05 }] },
  ]),
  R("r_rare_merchant", "Thương Nhân Bóng Đêm", "person:shadowtrader", "Một bóng người trùm áo choàng tím ngồi trên chiếc rương khảm bạc. Hàng của hắn không có ở bất kỳ chợ nào. \"Ta chỉ ghé qua mỗi tầng một lần... nếu may mắn.\"", [
    { t: "Mua Tiên Dược", cost: 220, ok: "Chiếc lọ thuỷ tinh ấm như còn nhịp tim.", okfx: [{ give: { elixir: 1 } }], again: true },
    { t: "Mua Lông Phượng Hoàng", cost: 160, ok: "Chiếc lông rực lửa mà không nóng.", okfx: [{ give: { phoenix_down: 1 } }], again: true },
    { t: "Mua Túi Bí Ẩn", cost: 180, ok: "Bạn mở túi. Hắn cười khẽ: \"Vận may của ngươi đấy.\"", okfx: [{ loot: 6 }], again: true },
    { t: "Mua 3 Tinh Thể Ma Lực", cost: 150, ok: "Ba viên tinh thể vo ve trong lòng bàn tay.", okfx: [{ give: { mana_crystal: 3 } }], again: true },
    { t: "Mua Lõi Quái Vật", cost: 200, ok: "Một khối đá đen còn âm ấm.", okfx: [{ give: { monster_core: 1 } }], again: true },
  ], true),
  R("r_cartographer", "Người Vẽ Bản Đồ", "person:cartographer", "Một cô gái đeo kính dày đang vẽ nguệch ngoạc lên cuộn da. \"Tôi đổi bản đồ lấy tin tức. Anh chị đã đi qua những đâu rồi?\"", [
    { t: "Kể cho cô nghe đường đã đi", check: ["int", 9], ok: "Cô ghi chép lia lịa rồi đưa bạn một cuộn bản đồ vẽ tay.", okfx: [{ give: { scroll_map: 1 } }], bad: "Bạn kể lộn xộn tới mức cô bỏ cả bút xuống." },
    { t: "Mua một cuộn bản đồ", cost: 50, ok: "\"Chính xác tới từng bụi cây!\"", okfx: [{ give: { scroll_map: 1 } }] },
  ]),
  R("r_bard", "Người Hát Rong", "person:bard", "Tiếng đàn vang lên giữa nơi hoang vắng. Một người hát rong ngồi trên tảng đá, hát về những kẻ đã xuống Vực Sâu và không trở lại.", [
    { t: "Ngồi nghe hết bài", ok: "Giai điệu buồn mà ấm. Cả đội thấy lòng nhẹ đi.", okfx: [{ heal: 0.3 }, { mp: 0.3 }] },
    { t: "Tặng anh ít tiền", cost: 20, ok: "Anh hát tặng cả đội một khúc ca chiến thắng. Tinh thần phấn chấn hẳn.", okfx: [{ heal: 0.5 }, { mp: 0.5 }, { xpF: 2 }] },
  ]),
  R("r_pilgrim", "Người Hành Hương", "person:pilgrim", "Một nhà sư chân đất đang lặng lẽ bước ngược về phía cổng. \"Ta xuống để tìm câu trả lời. Và ta đã tìm thấy. Giờ ta về.\"", [
    { t: "Hỏi ông đã tìm thấy gì", check: ["wil", 11], ok: "Ông mỉm cười, đặt tay lên trán bạn. Một luồng thanh tịnh chảy qua.", okfx: [{ xpF: 6 }, { mp: 1 }], bad: "\"Chưa đến lúc cho ngươi biết.\" Ông đi tiếp." },
    { t: "Biếu ông ít lương khô", ok: "Ông cảm ơn và để lại cho bạn một chiếc bùa gỗ.", okfx: [{ give: { scroll_repel: 1 } }] },
  ]),
  R("r_courier", "Người Đưa Thư Lạc Đường", "person:courier", "Một cậu bé đưa thư ôm túi thư khóc thút thít. \"Em lạc mất đường về rồi... Thư phải giao gấp!\"", [
    { t: "Chỉ đường cho cậu", check: ["int", 8], ok: "Cậu cảm ơn rối rít, dúi cho bạn ít tiền công.", okfx: [{ goldF: 20 }, { xpF: 2 }], bad: "Bạn chỉ sai đường. Cậu bé đi mất, bạn thấy hơi áy náy." },
    { t: "Đưa cậu một Cuộn Trở Về", take: { scroll_return: 1 }, ok: "Cậu biến mất trong ánh sáng. Lát sau, một túi quà được gửi xuống bằng phép thuật.", okfx: [{ loot: 4 }, { goldF: 30 }] },
  ]),
  R("r_retired_knight", "Hiệp Sĩ Về Hưu", "person:oldknight", "Một hiệp sĩ già ngồi mài thanh kiếm đã mẻ. \"Hồi trẻ ta đi được tới tầng ba mươi đấy. Muốn học vài chiêu không?\"", [
    { t: "Xin ông chỉ dạy", check: ["str", 11], ok: "Sau một buổi tập mệt nhoài, cả đội hiểu thêm nhiều điều.", okfx: [{ xpF: 8 }], bad: "Ông gõ cán kiếm vào đầu bạn. \"Chậm quá! Về tập thêm đi!\"", badfx: [{ hurt: 0.08 }, { xpF: 2 }] },
    { t: "Mua lại bộ giáp cũ của ông", cost: 90, ok: "Bộ giáp nặng trịch, nhưng vẫn còn tốt.", okfx: [{ loot: 3 }] },
  ]),
  R("r_twins", "Cặp Song Sinh Tinh Nghịch", "person:twins", "Hai đứa trẻ giống hệt nhau đứng chắn đường. \"Đoán xem ai là chị, ai là em! Đoán đúng có quà!\"", [
    { t: "Chỉ vào đứa bên trái", check: ["luck", 10], ok: "\"Đúng rồi!\" Chúng reo lên, đưa bạn một túi kẹo... và vài đồng vàng.", okfx: [{ goldF: 18 }, { give: { potion_mp: 1 } }], bad: "\"Sai rồi, sai rồi!\" Chúng cười khanh khách rồi chạy mất." },
    { t: "Chỉ vào đứa bên phải", check: ["luck", 10], ok: "\"Giỏi quá!\" Chúng tặng bạn một viên đá lấp lánh.", okfx: [{ give: { mana_crystal: 1 } }], bad: "\"Không phải!\" Chúng lè lưỡi rồi biến vào bụi rậm." },
  ]),
  R("r_fortune", "Bà Đồng Bói Bài", "person:seer", "Một bà già trải những lá bài cũ trên mặt đất. \"Muốn biết vận mệnh không, lữ khách? Chỉ 30 đồng thôi.\"", [
    { t: "Rút một lá", cost: 30, check: ["luck", 12], ok: "Lá Mặt Trời. \"Vận may đang mỉm cười với ngươi.\" Bạn thấy mình tràn đầy năng lượng.", okfx: [{ heal: 1 }, { mp: 1 }, { xpF: 3 }], bad: "Lá Tháp Đổ. Bà lắc đầu. Bạn thấy lạnh gáy.", badfx: [{ hurt: 0.1 }] },
  ]),
  // ---------------------------------------------------------------- nature
  R("r_hot_spring", "Suối Nước Nóng", "spring", "Hơi nước bốc lên từ một hõm đá. Nước ấm và trong vắt, thoang thoảng mùi khoáng.", [
    { t: "Ngâm mình nghỉ ngơi", ok: "Cơn mệt mỏi tan biến. Cả đội như được sinh ra lần nữa.", okfx: [{ heal: 1 }, { mp: 0.5 }] },
    { t: "Múc nước mang theo", ok: "Bạn đổ đầy hai bình.", okfx: [{ give: { water_flask: 2 } }] },
  ]),
  R("r_beehive", "Tổ Ong Rừng", "nest", "Một tổ ong khổng lồ treo lủng lẳng trên cành, mật chảy thành dòng vàng óng.", [
    { t: "Khéo léo lấy mật", check: ["agi", 11], ok: "Bạn lấy được cả một mảng sáp đầy mật mà không bị đốt nhát nào.", okfx: [{ give: { honey: 2 } }], bad: "Cả đàn ong ào ra. Cả đội ôm đầu chạy.", badfx: [{ hurt: 0.12 }] },
    { t: "Hun khói rồi lấy", take: { wood: 1 }, ok: "Lũ ong lờ đờ bay đi. Bạn thong thả lấy mật.", okfx: [{ give: { honey: 3 } }] },
  ]),
  R("r_fallen_tree", "Cây Đổ Chắn Lối", "boulders", "Một thân cây khổng lồ đổ ngang lối đi. Dưới gốc lộ ra một hốc tối.", [
    { t: "Dùng sức đẩy cây", check: ["str", 12], ok: "Thân cây lăn sang bên. Trong hốc là một túi đồ ai đó giấu.", okfx: [{ loot: 3 }, { give: { wood: 3 } }], bad: "Cây không nhúc nhích. Bạn trẹo lưng.", badfx: [{ hurt: 0.08 }] },
    { t: "Chui qua hốc tối", check: ["agi", 10], ok: "Bạn chui lọt, nhặt được vài món lạ trên đường.", okfx: [{ loot: 2 }], bad: "Bạn kẹt cứng một lúc lâu mới thoát ra." },
  ]),
  R("r_glow_mushrooms", "Vòng Nấm Phát Sáng", "fireflies", "Những cây nấm phát sáng mọc thành vòng tròn hoàn hảo. Người ta bảo bước vào vòng nấm là bước vào thế giới tiên.", [
    { t: "Bước vào vòng nấm", check: ["luck", 12], ok: "Tiếng cười trong trẻo vang lên. Khi tỉnh lại, túi bạn nặng hơn.", okfx: [{ loot: 4 }], bad: "Bạn tỉnh dậy ngoài vòng nấm, đầu óc quay cuồng.", badfx: [{ mp: -0.3 }] },
    { t: "Hái vài cây nấm", ok: "Nấm mềm và thơm, hẳn nấu được món ngon.", okfx: [{ give: { mushroom_cap: 3 } }] },
  ]),
  R("r_meteor", "Thiên Thạch Rơi", "ore_vein", "Một tảng đá rực đỏ còn bốc khói nằm giữa hố sâu. Có gì đó lấp lánh bên trong.", [
    { t: "Đập vỡ thiên thạch", check: ["str", 13], ok: "Tảng đá vỡ đôi, lộ ra những tinh thể lạ.", okfx: [{ give: { mana_crystal: 2 } }, { loot: 2 }], bad: "Đá quá cứng. Mảnh vỡ văng trúng người.", badfx: [{ hurt: 0.1 }] },
    { t: "Chờ nó nguội rồi nhặt vụn", ok: "Bạn nhặt được vài mảnh vụn còn ấm.", okfx: [{ give: { stone: 3, mana_crystal: 1 } }] },
  ]),
  R("r_rainbow_pool", "Hồ Cầu Vồng", "palm_pool", "Mặt hồ phản chiếu bảy sắc cầu vồng dù trên đầu chẳng có mặt trời.", [
    { t: "Uống một ngụm", check: ["wil", 11], ok: "Vị ngọt lành lan khắp người. Ma lực trào dâng.", okfx: [{ mp: 1 }, { xpF: 3 }], bad: "Nước có vị kim loại. Bạn buồn nôn.", badfx: [{ hurt: 0.06 }] },
    { t: "Ném một đồng xu cầu nguyện", cost: 10, ok: "Đồng xu chìm xuống, để lại một vệt sáng. Bạn thấy lòng bình yên.", okfx: [{ heal: 0.4 }] },
  ]),
  R("r_bird_nest", "Tổ Chim Khổng Lồ", "nest", "Một tổ chim to như chiếc xe ngựa. Vài quả trứng lốm đốm nằm giữa đám lông tơ.", [
    { t: "Lấy một quả trứng", check: ["agi", 12], ok: "Bạn lấy được trứng và rút đi trước khi chim mẹ về.", okfx: [{ give: { egg: 2 } }, { goldF: 10 }], bad: "Chim mẹ lao xuống từ trời cao!", badfx: [{ hurt: 0.12 }] },
    { t: "Nhặt lông vũ rơi quanh tổ", ok: "Những chiếc lông óng ánh, chắc bán được giá.", okfx: [{ give: { feather: 3 } }] },
  ]),
  R("r_crystal_cave", "Hang Pha Lê Nhỏ", "ore_vein", "Một khe đá hẹp dẫn vào hang nhỏ lấp lánh pha lê. Tiếng nước nhỏ giọt vang vọng.", [
    { t: "Đào pha lê", check: ["str", 10], ok: "Vài khối pha lê trong suốt rơi vào tay bạn.", okfx: [{ give: { mana_crystal: 1, stone: 2 } }, { loot: 1 }], bad: "Một khối pha lê sắc cứa vào tay.", badfx: [{ hurt: 0.06 }] },
    { t: "Nghe tiếng nước và thiền", ok: "Tâm trí bạn trong như pha lê.", okfx: [{ mp: 0.8 }, { xpF: 2 }] },
  ]),
  R("r_wild_orchard", "Vườn Cây Hoang", "whisper_tree", "Một khu vườn bỏ hoang, cây vẫn trĩu quả dù chẳng ai chăm.", [
    { t: "Hái quả ăn", ok: "Quả chín mọng, ngọt lịm. Cả đội ăn no nê.", okfx: [{ heal: 0.5 }] },
    { t: "Lấy hạt giống mang về", ok: "Bạn gói cẩn thận vài hạt giống lạ.", okfx: [{ give: { seed_berry: 2, seed_herb: 1 } }] },
  ]),
  R("r_quicksand", "Vũng Lún", "sinkhole", "Mặt đất dưới chân bỗng sụt xuống. Một người trong đội lún tới đầu gối!", [
    { t: "Kéo đồng đội lên", check: ["str", 11], ok: "Bạn lôi được đồng đội lên. Dưới đáy vũng lún có thứ gì đó sáng lên...", okfx: [{ loot: 2 }], bad: "Mất mãi mới thoát ra, cả đội bê bết bùn.", badfx: [{ hurt: 0.1 }] },
    { t: "Nằm xuống dàn đều trọng lượng", check: ["int", 10], ok: "Mẹo hay! Bạn trườn ra dễ dàng.", okfx: [{ xpF: 3 }], bad: "Bạn lún sâu hơn trước khi thoát được.", badfx: [{ hurt: 0.12 }] },
  ]),
  R("r_storm", "Cơn Giông Bất Chợt", "whirl", "Trời đất tối sầm. Sấm chớp giật liên hồi, gió quật mọi thứ.", [
    { t: "Tìm chỗ trú", check: ["int", 9], ok: "Bạn tìm được một hõm đá khô ráo. Trong đó có dấu vết ai đó từng ở.", okfx: [{ loot: 2 }], bad: "Cả đội ướt sũng và bị đá bay trúng.", badfx: [{ hurt: 0.1 }] },
    { t: "Hứng sét vào vũ khí", check: ["wil", 14], ok: "Sét đánh trúng, vũ khí rực sáng. Sức mạnh tràn khắp người.", okfx: [{ xpF: 8 }, { give: { mana_crystal: 1 } }], bad: "Tê dại toàn thân. Ý tưởng tồi.", badfx: [{ hurt: 0.25 }] },
  ]),
  // ---------------------------------------------------------------- ruins and relics
  R("r_sealed_door", "Cánh Cửa Niêm Phong", "gate_arch", "Một cánh cửa đá khắc đầy ký tự, chính giữa có một lỗ tròn như chờ đặt vật gì vào.", [
    { t: "Giải mã ký tự", check: ["int", 13], ok: "Cánh cửa rầm rập mở ra. Bên trong là kho báu của người xưa.", okfx: [{ loot: 5 }, { goldF: 40 }], bad: "Ký tự loé sáng rồi tắt. Cửa vẫn im lìm." },
    { t: "Đặt một Tinh Thể Ma Lực vào lỗ", take: { mana_crystal: 1 }, ok: "Tinh thể tan vào đá. Cửa mở, gió thơm ùa ra.", okfx: [{ loot: 5 }, { goldF: 50 }] },
  ]),
  R("r_old_well", "Giếng Cổ", "spring", "Một chiếc giếng đá phủ rêu. Thả hòn sỏi xuống, rất lâu sau mới nghe tiếng nước.", [
    { t: "Thả gàu kéo lên", check: ["luck", 10], ok: "Gàu kéo lên một chiếc hộp gỗ mục, bên trong còn nguyên vàng.", okfx: [{ goldF: 45 }], bad: "Chỉ có nước và một con ếch ngơ ngác." },
    { t: "Ném đồng xu ước nguyện", cost: 5, ok: "Một giọng nói vọng lên: \"Cảm ơn...\" Cả đội thấy khoẻ hẳn.", okfx: [{ heal: 0.6 }] },
  ]),
  R("r_armory", "Kho Vũ Khí Bỏ Hoang", "crates", "Những giá vũ khí mục nát, phần lớn đã gỉ sét. Nhưng vài món trông vẫn dùng được.", [
    { t: "Lục tìm kỹ càng", check: ["int", 10], ok: "Dưới đống sắt vụn là vài món còn tốt.", okfx: [{ loot: 4 }], bad: "Chỉ toàn gỉ sét. Bạn còn bị xước tay.", badfx: [{ hurt: 0.05 }] },
    { t: "Gom sắt vụn mang về", ok: "Nặng, nhưng thợ rèn sẽ thích.", okfx: [{ loot: 2 }, { give: { stone: 2 } }] },
  ]),
  R("r_library", "Thư Viện Đổ Nát", "tablet", "Giữa đống đổ nát là một giá sách còn đứng vững. Những cuốn sách phủ bụi dày.", [
    { t: "Đọc thử vài cuốn", check: ["int", 11], ok: "Bạn học được nhiều điều từ những trang giấy úa vàng.", okfx: [{ xpF: 9 }], bad: "Chữ cổ quá, bạn chẳng hiểu gì mấy.", badfx: [{ xpF: 2 }] },
    { t: "Lấy vài cuộn giấy phép", ok: "Vài cuộn giấy còn vương ma lực.", okfx: [{ give: { scroll_lure: 1, scroll_repel: 1 } }] },
  ]),
  R("r_hero_grave", "Mộ Anh Hùng", "graves", "Một ngôi mộ đá được chăm sóc cẩn thận dù không một bóng người. Trên bia: \"Người đã ngã xuống để ta sống\".", [
    { t: "Thắp hương tưởng niệm", ok: "Một làn gió nhẹ thoảng qua. Bạn thấy như có ai vỗ vai.", okfx: [{ heal: 0.5 }, { xpF: 3 }] },
    { t: "Đào mộ tìm đồ tuỳ táng", check: ["wil", 14], ok: "Linh hồn lặng im. Có lẽ họ không phiền.", okfx: [{ loot: 4 }], bad: "Một luồng khí lạnh quất vào người. Bạn run rẩy lùi lại.", badfx: [{ hurt: 0.2 }, { mp: -0.3 }] },
  ]),
  R("r_clockwork", "Người Máy Cổ", "statue", "Một người máy bằng đồng ngồi bất động, trên ngực có ổ khoá dây cót.", [
    { t: "Lên dây cót", check: ["int", 12], ok: "Người máy tỉnh dậy, cúi chào, rồi mở ngăn ngực tặng bạn một món quà.", okfx: [{ loot: 3 }, { xpF: 4 }], bad: "Người máy giật lên một cái rồi phun dầu khắp người bạn." },
    { t: "Tháo lấy bánh răng", check: ["str", 10], ok: "Bạn tháo được vài bánh răng tốt.", okfx: [{ loot: 2 }], bad: "Lò xo bật trúng mặt.", badfx: [{ hurt: 0.07 }] },
  ]),
  R("r_mirror", "Tấm Gương Cổ", "rift", "Một tấm gương cao bằng người đứng giữa hư không. Hình phản chiếu của bạn... đang mỉm cười dù bạn thì không.", [
    { t: "Chạm vào gương", check: ["wil", 13], ok: "Hình phản chiếu gật đầu, trao cho bạn một phần sức mạnh của nó.", okfx: [{ xpF: 10 }], bad: "Hình phản chiếu bước ra khỏi gương!", badfx: [{ battle: { win: "o0" } }] },
    { t: "Đập vỡ gương", check: ["str", 10], ok: "Gương vỡ tan. Những mảnh gương hoá thành tinh thể.", okfx: [{ give: { mana_crystal: 2 } }], bad: "Gương không vỡ. Tiếng cười vọng lại mãi.", badfx: [{ mp: -0.4 }] },
  ]),
  R("r_totem", "Cột Vật Tổ", "banner", "Một cột vật tổ chạm khắc mặt thú, xung quanh là những đồ cúng đã khô héo.", [
    { t: "Dâng đồ cúng", take: { herb: 2 }, ok: "Mắt vật tổ loé sáng. Một phúc lành rơi xuống đầu bạn.", okfx: [{ heal: 1 }, { xpF: 4 }] },
    { t: "Lấy đồ cúng", check: ["luck", 13], ok: "Không có gì xảy ra. Bạn nhét vội mấy món vào túi.", okfx: [{ loot: 2 }, { goldF: 15 }], bad: "Vật tổ gầm lên. Quái vật từ bụi rậm lao ra!", badfx: [{ battle: { win: "o1" } }] },
  ]),
  R("r_bell_tower", "Tháp Chuông Đổ", "bell", "Một chiếc chuông đồng khổng lồ nằm nghiêng giữa đống gạch vụn.", [
    { t: "Gõ chuông", check: ["luck", 11], ok: "Tiếng chuông ngân vang. Quái vật quanh đây bỏ chạy tán loạn, để lại đồ đạc.", okfx: [{ loot: 3 }, { give: { scroll_repel: 1 } }], bad: "Tiếng chuông gọi quái vật tới!", badfx: [{ battle: { win: "o0" } }] },
    { t: "Chui vào dưới chuông", ok: "Dưới chuông tối om, nhưng có một túi đồ ai đó bỏ quên.", okfx: [{ loot: 2 }] },
  ]),
  R("r_ancient_forge", "Lò Rèn Cổ", "brazier", "Một lò rèn cổ vẫn còn đỏ lửa dù chẳng ai nhóm. Cái đe bên cạnh sáng bóng.", [
    { t: "Rèn thử trên đe", check: ["str", 12], ok: "Từng nhát búa vang lên như có ai hướng dẫn. Bạn tạo ra một món tốt.", okfx: [{ loot: 3 }, { xpF: 4 }], bad: "Bạn đập trúng tay mình.", badfx: [{ hurt: 0.08 }] },
    { t: "Sưởi ấm bên lò", ok: "Hơi ấm lan khắp người. Mệt mỏi tan biến.", okfx: [{ heal: 0.6 }, { mp: 0.3 }] },
  ]),
  R("r_offering_bowl", "Bát Đồng Cúng Tế", "altar", "Một chiếc bát đồng đặt trên phiến đá phẳng, đựng đầy đồng xu cổ.", [
    { t: "Thêm một đồng xu", cost: 10, ok: "Bát rung lên, trả lại cho bạn gấp bội.", okfx: [{ goldF: 30 }] },
    { t: "Lấy hết đồng xu", check: ["luck", 14], ok: "Chẳng có gì xảy ra. Túi bạn nặng trĩu.", okfx: [{ goldF: 60 }], bad: "Đồng xu hoá thành rắn độc!", badfx: [{ hurt: 0.15 }] },
  ]),
  // ---------------------------------------------------------------- creatures
  R("r_injured_beast", "Con Thú Bị Thương", "bushes", "Một con thú con kêu rên, chân bị kẹt trong bẫy gỉ.", [
    { t: "Gỡ bẫy cho nó", check: ["agi", 9], ok: "Con thú tập tễnh chạy đi, lát sau quay lại tha cho bạn một món đồ lấp lánh.", okfx: [{ loot: 2 }, { xpF: 3 }], bad: "Nó hoảng sợ cắn bạn một cái rồi mới chịu yên.", badfx: [{ hurt: 0.06 }, { xpF: 2 }] },
    { t: "Băng bó bằng thảo dược", take: { herb: 1 }, ok: "Con thú liếm tay bạn. Cả đội thấy lòng ấm áp.", okfx: [{ heal: 0.4 }, { xpF: 4 }] },
  ]),
  R("r_slime_king", "Vua Slime Ngủ Gật", "bait", "Một con slime to như ngôi nhà đang ngáy khò khò. Trên đầu nó là chiếc vương miện nhỏ xíu.", [
    { t: "Lấy trộm vương miện", check: ["agi", 13], ok: "Bạn nhón được vương miện. Vua slime vẫn ngủ say.", okfx: [{ goldF: 70 }], bad: "Vua slime thức giấc, giận dữ!", badfx: [{ battle: { win: "o0" } }] },
    { t: "Nhẹ nhàng đi vòng qua", ok: "Bạn nhặt được vài giọt nhớt quý rơi quanh nó.", okfx: [{ give: { slime_gel: 3 } }] },
  ]),
  R("r_monster_den", "Hang Ổ Quái Vật", "bone_pile", "Mùi hôi bốc ra từ một hang tối. Xương chất đống ở cửa hang, lẫn cả vàng bạc của những kẻ xấu số.", [
    { t: "Xông vào dọn sạch", fight: true, ok: "Hang ổ im bặt. Kho báu của lũ quái giờ là của bạn.", okfx: [{ loot: 5 }, { goldF: 35 }] },
    { t: "Lén nhặt đồ ở cửa hang", check: ["agi", 12], ok: "Bạn nhặt được vài món mà không đánh thức ai.", okfx: [{ loot: 2 }], bad: "Một tiếng gầm vang lên từ bóng tối!", badfx: [{ battle: { win: "o0" } }] },
  ]),
  R("r_ghost_child", "Hồn Ma Đứa Trẻ", "wisp", "Một hồn ma nhỏ đang ngồi khóc bên gốc cây. \"Con làm mất búp bê rồi...\"", [
    { t: "Giúp tìm búp bê", check: ["int", 10], ok: "Bạn tìm thấy búp bê trong bụi cây. Hồn ma cười và tan thành ánh sáng.", okfx: [{ xpF: 6 }, { heal: 0.5 }], bad: "Tìm mãi không thấy. Hồn ma buồn bã biến mất." },
    { t: "Hát ru cho bé", check: ["wil", 9], ok: "Tiếng khóc lặng dần. Bé ngủ yên, để lại một viên ngọc nhỏ.", okfx: [{ give: { mana_crystal: 1 } }, { xpF: 3 }], bad: "Giọng bạn làm bé khóc to hơn." },
  ]),
  R("r_giant_turtle", "Rùa Khổng Lồ", "boulders", "Tảng đá bạn định trèo lên... hoá ra là mai một con rùa khổng lồ. Nó chậm rãi mở mắt nhìn bạn.", [
    { t: "Cúi chào nó", ok: "Rùa gật đầu chậm rãi, nhả ra một viên ngọc trai.", okfx: [{ give: { pearl: 1 } }, { xpF: 3 }] },
    { t: "Trèo lên mai cưỡi thử", check: ["agi", 11], ok: "Rùa chở bạn một đoạn, tới chỗ đầy đồ ai đó đánh rơi.", okfx: [{ loot: 3 }], bad: "Rùa lắc mình, hất bạn ngã chổng vó.", badfx: [{ hurt: 0.08 }] },
  ]),
  R("r_fox_trickster", "Cáo Chín Đuôi", "whisper_tree", "Một con cáo lông bạc với chín chiếc đuôi ngồi vắt vẻo trên cành. \"Chơi đố vui không? Đúng thì có quà, sai thì... ta lấy quà.\"", [
    { t: "Chơi đố vui", check: ["int", 13], ok: "Con cáo cười khúc khích, thả xuống một túi quà.", okfx: [{ loot: 4 }, { xpF: 4 }], bad: "\"Sai rồi~\" Túi tiền của bạn nhẹ đi trông thấy.", badfx: [{ gold: -40 }] },
    { t: "Mời nó ăn", take: { meat_beast: 1 }, ok: "Cáo ăn ngon lành, để lại một chiếc lông đuôi phát sáng.", okfx: [{ give: { mana_crystal: 2 } }] },
  ]),
  R("r_mimic_family", "Gia Đình Rương Quái", "chest", "Ba chiếc rương xếp hàng ngay ngắn. Một cái to, một cái vừa, một cái nhỏ xíu. Cái nhỏ... vừa hắt hơi?", [
    { t: "Mở rương to", fight: true, ok: "Rương to là quái vật! Nhưng hạ được nó thì bên trong đầy vàng.", okfx: [{ goldF: 60 }, { loot: 2 }] },
    { t: "Mở rương nhỏ", check: ["luck", 10], ok: "Rương nhỏ là rương thật, đầy ắp đồ.", okfx: [{ loot: 3 }], bad: "Rương nhỏ cắn vào tay bạn rồi chạy mất.", badfx: [{ hurt: 0.08 }] },
  ]),
  R("r_spider_web", "Mạng Nhện Vàng", "fireflies", "Một mạng nhện khổng lồ giăng giữa hai cây, sợi tơ óng ánh như vàng. Con nhện chủ đi vắng.", [
    { t: "Thu gom tơ vàng", check: ["agi", 11], ok: "Bạn cuộn được một bó tơ lớn.", okfx: [{ give: { spider_silk: 3 } }, { goldF: 15 }], bad: "Bạn dính chặt vào mạng. Con nhện về đúng lúc...", badfx: [{ battle: { win: "o0" } }] },
    { t: "Đốt mạng nhện", ok: "Mạng nhện cháy rụi. Bên trong là những thứ nó từng bắt được.", okfx: [{ loot: 2 }] },
  ]),
  R("r_dragon_egg", "Quả Trứng Kỳ Lạ", "nest", "Một quả trứng to bằng đầu người, vỏ ấm và phập phồng như đang thở.", [
    { t: "Ấp trứng một lúc", check: ["wil", 12], ok: "Vỏ trứng nứt, một làn khói ấm bay ra. Trong vỏ còn lại những tinh thể lạ.", okfx: [{ give: { mana_crystal: 2 } }, { xpF: 5 }], bad: "Trứng lạnh dần. Bạn thấy tiếc." },
    { t: "Để yên nó", ok: "Bạn lặng lẽ rời đi, để lại chút hơi ấm quanh tổ.", okfx: [{ xpF: 2 }] },
  ]),
  R("r_lost_pet", "Chú Chó Lạc", "bushes", "Một chú chó nhỏ vẫy đuôi chạy tới, cổ đeo thẻ tên. Nó cứ kéo gấu áo bạn về một hướng.", [
    { t: "Đi theo nó", ok: "Chú chó dẫn bạn tới một túi đồ bị vùi dưới đất rồi vui vẻ chạy biến.", okfx: [{ loot: 3 }] },
    { t: "Cho nó ăn", take: { bread: 1 }, ok: "Nó ăn ngấu nghiến rồi liếm mặt bạn. Cả đội bật cười.", okfx: [{ heal: 0.4 }, { xpF: 3 }] },
  ]),
  // ---------------------------------------------------------------- traps and dangers
  R("r_poison_gas", "Khí Độc Rò Rỉ", "poison_mist", "Một làn khí xanh lè rỉ ra từ khe đất. Phía sau lớp khí là một chiếc rương.", [
    { t: "Nín thở chạy qua", check: ["agi", 12], ok: "Bạn lao qua, chộp lấy rương và chạy ra.", okfx: [{ loot: 3 }], bad: "Khí độc sộc vào phổi.", badfx: [{ hurt: 0.15 }] },
    { t: "Chặn khe bằng đá", check: ["str", 10], ok: "Khe đá bị lấp. Bạn thong thả mở rương.", okfx: [{ loot: 3 }], bad: "Tảng đá lăn đi. Bạn hít phải chút khí.", badfx: [{ hurt: 0.08 }] },
  ]),
  R("r_rope_bridge", "Cầu Treo Mục", "rope_bridge", "Một cây cầu dây bắc qua vực sâu, ván gỗ mục lỗ chỗ. Bên kia có ánh vàng lấp lánh.", [
    { t: "Bước qua cẩn thận", check: ["agi", 11], ok: "Bạn qua được cầu và tìm thấy kho báu nhỏ.", okfx: [{ loot: 3 }, { goldF: 20 }], bad: "Một tấm ván gãy! Bạn đu được vào dây, trầy xước khắp người.", badfx: [{ hurt: 0.15 }] },
    { t: "Gia cố cầu rồi mới qua", take: { wood: 2 }, ok: "Cầu vững chãi. Bạn qua lại dễ dàng.", okfx: [{ loot: 3 }, { goldF: 20 }] },
  ]),
  R("r_pit_trap", "Hố Bẫy", "sinkhole", "Mặt đất phía trước có vẻ quá bằng phẳng, lá phủ quá đều.", [
    { t: "Kiểm tra kỹ rồi đi", check: ["int", 10], ok: "Đúng là bẫy! Bạn gỡ bẫy và lấy luôn chỗ mồi nhử.", okfx: [{ goldF: 20 }, { xpF: 2 }], bad: "Bạn bước hụt, ngã xuống hố.", badfx: [{ hurt: 0.15 }] },
    { t: "Nhảy qua", check: ["agi", 10], ok: "Một cú nhảy đẹp. Dưới hố có đồ của ai đó.", okfx: [{ loot: 1 }], bad: "Nhảy không tới...", badfx: [{ hurt: 0.15 }] },
  ]),
  R("r_cursed_idol", "Tượng Thần Bị Nguyền", "altar", "Một bức tượng nhỏ bằng vàng ròng, đôi mắt ruby đỏ rực. Không khí quanh nó lạnh buốt.", [
    { t: "Lấy tượng", check: ["wil", 15], ok: "Lời nguyền không chạm được vào bạn. Tượng vàng nặng trĩu tay.", okfx: [{ goldF: 90 }], bad: "Lời nguyền bám lấy bạn. Người rã rời.", badfx: [{ hurt: 0.2 }, { mp: -0.5 }, { goldF: 40 }] },
    { t: "Chỉ gỡ đôi mắt ruby", check: ["agi", 13], ok: "Hai viên ruby rơi vào tay. Tượng không phản ứng gì.", okfx: [{ goldF: 45 }], bad: "Tượng rung lên. Bạn vội vàng bỏ chạy." },
  ]),
  R("r_rolling_boulder", "Tảng Đá Lăn", "boulders", "Rầm rầm! Một tảng đá khổng lồ lăn xuống con dốc, thẳng về phía cả đội!", [
    { t: "Nhảy sang bên", check: ["agi", 11], ok: "Cả đội né kịp. Tảng đá đập vỡ vách núi, lộ ra một hốc chứa đồ.", okfx: [{ loot: 2 }], bad: "Không kịp! Cả đội bị cuốn theo.", badfx: [{ hurt: 0.2 }] },
    { t: "Chặn nó lại", check: ["str", 15], ok: "Bạn đứng vững, đẩy tảng đá dừng lại. Cả đội tròn mắt.", okfx: [{ xpF: 10 }], bad: "Tất nhiên là không chặn nổi.", badfx: [{ hurt: 0.25 }] },
  ]),
  R("r_fog_voices", "Giọng Nói Trong Sương", "shadow_mist", "Sương mù dày đặc. Có tiếng ai đó gọi đúng tên bạn từ trong sương.", [
    { t: "Đi theo tiếng gọi", check: ["wil", 13], ok: "Bạn giữ tỉnh táo và nhận ra đó là tiếng vọng của một linh hồn cần giúp. Nó cảm ơn bằng một món quà.", okfx: [{ loot: 3 }, { xpF: 5 }], bad: "Bạn lạc trong sương rất lâu mới tìm được đường ra.", badfx: [{ mp: -0.5 }, { hurt: 0.1 }] },
    { t: "Bịt tai đi tiếp", ok: "Bạn bỏ qua tiếng gọi. Sương tan dần." },
  ]),
  R("r_ambush_bandits", "Bọn Cướp Chặn Đường", "person:bandit", "Ba tên cướp bịt mặt nhảy ra. \"Để lại vàng, hoặc để lại mạng!\"", [
    { t: "Đưa 50 vàng cho yên chuyện", cost: 50, ok: "Chúng cười đắc thắng rồi biến mất." },
    { t: "Chiến đấu", fight: true, ok: "Bọn cướp bỏ chạy, để lại cả túi đồ ăn cướp được.", okfx: [{ goldF: 50 }, { loot: 3 }] },
    { t: "Doạ chúng", check: ["str", 13], ok: "Bạn gầm lên. Bọn cướp run rẩy quăng túi tiền rồi chạy.", okfx: [{ goldF: 40 }], bad: "Chúng không sợ, còn lao vào đánh!", badfx: [{ battle: { win: "o1" } }] },
  ]),
  // ---------------------------------------------------------------- odd and magical
  R("r_time_rift", "Khe Nứt Thời Gian", "rift", "Không khí gợn sóng như mặt nước. Qua khe nứt, bạn thấy chính mình của ngày hôm qua.", [
    { t: "Với tay vào khe nứt", check: ["int", 14], ok: "Bạn chạm vào ký ức. Những bài học cũ trở nên sáng rõ.", okfx: [{ xpF: 12 }], bad: "Thời gian giật ngược. Bạn chóng mặt, mệt lả.", badfx: [{ mp: -0.6 }] },
    { t: "Ném một món đồ vào", take: { stone: 1 }, ok: "Khe nứt nuốt hòn đá... rồi nhả ra một món lạ.", okfx: [{ loot: 2 }] },
  ]),
  R("r_wishing_star", "Ngôi Sao Rơi", "glare", "Một vệt sáng rơi xuống ngay trước mặt. Một ngôi sao nhỏ nằm trên cỏ, lấp lánh như đang chờ điều ước.", [
    { t: "Ước được giàu có", check: ["luck", 12], ok: "Ngôi sao loé sáng. Vàng rơi lả tả.", okfx: [{ goldF: 70 }], bad: "Ngôi sao tắt ngấm. Có lẽ nó không thích tham lam." },
    { t: "Ước cả đội bình an", ok: "Ngôi sao mỉm cười (có thể lắm). Cả đội khoẻ mạnh như mới.", okfx: [{ heal: 1 }, { mp: 1 }] },
    { t: "Ước được mạnh hơn", check: ["wil", 12], ok: "Sức mạnh tràn vào người.", okfx: [{ xpF: 10 }], bad: "Ngôi sao bay đi mất." },
  ], true),
  R("r_painting", "Bức Tranh Biết Nói", "tablet", "Một bức tranh treo lơ lửng giữa không trung. Người phụ nữ trong tranh cất tiếng: \"Ta cô đơn quá. Nói chuyện với ta một lúc nhé?\"", [
    { t: "Trò chuyện với bà", check: ["wil", 10], ok: "Bà kể về một thời đã xa. Cuối cùng bà tặng bạn chiếc nhẫn trong tranh — nó hiện ra thật.", okfx: [{ loot: 2 }, { xpF: 5 }], bad: "Bà thấy chán, quay mặt vào tường." },
    { t: "Vẽ thêm râu cho bà", ok: "Bà hét lên giận dữ. Bức tranh biến mất... bạn thấy hơi có lỗi.", okfx: [{ hurt: 0.05 }] },
  ]),
  R("r_music_box", "Hộp Nhạc", "chest", "Một chiếc hộp nhạc nhỏ nằm giữa đường, tự phát ra một giai điệu quen thuộc.", [
    { t: "Nghe hết bản nhạc", ok: "Giai điệu gợi nhớ những ngày bình yên. Tinh thần cả đội phấn chấn.", okfx: [{ mp: 0.8 }, { heal: 0.3 }] },
    { t: "Mở đáy hộp", check: ["int", 11], ok: "Có một ngăn bí mật! Bên trong là vài viên đá quý.", okfx: [{ goldF: 35 }, { give: { mana_crystal: 1 } }], bad: "Hộp nhạc tắt, không bật lại được nữa." },
  ]),
  R("r_giant_chess", "Bàn Cờ Khổng Lồ", "gate_arch", "Những quân cờ đá cao bằng người đứng trên nền gạch đen trắng. Một quân Hậu quay sang nhìn bạn: \"Chơi một ván?\"", [
    { t: "Chơi cờ", check: ["int", 13], ok: "Chiếu tướng! Quân Hậu cúi đầu, mở ra một lối đi dẫn tới kho báu.", okfx: [{ loot: 4 }, { xpF: 6 }], bad: "Bạn thua. Quân Mã đá bạn văng khỏi bàn cờ.", badfx: [{ hurt: 0.12 }] },
    { t: "Đánh bại các quân cờ", fight: true, ok: "Bàn cờ im lặng. Dưới quân Vua là một hộp gỗ.", okfx: [{ loot: 3 }, { goldF: 30 }] },
  ]),
  R("r_moon_altar", "Tế Đàn Mặt Trăng", "altar", "Một tế đàn bằng đá trắng, trên đó khắc hình trăng khuyết. Ánh sáng bạc chiếu xuống dù chẳng có trăng.", [
    { t: "Dâng một Tinh Thể Ma Lực", take: { mana_crystal: 1 }, ok: "Ánh trăng bao phủ cả đội. Mọi vết thương lành lại, ma lực đầy tràn.", okfx: [{ heal: 1 }, { mp: 1 }, { xpF: 6 }] },
    { t: "Cầu nguyện", check: ["wil", 12], ok: "Một giọng nói dịu dàng chúc phúc cho bạn.", okfx: [{ mp: 1 }], bad: "Ánh trăng lặng lẽ tắt." },
  ]),
  R("r_potion_puddle", "Vũng Thuốc Đổ", "spring", "Một chiếc xe thuốc đổ nghiêng, những lọ thuốc vỡ tràn thành vũng nhiều màu sắc.", [
    { t: "Nhặt những lọ còn nguyên", ok: "Vài lọ còn nguyên vẹn!", okfx: [{ give: { potion_hp: 2, potion_mp: 1 } }] },
    { t: "Nếm thử vũng thuốc", check: ["luck", 12], ok: "Kỳ diệu! Hỗn hợp thuốc khiến cả đội sung sức lạ thường.", okfx: [{ heal: 1 }, { mp: 1 }, { xpF: 4 }], bad: "Vị kinh khủng. Bụng bạn cồn cào.", badfx: [{ hurt: 0.1 }] },
  ]),
  R("r_sleeping_giant", "Người Khổng Lồ Ngủ", "boulders", "Một người khổng lồ nằm ngủ ngáy vang trời. Bên cạnh là túi đồ to bằng cái nhà.", [
    { t: "Lục túi đồ", check: ["agi", 13], ok: "Bạn lấy được vài món to đùng.", okfx: [{ loot: 4 }, { goldF: 30 }], bad: "Người khổng lồ trở mình, suýt đè bẹp bạn.", badfx: [{ hurt: 0.2 }] },
    { t: "Ngủ cạnh cho ấm", ok: "Hơi ấm từ người khổng lồ khiến cả đội ngủ ngon lành.", okfx: [{ heal: 0.8 }, { mp: 0.5 }] },
  ]),
  R("r_riddle_sphinx", "Nhân Sư Hỏi Đố", "statue", "Một con nhân sư bằng đá mở mắt. \"Thứ gì càng lấy đi càng lớn?\"", [
    { t: "\"Cái hố.\"", ok: "\"Đúng.\" Nhân sư gật đầu, cát dưới chân nó chảy ra để lộ một chiếc rương.", okfx: [{ loot: 4 }, { xpF: 5 }] },
    { t: "\"Kiến thức.\"", check: ["luck", 13], ok: "\"...Cũng có lý.\" Nhân sư bật cười, cho bạn qua cùng một món quà nhỏ.", okfx: [{ loot: 1 }, { xpF: 3 }], bad: "\"Sai.\" Một cơn bão cát quật vào mặt.", badfx: [{ hurt: 0.12 }] },
    { t: "\"Cơn đói.\"", check: ["luck", 16], ok: "Nhân sư cười lớn. \"Câu trả lời thú vị!\"", okfx: [{ xpF: 4 }], bad: "\"Sai.\" Nhân sư nhắm mắt lại, không nói gì nữa." },
  ]),
  R("r_shadow_duel", "Cái Bóng Thách Đấu", "shadow_mist", "Cái bóng của bạn bỗng tách ra khỏi chân, rút ra một thanh kiếm bóng tối. \"Đấu với ta.\"", [
    { t: "Nhận lời thách đấu", fight: true, ok: "Cái bóng mỉm cười, nhập lại vào chân bạn. Bạn thấy mình hiểu bản thân hơn.", okfx: [{ xpF: 12 }] },
    { t: "Từ chối", check: ["wil", 12], ok: "\"Khôn ngoan.\" Cái bóng quay về, để lại chút sức mạnh.", okfx: [{ xpF: 4 }], bad: "Cái bóng tấn công bất ngờ!", badfx: [{ battle: { win: "o0" } }] },
  ]),
  R("r_lucky_cat", "Mèo Thần Tài", "statue", "Một bức tượng mèo sứ vẫy tay, trước mặt là chiếc đĩa nhỏ.", [
    { t: "Đặt 20 vàng vào đĩa", cost: 20, check: ["luck", 10], ok: "Mèo vẫy nhanh hơn. Vàng tuôn ra từ miệng nó!", okfx: [{ goldF: 60 }], bad: "Mèo ngừng vẫy. Có lẽ nó đang giận." },
    { t: "Xoa đầu mèo", ok: "Bạn thấy may mắn hơn hẳn.", okfx: [{ xpF: 2 }] },
  ]),
  R("r_elemental_font", "Suối Nguyên Tố", "whirl", "Một cột nước xoáy bảy màu, mỗi màu toả ra một luồng khí nguyên tố khác nhau.", [
    { t: "Hấp thụ luồng khí", check: ["wil", 12], ok: "Ma lực nguyên tố tràn vào cơ thể.", okfx: [{ mp: 1 }, { give: { mana_crystal: 1 } }, { xpF: 4 }], bad: "Quá nhiều nguyên tố một lúc. Người bạn tê dại.", badfx: [{ hurt: 0.15 }] },
    { t: "Múc nước nguyên tố", ok: "Nước vẫn xoay tròn trong bình.", okfx: [{ give: { water_flask: 2, potion_mp: 1 } }] },
  ]),
  R("r_ghost_market", "Chợ Ma", "lanterns", "Những chiếc đèn lồng xanh lơ lửng. Các hồn ma bày hàng buôn bán như chưa từng rời khỏi thế gian.", [
    { t: "Mua Thuốc Hồi Máu (2)", cost: 30, ok: "Hồn ma bán hàng gật gù.", okfx: [{ give: { potion_hp: 2 } }], again: true },
    { t: "Mua Cuộn Trở Về", cost: 60, ok: "\"Để về nhà... điều mà ta không còn làm được.\"", okfx: [{ give: { scroll_return: 1 } }], again: true },
    { t: "Mua Bùa Xua Quái", cost: 40, ok: "Tờ bùa mỏng tang, lạnh buốt.", okfx: [{ give: { scroll_repel: 1 } }], again: true },
    { t: "Mua đồ cổ của người chết", cost: 90, ok: "Món đồ vẫn còn vương hơi lạnh.", okfx: [{ loot: 3 }], again: true },
  ], true),
  R("r_treasure_goblin", "Yêu Tinh Ôm Kho Báu", "crates", "Một con yêu tinh nhỏ ôm túi vàng to gấp đôi người nó, thấy bạn liền co giò bỏ chạy!", [
    { t: "Đuổi theo", check: ["agi", 12], ok: "Bạn tóm được nó! Nó run rẩy dâng cả túi vàng.", okfx: [{ goldF: 80 }, { loot: 2 }], bad: "Nó chui vào lỗ nẻ biến mất, còn ném lại một cục đá.", badfx: [{ hurt: 0.04 }] },
    { t: "Ném đồ ăn dụ nó", take: { bread: 1 }, ok: "Nó dừng lại, đổi túi vàng lấy mẩu bánh mì. Đúng là yêu tinh.", okfx: [{ goldF: 70 }] },
  ], true),
  R("r_fairy_ring", "Vũ Hội Tiên", "fireflies", "Những nàng tiên bé xíu nhảy múa quanh một đoá hoa khổng lồ. Họ vẫy tay mời bạn.", [
    { t: "Nhảy cùng họ", check: ["agi", 11], ok: "Các nàng tiên vui lắm, rắc bụi tiên lên cả đội.", okfx: [{ heal: 1 }, { mp: 1 }, { xpF: 5 }], bad: "Bạn giẫm phải một nàng tiên. Cả đám giận dỗi bay mất." },
    { t: "Tặng họ mật ong", take: { honey: 1 }, ok: "Các nàng tiên reo hò, tặng bạn giọt sương phép thuật.", okfx: [{ give: { elixir: 1 } }] },
  ], true),
  R("r_dimension_door", "Cánh Cửa Lơ Lửng", "gate_arch", "Một cánh cửa gỗ đứng giữa khoảng không, không tường, không nhà. Có tiếng gõ từ phía bên kia.", [
    { t: "Mở cửa", check: ["luck", 12], ok: "Bên kia là một căn phòng ấm cúng. Chủ nhà mời bạn ăn rồi tặng quà.", okfx: [{ heal: 1 }, { loot: 3 }], bad: "Bên kia là... chính bạn, đang mở cửa. Bạn đóng sầm lại, người run lẩy bẩy.", badfx: [{ mp: -0.4 }] },
    { t: "Gõ lại", ok: "Tiếng gõ ngừng. Dưới khe cửa có ai đó luồn qua một mảnh giấy.", okfx: [{ give: { scroll_map: 1 } }] },
  ], true),
  // ---------------------------------------------------------------- small finds
  R("r_abandoned_camp", "Trại Bỏ Hoang", "campfire_tent", "Một chiếc lều rách, bếp lửa đã tắt từ lâu. Chủ trại dường như đi vội.", [
    { t: "Lục soát lều", ok: "Bạn tìm thấy ít đồ dùng và lương khô.", okfx: [{ loot: 2 }, { give: { bread: 1 } }] },
    { t: "Nhóm lửa nghỉ ngơi", ok: "Cả đội sưởi ấm và ăn một bữa nóng hổi.", okfx: [{ heal: 0.5 }, { mp: 0.3 }] },
  ]),
  R("r_supply_drop", "Kiện Hàng Rơi", "crates", "Mấy kiện hàng đóng dấu của một đoàn buôn nằm lăn lóc. Có vẻ chúng bị rơi khỏi xe.", [
    { t: "Mở kiện hàng", ok: "Bên trong toàn đồ tiếp tế!", okfx: [{ give: { potion_hp: 1 } }, { loot: 2 }] },
    { t: "Mang trả đoàn buôn", check: ["int", 10], ok: "Bạn lần theo dấu xe tìm được đoàn buôn. Họ trả công hậu hĩnh.", okfx: [{ goldF: 50 }, { xpF: 4 }], bad: "Dấu xe mất hút. Thôi thì... cứ mở ra vậy.", badfx: [{ loot: 1 }] },
  ]),
  R("r_signpost", "Tấm Biển Chỉ Đường", "signpost", "Một tấm biển gỗ cũ với ba mũi tên chỉ ba hướng, chữ đã mờ hết.", [
    { t: "Đi theo mũi tên trái", check: ["luck", 10], ok: "Đường trái dẫn tới một góc khuất có đồ.", okfx: [{ loot: 2 }], bad: "Ngõ cụt. Bạn phí mất một lúc." },
    { t: "Đọc kỹ dòng chữ mờ", check: ["int", 11], ok: "Bạn đọc được: \"Kho báu ở dưới biển này\". Và đúng thật.", okfx: [{ goldF: 40 }], bad: "Chữ mờ quá, không đọc nổi." },
  ]),
  R("r_hollow_log", "Khúc Gỗ Rỗng", "crates", "Một khúc gỗ rỗng ruột, bên trong tối om. Có tiếng sột soạt.", [
    { t: "Thò tay vào", check: ["luck", 10], ok: "Bạn lôi ra một túi đồ của sóc tích trữ: hạt, quả và... vài đồng vàng?", okfx: [{ goldF: 20 }, { give: { seed_berry: 1 } }], bad: "Một con rắn cắn vào tay!", badfx: [{ hurt: 0.1 }] },
    { t: "Chọc gậy vào", ok: "Một con sóc nhảy ra, làm rơi vài hạt giống.", okfx: [{ give: { seed_herb: 1, seed_wheat: 1 } }] },
  ]),
  R("r_old_boat", "Con Thuyền Mắc Cạn", "boat", "Một con thuyền gỗ mắc cạn trên bờ, cánh buồm rách tả tơi phần phật trong gió.", [
    { t: "Lục khoang thuyền", ok: "Trong khoang còn một hòm đồ của thuỷ thủ.", okfx: [{ loot: 3 }] },
    { t: "Tháo lấy gỗ", ok: "Gỗ thuyền chắc và bền.", okfx: [{ give: { wood: 4 } }] },
  ]),
  R("r_skeleton_note", "Bộ Xương Và Lá Thư", "bone_pile", "Một bộ xương tựa lưng vào đá, tay còn nắm chặt một lá thư.", [
    { t: "Đọc lá thư", ok: "\"Gửi em, anh xin lỗi vì không về kịp...\" Kẹp trong thư là một tấm bản đồ nhỏ và ít tiền.", okfx: [{ goldF: 25 }, { give: { scroll_map: 1 } }] },
    { t: "Chôn cất ông", ok: "Bạn đắp một nấm mộ nhỏ. Có cảm giác ai đó đang mỉm cười.", okfx: [{ xpF: 5 }, { heal: 0.3 }] },
  ]),
  R("r_hidden_stash", "Hầm Giấu Đồ", "chest", "Tiếng bước chân bạn vang rỗng. Dưới lớp đất là một nắp hầm gỗ.", [
    { t: "Cạy nắp hầm", check: ["str", 10], ok: "Hầm đầy đồ tiếp tế và vàng!", okfx: [{ loot: 3 }, { goldF: 30 }], bad: "Nắp hầm kẹt cứng. Bạn cạy gãy cả dụng cụ." },
    { t: "Tìm cơ quan mở", check: ["int", 11], ok: "Một tiếng cạch, nắp hầm tự mở.", okfx: [{ loot: 3 }, { goldF: 30 }], bad: "Không tìm được cơ quan nào." },
  ]),
  R("r_wind_chimes", "Chuông Gió", "lanterns", "Hàng trăm chiếc chuông gió treo trên cành cây khô, reo leng keng dù trời không có gió.", [
    { t: "Lắng nghe", check: ["wil", 10], ok: "Tiếng chuông kể cho bạn nghe lối đi an toàn qua tầng này.", okfx: [{ give: { scroll_map: 1 } }, { xpF: 3 }], bad: "Tiếng chuông làm bạn đau đầu.", badfx: [{ mp: -0.2 }] },
    { t: "Lấy một chiếc chuông", ok: "Chiếc chuông nhỏ reo lên mỗi khi quái vật tới gần.", okfx: [{ give: { scroll_repel: 1 } }] },
  ]),
  R("r_golden_apple", "Cây Táo Vàng", "whisper_tree", "Một cây táo nhỏ mọc giữa nơi hoang vu, cành treo đúng một quả táo vàng óng.", [
    { t: "Hái quả táo", check: ["luck", 11], ok: "Cắn một miếng, sức mạnh tràn trề.", okfx: [{ heal: 1 }, { mp: 1 }, { xpF: 6 }], bad: "Quả táo hoá thành đá ngay trong tay bạn.", badfx: [{ give: { stone: 1 } }] },
    { t: "Chăm bón cho cây", take: { herb: 1 }, ok: "Cây rung rinh cảm ơn, thả xuống vài hạt giống.", okfx: [{ give: { seed_berry: 2 } }, { xpF: 3 }] },
  ]),
  R("r_training_dummy", "Bù Nhìn Luyện Tập", "statue", "Một con bù nhìn rơm với tấm bia: \"Ai đánh đổ ta sẽ được thưởng.\"", [
    { t: "Đánh thật mạnh", check: ["str", 12], ok: "Bù nhìn đổ rạp. Trong bụng rơm có một túi tiền.", okfx: [{ goldF: 35 }, { xpF: 4 }], bad: "Bù nhìn bật lại, đập trúng mặt bạn.", badfx: [{ hurt: 0.06 }] },
    { t: "Tập kỹ thuật", ok: "Cả đội luyện tập một hồi. Ai cũng tiến bộ.", okfx: [{ xpF: 6 }] },
  ]),
  R("r_candle_shrine", "Điện Thờ Nến", "brazier", "Hàng trăm ngọn nến cháy lặng lẽ trong một hốc đá. Mỗi ngọn là một lời cầu nguyện của lữ khách.", [
    { t: "Thắp thêm một ngọn nến", ok: "Ngọn nến của bạn cháy sáng nhất. Lòng bạn thanh thản.", okfx: [{ mp: 0.6 }, { heal: 0.3 }] },
    { t: "Lấy sáp nến", ok: "Sáp nến có thể dùng vào việc gì đó.", okfx: [{ give: { soul_wax: 2 } }] },
  ]),
  R("r_river_crossing", "Dòng Suối Chảy Xiết", "rapids", "Một dòng suối chảy xiết chắn ngang. Bên kia bờ có ánh lấp lánh.", [
    { t: "Lội qua", check: ["str", 11], ok: "Bạn vượt suối an toàn và nhặt được thứ lấp lánh bên bờ.", okfx: [{ loot: 2 }, { goldF: 15 }], bad: "Dòng nước cuốn bạn đi một đoạn.", badfx: [{ hurt: 0.12 }] },
    { t: "Câu cá", check: ["agi", 9], ok: "Câu được mấy con cá béo!", okfx: [{ give: { lantern_fish: 3 } }], bad: "Cá khôn quá, không cắn câu." },
  ]),
  R("r_flower_field", "Cánh Đồng Hoa", "fireflies", "Một cánh đồng hoa nở rộ giữa lòng Vực Sâu, hương thơm ngào ngạt.", [
    { t: "Hái hoa", ok: "Bạn gom được một bó hoa đẹp — quà tặng tuyệt vời cho ai đó ở nhà.", okfx: [{ give: { iris_flower: 3 } }] },
    { t: "Nằm nghỉ giữa hoa", ok: "Cả đội ngủ thiếp đi, tỉnh dậy khoẻ khoắn.", okfx: [{ heal: 0.7 }, { mp: 0.4 }] },
  ]),
  R("r_miner", "Thợ Mỏ Mắc Kẹt", "person:miner", "Tiếng kêu cứu vọng ra từ một đường hầm sập. \"Có ai không? Tôi bị kẹt!\"", [
    { t: "Đào cứu ông", check: ["str", 11], ok: "Bạn đào được ông ra. Ông tặng bạn cả giỏ quặng.", okfx: [{ loot: 3 }, { xpF: 4 }], bad: "Hầm lại sập thêm. Cả hai phải bò mãi mới ra.", badfx: [{ hurt: 0.12 }, { xpF: 2 }] },
    { t: "Tìm lối vào khác", check: ["int", 10], ok: "Bạn tìm được một khe nứt thông vào hầm. Ông thợ mỏ mừng rỡ cảm ơn.", okfx: [{ goldF: 35 }, { xpF: 4 }], bad: "Không tìm được lối nào khác." },
  ]),
  R("r_alchemist", "Nhà Giả Kim Lập Dị", "person:alchemist", "Một người đàn ông tóc dựng đứng khuấy nồi thuốc bốc khói tím. \"Tình nguyện viên! Ta cần một tình nguyện viên!\"", [
    { t: "Uống thử thuốc", check: ["luck", 11], ok: "Thành công! Bạn thấy mình mạnh hơn bao giờ hết. Ông ta ghi chép sung sướng.", okfx: [{ xpF: 9 }, { heal: 1 }], bad: "Tóc bạn dựng đứng như ông ta. Và người thì đau ê ẩm.", badfx: [{ hurt: 0.15 }, { goldF: 20 }] },
    { t: "Mua thuốc đã thử nghiệm", cost: 45, ok: "\"Đảm bảo... tám mươi phần trăm an toàn!\"", okfx: [{ give: { potion_hp: 1, potion_mp: 1, antidote: 1 } }] },
  ]),
  R("r_hermit", "Ẩn Sĩ Trên Núi", "person:hermit", "Một ẩn sĩ râu tóc bạc phơ ngồi thiền trên tảng đá. Ông mở một mắt nhìn bạn.", [
    { t: "Ngồi thiền cùng ông", check: ["wil", 12], ok: "Thời gian như ngừng lại. Khi mở mắt, bạn thấy thế giới rõ ràng hơn.", okfx: [{ xpF: 10 }, { mp: 1 }], bad: "Chân bạn tê cứng, tâm trí thì cứ nghĩ tới đồ ăn." },
    { t: "Xin ông lời khuyên", ok: "\"Đừng đi nhanh hơn trái tim mình.\" Bạn không hiểu lắm, nhưng thấy lòng nhẹ đi.", okfx: [{ heal: 0.4 }] },
  ]),
  R("r_gravekeeper", "Người Giữ Mộ", "person:gravekeeper", "Một ông lão cầm xẻng đứng giữa nghĩa địa hoang. \"Chôn cất người chết là việc của ta. Nhưng dạo này họ không chịu nằm yên.\"", [
    { t: "Giúp ông dẹp xác sống", fight: true, ok: "Nghĩa địa yên tĩnh trở lại. Ông trả công bằng những món đồ tuỳ táng vô chủ.", okfx: [{ loot: 4 }, { goldF: 25 }] },
    { t: "Mua nước thánh của ông", cost: 30, ok: "\"Để giữ cho người sống còn sống.\"", okfx: [{ give: { water_flask: 3 } }] },
  ]),
  R("r_monk_duel", "Võ Tăng Thách Đấu", "person:monk", "Một võ tăng cơ bắp cuồn cuộn cúi chào. \"Ta nghe danh các ngươi. Xin chỉ giáo!\"", [
    { t: "Nhận lời", fight: true, ok: "Võ tăng chắp tay nể phục, tặng bạn bí kíp luyện công.", okfx: [{ xpF: 12 }, { loot: 1 }] },
    { t: "Đấu tay không", check: ["str", 14], ok: "Một trận so tài đẹp mắt. Cả hai cười lớn.", okfx: [{ xpF: 8 }], bad: "Bạn bị quật ngã ba lần liền.", badfx: [{ hurt: 0.2 }, { xpF: 3 }] },
  ]),
  R("r_lost_scholar", "Học Giả Lạc Lối", "person:scholar", "Một học giả gầy gò ôm chồng sách, mắt đảo liên hồi. \"Tôi đang tìm di tích cổ... nhưng lạc mất ba ngày rồi.\"", [
    { t: "Hộ tống ông một đoạn", fight: true, ok: "Bạn bảo vệ ông an toàn tới di tích. Ông tặng bạn những ghi chép quý.", okfx: [{ xpF: 10 }, { goldF: 30 }] },
    { t: "Cho ông lương khô", take: { bread: 1 }, ok: "Ông ăn ngấu nghiến rồi dạy bạn vài điều về lịch sử nơi này.", okfx: [{ xpF: 6 }] },
  ]),
  R("r_smuggler", "Tay Buôn Lậu", "person:smuggler", "Một gã mặt sẹo mở vạt áo khoác, bên trong lủng lẳng đủ thứ. \"Hàng hiếm, không hỏi nguồn gốc.\"", [
    { t: "Mua bom", cost: 40, ok: "\"Cẩn thận, đừng làm rơi.\"", okfx: [{ give: { fire_bomb: 2 } }], again: true },
    { t: "Mua bản đồ kho báu", cost: 80, check: ["luck", 10], ok: "Bản đồ dẫn tới một kho báu thật!", okfx: [{ loot: 4 }, { goldF: 30 }], bad: "Bản đồ giả. Gã đã biến mất." },
  ]),
  R("r_fisherman", "Ông Lão Câu Cá", "person:fisher", "Một ông lão ngồi câu bên vũng nước tối, chẳng rõ ở đây có cá không.", [
    { t: "Ngồi câu cùng ông", check: ["wil", 9], ok: "Kiên nhẫn được đền đáp. Bạn câu được một con cá vàng.", okfx: [{ give: { lantern_fish: 2 } }, { goldF: 20 }], bad: "Chẳng có con nào. Ông cười: \"Câu cá là để câu thời gian.\"", badfx: [{ heal: 0.3 }] },
    { t: "Mua cá của ông", cost: 20, ok: "Ông đưa cả giỏ cá tươi rói.", okfx: [{ give: { lantern_fish: 3 } }] },
  ]),
  R("r_crying_statue", "Tượng Đá Khóc", "statue", "Một bức tượng thiếu nữ ôm mặt. Từ khoé mắt đá, nước mắt rơi thành những viên ngọc nhỏ.", [
    { t: "Nhặt những giọt ngọc", ok: "Những viên ngọc trong vắt, lạnh buốt.", okfx: [{ give: { pearl: 1 } }, { goldF: 20 }] },
    { t: "Lau nước mắt cho tượng", check: ["wil", 11], ok: "Bức tượng ngừng khóc. Một làn gió ấm thổi qua, như tiếng cảm ơn.", okfx: [{ xpF: 7 }, { heal: 0.5 }], bad: "Nước mắt vẫn chảy mãi." },
  ]),
  R("r_giant_mushroom", "Nấm Khổng Lồ", "fireflies", "Một cây nấm to như ngôi nhà, mũ nấm có một ô cửa sổ tròn. Có ai sống ở đây sao?", [
    { t: "Gõ cửa", check: ["luck", 10], ok: "Một ông lão tí hon mở cửa, mời bạn uống trà và tặng bạn một món quà.", okfx: [{ heal: 0.6 }, { loot: 2 }], bad: "Không ai trả lời. Bào tử bay mù mịt.", badfx: [{ hurt: 0.05 }] },
    { t: "Hái một mẩu mũ nấm", ok: "Mũ nấm dày và thơm.", okfx: [{ give: { mushroom_cap: 4 } }] },
  ]),
  R("r_warrior_ghost", "Hồn Chiến Binh", "wisp", "Hồn ma một chiến binh vẫn đứng gác trước ngôi đền đổ nát, như chưa biết cuộc chiến đã kết thúc từ lâu.", [
    { t: "Báo cho ông biết chiến tranh đã hết", check: ["wil", 12], ok: "Hồn ma buông vũ khí, mỉm cười rồi tan biến. Vũ khí của ông ở lại.", okfx: [{ loot: 3 }, { xpF: 6 }], bad: "Ông không tin. \"Kẻ thù đã tới!\"", badfx: [{ battle: { win: "o1" } }] },
    { t: "Thách đấu ông", fight: true, ok: "Ông ngã xuống, mãn nguyện vì đã chiến đấu lần cuối.", okfx: [{ xpF: 10 }, { loot: 2 }] },
  ]),
  R("r_sand_timer", "Đồng Hồ Cát Khổng Lồ", "rift", "Một chiếc đồng hồ cát cao bằng người, cát bên trong rơi ngược lên trên.", [
    { t: "Lật ngược đồng hồ", check: ["int", 12], ok: "Thời gian trôi lại một chút. Vết thương cả đội biến mất như chưa từng có.", okfx: [{ heal: 1 }, { mp: 1 }], bad: "Cát rơi loạn xạ. Bạn thấy mình già đi một chút.", badfx: [{ hurt: 0.1 }] },
    { t: "Lấy một nắm cát", ok: "Cát lấp lánh như bụi sao.", okfx: [{ give: { mana_crystal: 1 } }] },
  ]),
  R("r_lantern_festival", "Lễ Hội Đèn Trời", "lanterns", "Những chiếc đèn trời bay lên từ một ngôi làng nhỏ khuất sau đồi. Tiếng cười nói vọng lại.", [
    { t: "Ghé vào chơi", ok: "Dân làng chào đón nồng hậu. Cả đội ăn uống no say và được tặng quà.", okfx: [{ heal: 1 }, { loot: 2 }] },
    { t: "Thả một chiếc đèn", cost: 10, ok: "Chiếc đèn mang lời ước của bạn bay lên cao.", okfx: [{ mp: 0.6 }, { xpF: 3 }] },
  ]),
  R("r_rival", "Đối Thủ Truyền Kiếp", "person:rival", "Một nhà thám hiểm khác đứng chắn đường, khoanh tay cười khẩy. \"Lại là ngươi. Lần này ta sẽ xuống tầng dưới trước!\"", [
    { t: "Thi xem ai hạ quái nhanh hơn", fight: true, ok: "Bạn thắng! Đối thủ hậm hực ném cho bạn túi tiền cược.", okfx: [{ goldF: 50 }, { xpF: 6 }] },
    { t: "Bắt tay làm hoà", check: ["wil", 10], ok: "Đối thủ ngượng ngùng bắt tay, chia cho bạn ít đồ tiếp tế.", okfx: [{ give: { potion_hp: 2 } }, { xpF: 3 }], bad: "\"Hừ, ai thèm!\" Hắn bỏ đi." },
  ]),
  R("r_goddess_statue", "Tượng Nữ Thần Chữa Lành", "shrine", "Một bức tượng nữ thần dang tay, dưới chân là hồ nước trong vắt phát sáng nhẹ.", [
    { t: "Rửa mặt bằng nước hồ", ok: "Mọi mỏi mệt tan biến.", okfx: [{ heal: 1 }] },
    { t: "Cầu nguyện thành tâm", check: ["wil", 13], ok: "Nữ thần ban phước. Bạn cảm nhận sức mạnh mới.", okfx: [{ heal: 1 }, { mp: 1 }, { xpF: 6 }], bad: "Tượng im lặng. Có lẽ lòng bạn chưa đủ thành." },
  ]),
  R("r_mushroom_merchant", "Nấm Lùn Buôn Bán", "fireflies", "Một sinh vật nấm lùn tịt đội mũ đỏ chấm trắng bày hàng trên lá sen. \"Bào tử tươi! Hạt giống lạ! Mua đi mua đi!\"", [
    { t: "Mua túi hạt giống lạ", cost: 35, ok: "Không biết sẽ mọc ra cây gì. Hồi hộp quá!", okfx: [{ give: { seed_mushroom: 2, seed_lotus: 1 } }], again: true },
    { t: "Mua nấm hồi phục", cost: 25, ok: "\"Ăn vào là khoẻ ngay!\"", okfx: [{ give: { mushroom_cap: 3 } }, { heal: 0.3 }], again: true },
  ]),
  R("r_star_map", "Bản Đồ Sao", "glare", "Trên vòm đá phía trên, những ngôi sao được khắc thành chòm, lấp lánh như thật.", [
    { t: "Nghiên cứu các chòm sao", check: ["int", 12], ok: "Bạn nhận ra các chòm sao chỉ tới một điểm trên mặt đất. Và ở đó có đồ chôn.", okfx: [{ loot: 3 }, { xpF: 5 }], bad: "Đầu óc quay cuồng vì những đường nối chằng chịt." },
    { t: "Nằm ngắm sao", ok: "Cả đội nằm ngắm sao một lúc. Thật yên bình.", okfx: [{ heal: 0.4 }, { mp: 0.4 }] },
  ]),
  R("r_weapon_stone", "Thanh Kiếm Trong Đá", "altar", "Một thanh kiếm cắm sâu trong tảng đá. Xung quanh là dấu chân của hàng trăm người đã thử rút nó.", [
    { t: "Rút kiếm", check: ["str", 16], ok: "Thanh kiếm tuột ra dễ dàng như rút khỏi vỏ! Nó ngân lên trong tay bạn.", okfx: [{ loot: 5 }, { xpF: 10 }], bad: "Không nhúc nhích. Như hàng trăm người trước bạn." },
    { t: "Khắc tên lên đá", ok: "Bạn để lại dấu ấn của mình. Biết đâu sau này có người nhớ tới.", okfx: [{ xpF: 2 }] },
  ]),
  R("r_hungry_troll", "Quỷ Khổng Lồ Đói Bụng", "boulders", "Một con quỷ khổng lồ ôm bụng rên rỉ. \"Đói... đói quá... đưa đồ ăn đây, không thì ăn các ngươi!\"", [
    { t: "Cho nó cá", take: { lantern_fish: 2 }, ok: "Nó ăn ngon lành, ợ một cái rồi tặng bạn chiếc vòng cổ nó đeo.", okfx: [{ loot: 3 }] },
    { t: "Chiến đấu", fight: true, ok: "Con quỷ ngã xuống. Trong hang của nó chất đầy đồ của những nạn nhân.", okfx: [{ loot: 4 }, { goldF: 40 }] },
  ]),
  R("r_bottle_message", "Thư Trong Chai", "boat", "Một chiếc chai thuỷ tinh mắc giữa đám rễ cây, bên trong có cuộn giấy.", [
    { t: "Đọc thư", ok: "\"Ai đọc được thư này, kho báu của ta chôn dưới gốc cây cong nhất.\" Và bạn tìm thấy nó!", okfx: [{ goldF: 45 }, { loot: 1 }] },
    { t: "Viết thư trả lời và thả lại", ok: "Bạn viết vài dòng rồi đặt chai lại chỗ cũ. Biết đâu một ngày ai đó sẽ đọc.", okfx: [{ xpF: 2 }] },
  ]),
  R("r_carnival", "Gánh Xiếc Lạc Đường", "tent", "Một gánh xiếc với những chiếc lều sọc đỏ trắng dựng giữa Vực Sâu. Chú hề vẫy tay mời bạn vào.", [
    { t: "Chơi trò ném vòng", cost: 15, check: ["agi", 11], ok: "Trúng! Bạn được giải lớn!", okfx: [{ loot: 3 }], bad: "Trượt cả ba vòng. Chú hề cười khúc khích.", again: true },
    { t: "Xem biểu diễn", cost: 10, ok: "Màn biểu diễn tuyệt vời khiến cả đội quên hết mệt mỏi.", okfx: [{ heal: 0.8 }, { mp: 0.8 }] },
  ]),
  R("r_dying_dragon", "Con Rồng Già", "bone_pile", "Một con rồng già nằm thoi thóp, vảy đã bạc màu. Đôi mắt vàng nhìn bạn không chút thù địch.", [
    { t: "Ngồi nghe rồng kể chuyện", ok: "Rồng kể về thời mà Vực Sâu còn chưa tồn tại. Trước khi nhắm mắt, nó tặng bạn một chiếc vảy.", okfx: [{ xpF: 15 }, { give: { mana_crystal: 3 } }] },
    { t: "Chữa trị cho rồng", take: { potion_hp: 3 }, ok: "Rồng khẽ gầm, cảm ơn. Nó thả xuống một món trong kho báu của mình.", okfx: [{ loot: 6 }, { xpF: 8 }] },
  ], true),
  R("r_twin_doors", "Hai Cánh Cửa", "gate_arch", "Hai cánh cửa đứng cạnh nhau. Một cánh khắc chữ \"Vàng\", cánh kia khắc chữ \"Tri Thức\".", [
    { t: "Mở cửa Vàng", check: ["luck", 11], ok: "Vàng chất như núi!", okfx: [{ goldF: 70 }], bad: "Sau cửa là một cái hố. Bạn ngã lộn cổ.", badfx: [{ hurt: 0.12 }] },
    { t: "Mở cửa Tri Thức", ok: "Một thư viện nhỏ. Bạn đọc ngấu nghiến.", okfx: [{ xpF: 10 }] },
  ]),
  R("r_snowman", "Người Tuyết Bí Ẩn", "frost", "Một người tuyết đứng giữa nơi chẳng có tuyết. Mũi nó là củ cà rốt, mắt là hai viên than... và nó vừa chớp mắt.", [
    { t: "Tặng nó khăn quàng", ok: "Người tuyết vui vẻ nhảy nhót rồi tặng bạn một viên pha lê băng.", okfx: [{ give: { mana_crystal: 1 } }, { xpF: 3 }] },
    { t: "Lấy củ cà rốt", check: ["agi", 11], ok: "Bạn giật được củ cà rốt... vàng ròng!", okfx: [{ goldF: 40 }], bad: "Người tuyết ném bóng tuyết vào mặt bạn.", badfx: [{ hurt: 0.04 }] },
  ]),
  R("r_lava_forge", "Dòng Dung Nham", "lava_crack", "Một khe nứt dung nham chảy đỏ rực. Trên mép khe có vài viên quặng nóng chảy.", [
    { t: "Gắp quặng", check: ["agi", 12], ok: "Bạn gắp được mấy viên quặng quý mà không bị bỏng.", okfx: [{ loot: 3 }], bad: "Bỏng rát cả tay.", badfx: [{ hurt: 0.15 }] },
    { t: "Nướng thịt", take: { meat_beast: 1 }, ok: "Món thịt nướng dung nham ngon tuyệt. Cả đội no nê.", okfx: [{ heal: 0.8 }] },
  ]),
  R("r_echo_valley", "Thung Lũng Tiếng Vọng", "whirl", "Mọi âm thanh ở đây đều vọng lại gấp mười. Có ai đó ở xa đang hét lên chữ gì đó.", [
    { t: "Hét đáp lại", check: ["str", 9], ok: "Tiếng vọng làm rung chuyển vách đá, để lộ một hang nhỏ chứa đồ.", okfx: [{ loot: 2 }], bad: "Tiếng vọng làm rơi đá xuống đầu.", badfx: [{ hurt: 0.08 }] },
    { t: "Lặng im lắng nghe", check: ["wil", 11], ok: "Bạn nghe được tiếng một người thợ săn chỉ đường tới bãi đi săn.", okfx: [{ give: { meat_beast: 2, hide: 2 } }], bad: "Chỉ có tiếng gió." },
  ]),
  R("r_scarecrow_king", "Vua Bù Nhìn", "banner", "Một con bù nhìn đội vương miện rơm ngồi trên ngai bằng cán chổi. \"Nộp thuế cho vua!\"", [
    { t: "Nộp thuế", cost: 25, ok: "\"Thần dân tốt!\" Vua bù nhìn phong cho bạn tước hiệp sĩ rơm... và một túi hạt giống.", okfx: [{ give: { seed_wheat: 2, seed_pumpkin: 1 } }, { xpF: 3 }] },
    { t: "Lật đổ nhà vua", fight: true, ok: "Vương triều bù nhìn sụp đổ. Kho thuế thuộc về bạn.", okfx: [{ goldF: 55 }] },
  ]),
  R("r_meditation_stone", "Đá Thiền", "altar", "Một phiến đá phẳng lì, nhẵn bóng như đã có hàng ngàn người ngồi thiền trên đó.", [
    { t: "Ngồi thiền", ok: "Hơi thở chậm lại. Ma lực hồi phục đầy đủ.", okfx: [{ mp: 1 }] },
    { t: "Thiền sâu", check: ["wil", 14], ok: "Bạn chạm tới một tầng ý thức mới.", okfx: [{ mp: 1 }, { xpF: 12 }], bad: "Tâm trí bạn cứ lang thang mãi." },
  ]),
  R("r_ruined_caravan", "Đoàn Xe Bị Tấn Công", "cart", "Những chiếc xe hàng lật nghiêng, hàng hoá vương vãi. Dấu vuốt quái vật hằn sâu trên gỗ.", [
    { t: "Truy đuổi lũ quái", fight: true, ok: "Bạn lấy lại được hàng cho đoàn xe. Người sống sót trả công hậu hĩnh.", okfx: [{ goldF: 60 }, { loot: 2 }] },
    { t: "Nhặt đồ còn sót", ok: "Vài món hàng còn nguyên.", okfx: [{ loot: 2 }] },
  ]),
  R("r_underground_lake", "Hồ Ngầm", "rapids", "Một hồ nước ngầm trong vắt, dưới đáy lấp lánh những đồng xu mà ai đó từng thả xuống.", [
    { t: "Lặn xuống nhặt", check: ["str", 12], ok: "Bạn nhặt được cả vốc đồng xu cổ.", okfx: [{ goldF: 50 }], bad: "Nước lạnh cóng, bạn phải ngoi lên ngay.", badfx: [{ hurt: 0.08 }] },
    { t: "Uống nước hồ", ok: "Nước ngọt và mát lạnh. Cả đội tỉnh táo hẳn.", okfx: [{ mp: 0.6 }, { heal: 0.3 }] },
  ]),
];
