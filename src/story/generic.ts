import type { StoryEvent } from "./types";

/** Guardian event used by procedurally themed floors. {floorName} and {boss} are filled in at runtime. */
export const GENERIC_GUARDIAN: StoryEvent = {
  id: "g_guardian",
  title: "Kẻ Canh Giữ Tầng",
  start: "route",
  scenes: {
    route: { text: "", route: [{ cond: { flag: "{floorFlag}" }, to: "done" }, { to: "a" }] },
    a: {
      text: "Ở tận cùng {floorName}, một sinh vật khổng lồ canh giữ lối xuống: {boss}. Trên người nó, một chiếc Gai Đen cắm sâu, rỉ ra thứ nhựa đen đặc quánh.\n\nNhững chiếc gai trong túi bạn đập dồn dập, như đang gọi.",
      choices: [
        { text: "Chiến đấu!", fx: [{ battle: { win: "win", noFlee: true } }] },
        { text: "Chưa phải lúc. Rút lui.", end: true, keep: true },
      ],
    },
    win: {
      text: "Kẻ canh giữ gục ngã. Bạn rút chiếc Gai Đen ra — nó ấm nóng và đập chậm rãi, hoà cùng nhịp với những chiếc khác trong túi.\n\nCầu thang xuống tầng tiếp theo đã mở.",
      fx: [{ give: { black_thorn: 1 } }, { clearFloor: true }, { xpF: 12 }, { goldF: 60 }],
    },
    done: { text: "Nơi này giờ im lặng. Cầu thang xuống tầng dưới ở ngay gần đây.", keep: true },
  },
};

export const RANDOM_EVENTS: StoryEvent[] = [
  {
    id: "g_merchant",
    title: "Thương Nhân Lang Thang",
    start: "a",
    portrait: "nomad",
    scenes: {
      a: {
        speaker: "Thương nhân",
        portrait: "nomad",
        text: "Một thương nhân đội nón rộng vành ngồi bên chiếc xe đẩy đầy ắp đồ. \"Hàng tốt, giá hời, không hỏi nguồn gốc! Vực Sâu rộng lớn, nhưng tiền thì ở đâu cũng là tiền!\"",
        choices: [
          { text: "Mua 2 Thuốc Hồi Máu — 40 vàng", cond: { gold: 40 }, fx: [{ gold: -40 }, { give: { potion_hp: 2 } }], next: "a" },
          { text: "Mua 2 Thuốc Ma Lực — 50 vàng", cond: { gold: 50 }, fx: [{ gold: -50 }, { give: { potion_mp: 2 } }], next: "a" },
          { text: "Mua 1 Lông Phượng Hoàng — 120 vàng", cond: { gold: 120 }, fx: [{ gold: -120 }, { give: { phoenix_down: 1 } }], next: "a" },
          { text: "Mua túi hạt giống — 45 vàng", cond: { gold: 45 }, fx: [{ gold: -45 }, { give: { seed_berry: 1, seed_herb: 1, seed_radish: 1 } }], next: "a" },
          { text: "Mua 2 Bình Nước Thánh — 30 vàng", cond: { gold: 30 }, fx: [{ gold: -30 }, { give: { water_flask: 2 } }], next: "a" },
          { text: "Tạm biệt.", end: true, keep: true },
        ],
      },
    },
  },
  {
    id: "g_shrine",
    title: "Điện Thờ Cổ",
    start: "a",
    scenes: {
      a: {
        text: "Một điện thờ nhỏ bằng đá phủ rêu. Bức tượng thần trên bệ đã bị thời gian mài mòn tới mức không còn nhận ra khuôn mặt, chỉ còn đôi bàn tay chắp lại cầu nguyện.",
        choices: [
          { text: "Quỳ xuống cầu nguyện.", check: { attr: "wil", dc: 12, pass: "bless", fail: "silent" } },
          { text: "Dâng 30 vàng.", cond: { gold: 30 }, fx: [{ gold: -30 }], next: "offer" },
          { text: "Rời đi.", end: true, keep: true },
        ],
      },
      bless: { text: "Một luồng ấm áp chảy qua cơ thể. Mọi vết thương đều khép lại.", fx: [{ heal: 1 }, { mp: 1 }] },
      silent: { text: "Bức tượng im lặng. Nhưng ít ra bạn cũng được nghỉ chân một lúc.", fx: [{ heal: 0.25 }] },
      offer: { text: "Đồng vàng tan vào đá. Trong đầu bạn vang lên một tiếng thì thầm, dạy cho bạn một bài học chiến đấu cũ xưa.", fx: [{ xpF: 6 }, { heal: 0.5 }] },
    },
  },
  {
    id: "g_trap",
    title: "Bẫy Ẩn",
    start: "a",
    scenes: {
      a: {
        text: "Tách! Mặt đất dưới chân bạn phát ra một tiếng động nhỏ. Bạn chỉ có một nửa giây.",
        choices: [{ text: "Nhảy tránh!", check: { attr: "agi", dc: 13, pass: "pass", fail: "fail" } }],
      },
      pass: { text: "Bạn nhảy tránh kịp. Bên dưới cái bẫy là túi đồ của một nạn nhân kém may mắn hơn.", fx: [{ loot: 2 }, { goldF: 15 }] },
      fail: { text: "Một loạt gai đá bắn lên từ mặt đất. Đau điếng!", fx: [{ hurt: 0.2 }] },
    },
  },
  {
    id: "g_wounded",
    title: "Nhà Thám Hiểm Bị Thương",
    start: "a",
    portrait: "villager",
    scenes: {
      a: {
        text: "Một người đàn ông ngồi dựa vào gốc cây, ôm bụng, máu thấm qua kẽ tay. Áo giáp của anh ta mang huy hiệu của một hội mạo hiểm giả mà bạn chưa từng nghe tên.",
        portrait: "villager",
        choices: [
          { text: "Cho anh ta một Thuốc Hồi Máu.", cond: { has: "potion_hp" }, fx: [{ take: { potion_hp: 1 } }], next: "saved" },
          { text: "Băng bó bằng 2 Thảo Dược Rừng.", cond: { has: "herb", n: 2 }, fx: [{ take: { herb: 2 } }], next: "saved" },
          { text: "Bỏ đi.", end: true, keep: true },
        ],
      },
      saved: {
        speaker: "Nhà thám hiểm",
        portrait: "villager",
        text: "Cảm ơn... Tôi tưởng mình tiêu rồi. Nghe này — kẻ canh giữ tầng này sợ những đòn đánh vào điểm yếu nguyên tố của nó. Và đừng bao giờ ngủ gần một chiếc Gai Đen.\n\nCầm lấy cái này, coi như trả ơn.",
        fx: [{ goldF: 30 }, { loot: 2 }, { xpF: 4 }],
      },
    },
  },
  {
    id: "g_mimic",
    title: "Chiếc Rương Kỳ Lạ",
    start: "a",
    scenes: {
      a: {
        text: "Một chiếc rương gỗ nằm giữa đường. Nó trông... quá hoàn hảo. Không một vết xước, không một hạt bụi.",
        choices: [
          { text: "Quan sát thật kỹ.", check: { attr: "int", dc: 13, pass: "spot", fail: "open" } },
          { text: "Mở ra ngay.", check: { attr: "luck", dc: 11, pass: "loot", fail: "bite" } },
          { text: "Bỏ đi.", end: true, keep: true },
        ],
      },
      spot: {
        text: "Bạn nhận ra những chiếc răng nhỏ xíu ở mép nắp rương. Rương ma! Nó chưa biết bạn đã phát hiện ra.",
        choices: [
          { text: "Tấn công trước!", fx: [{ battle: { levelAdd: 2, win: "loot", enemyFx: [{ s: "stun", t: 1 }, { s: "vulnerable", t: 2 }] } }] },
          { text: "Lặng lẽ bỏ đi.", end: true },
        ],
      },
      open: { text: "Trông nó hoàn toàn bình thường. Bạn mở nắp...", next: "bite" },
      bite: {
        text: "Chiếc rương há ra một cái miệng đầy răng! Những con quái vật khác nghe tiếng động kéo tới.",
        fx: [{ battle: { levelAdd: 2, win: "loot" } }],
      },
      loot: { text: "Bên trong rương đầy ắp chiến lợi phẩm.", fx: [{ loot: 4 }, { goldF: 40 }] },
    },
  },
  {
    id: "g_ambush",
    title: "Phục Kích!",
    start: "a",
    scenes: {
      a: {
        text: "Bụi cây xung quanh bỗng rung lên. Bạn đã bước vào một ổ phục kích!",
        fx: [{ battle: { levelAdd: 1, win: "win" } }],
      },
      win: { text: "Bạn đánh lui lũ phục kích và lục soát hang ổ của chúng.", fx: [{ loot: 3 }] },
    },
  },
  {
    id: "g_lost_soul",
    title: "Linh Hồn Lạc Lối",
    start: "a",
    portrait: "wisp",
    scenes: {
      a: {
        text: "Một đốm sáng mờ nhạt bay quanh bạn, thì thầm một cái tên — tên của ai đó mà nó không còn nhớ là của mình hay của người khác.",
        choices: [
          { text: "Dẫn nó về phía ánh sáng.", check: { attr: "wil", dc: 12, pass: "pass", fail: "fail" } },
          { text: "Phớt lờ.", end: true, keep: true },
        ],
      },
      pass: { text: "Đốm sáng bay lên, bừng sáng một lần cuối rồi tan biến. Nó để lại một mảnh tinh thể nhỏ, ấm áp.", fx: [{ xpF: 5 }, { give: { mana_crystal: 1 } }] },
      fail: { text: "Đốm sáng run rẩy rồi tắt lịm. Bạn không chắc mình đã giúp hay làm hại nó." },
    },
  },
  {
    id: "g_gamble",
    title: "Kẻ Đánh Bạc Xương",
    start: "a",
    portrait: "mummy",
    scenes: {
      a: {
        speaker: "Bộ xương",
        portrait: "mummy",
        text: "Một bộ xương đội mũ phớt ngồi bên bàn đá, lắc lạch cạch hũ xúc xắc. \"Chơi một ván không, người sống? Cược 50 vàng, thắng ăn gấp đôi. Ta chơi sòng phẳng — ta chẳng còn gì để mất nữa, khặc khặc!\"",
        choices: [
          { text: "Chơi một ván (50 vàng).", cond: { gold: 50 }, fx: [{ gold: -50 }], check: { attr: "luck", dc: 11, pass: "win", fail: "lose" } },
          { text: "Thôi.", end: true, keep: true },
        ],
      },
      win: { text: "Sáu! Bộ xương rên lên thảm thiết và đẩy sang cho bạn 100 vàng.", fx: [{ gold: 100 }], next: "a" },
      lose: { text: "Một. Bộ xương cười khặc khặc, gom tiền của bạn vào hốc mắt.", next: "a" },
    },
  },
  {
    id: "g_cache",
    title: "Kho Đồ Bỏ Lại",
    start: "a",
    scenes: {
      a: {
        text: "Dưới một tảng đá, bạn tìm thấy một chiếc túi da buộc chặt. Có ai đó đã giấu nó ở đây, và không bao giờ quay lại lấy.",
        fx: [{ loot: 3 }, { goldF: 25 }],
      },
    },
  },
  {
    id: "g_statue",
    title: "Tượng Người Chuyển Sinh",
    start: "a",
    scenes: {
      a: {
        text: "Một bức tượng đá của một thiếu niên cầm kiếm, gương mặt đầy quyết tâm. Dưới chân tượng có khắc: \"Đã tới được đây. Đã không đi tiếp.\"\n\nBạn đứng lặng một lúc. Có ai đó sẽ khắc những dòng như thế cho bạn không?",
        choices: [
          { text: "Đặt tay lên bệ tượng.", fx: [{ xpF: 4 }, { heal: 0.3 }] },
          { text: "Rời đi." },
        ],
      },
    },
  },
];
