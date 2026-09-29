import type { StoryEvent } from "./types";

export const FLOOR1: StoryEvent[] = [
  {
    id: "f1_whisper",
    title: "Tiếng Thì Thầm Của Cây",
    start: "a",
    scenes: {
      a: {
        text: "Một cây sồi già có thân rỗng, trên vỏ khắc chi chít những cái tên. Khi bạn tới gần, tiếng thì thầm trong gió bỗng rõ ràng thành lời — bằng tiếng Nhật.\n\n\"...đừng tin... giọng nói... nó không ban điều ước... nó ăn...\"",
        choices: [
          { text: "Áp tai vào thân cây, cố nghe cho rõ.", check: { attr: "wil", dc: 12, pass: "pass", fail: "fail" } },
          { text: "Khắc tên mình lên thân cây, cạnh những cái tên khác.", next: "carve" },
          { text: "Rời đi. Cây biết nói không phải chuyện của mình.", end: true, keep: true },
        ],
      },
      pass: {
        text: "Bạn nhắm mắt. Giọng nói trở nên rõ ràng: một thanh niên, giọng khàn đặc.\n\n\"Tên tôi là Kaito. Tôi chết ở tầng 3... không, tôi không chết. Tôi vẫn đang ở đây. Nếu ai nghe được — đừng thu thập những chiếc Gai Đen. Đừng mang chúng về Thánh Địa. Mầm... Mầm không phải là...\"\n\nGiọng nói tắt lịm. Từ hốc cây, một nắm tinh thể nhỏ rơi ra.",
        fx: [{ give: { mana_crystal: 2 } }, { flag: "kaito_heard" }, { xp: 20 }],
      },
      fail: {
        text: "Tiếng thì thầm cuộn lại thành một tiếng hét chói tai. Đầu bạn đau như búa bổ. Khi tỉnh lại, bạn thấy mình ngồi bệt dưới gốc cây, mũi rỉ máu.",
        fx: [{ hurt: 0.15 }],
        keep: true,
      },
      carve: {
        text: "Bạn khắc tên \"{hero}\" lên thân cây. Ngay khi nét cuối hoàn thành, những cái tên khác khẽ phát sáng — như đang chào đón.\n\nBạn đếm được ít nhất bốn mươi cái tên. Có tên Việt, tên Anh, tên Nhật, tên Hàn... Tất cả đều là người chuyển sinh. Bạn không thấy cái tên nào được gạch đi. Nhưng cũng không thấy dấu hiệu nào cho thấy họ đã quay về.",
        fx: [{ flag: "names_carved" }, { xp: 10 }],
      },
    },
  },
  {
    id: "f1_fireflies",
    title: "Thung Lũng Đom Đóm",
    start: "a",
    scenes: {
      a: {
        text: "Hàng ngàn con đom đóm bay thành những vòng xoắn chậm rãi trên thung lũng. Nhìn kỹ, chúng dường như đang vẽ nên một hình thù lặp đi lặp lại: một vòng tròn, một mũi tên chỉ xuống đất, rồi ba chấm sáng.",
        choices: [
          { text: "Giải mã hoa văn.", check: { attr: "int", dc: 13, pass: "pass", fail: "fail" } },
          { text: "Nằm xuống thảm cỏ, nghỉ ngơi dưới ánh đom đóm.", next: "rest", keep: true },
          { text: "Rời đi.", end: true, keep: true },
        ],
      },
      pass: {
        text: "Vòng tròn là tảng đá tròn giữa thung lũng. Mũi tên chỉ xuống — bên dưới. Ba chấm là ba bước về phía đông.\n\nBạn đào ở đó và chạm vào một chiếc hộp gỗ mục. Bên trong có một cuốn sách thảo mộc, hai lọ thuốc và một túi vàng.",
        fx: [{ give: { "tome:regrowth": 1, potion_mp: 2 } }, { gold: 40 }, { xp: 25 }],
      },
      fail: {
        text: "Bạn nhìn tới hoa cả mắt mà vẫn không hiểu gì. Lũ đom đóm có vẻ thất vọng, tản đi hết. Có lẽ lần sau...",
        keep: true,
      },
      rest: {
        text: "Bạn nằm xuống. Ánh sáng đom đóm nhảy múa trên mi mắt, và lần đầu tiên kể từ khi tới thế giới này, bạn thấy lòng bình yên. Cả đội hồi phục sức lực.",
        fx: [{ heal: 0.5 }, { mp: 0.5 }],
        keep: true,
      },
    },
  },
  {
    id: "f1_lyra",
    title: "Mũi Tên Bạc",
    start: "a",
    portrait: "lyra",
    scenes: {
      a: {
        text: "Một tiếng kêu đau đớn vang lên. Bạn chạy tới và thấy một cô gái tai nhọn, tóc bạc như ánh trăng, đang bị treo ngược trong một cái bẫy lưới. Bên dưới, hai con sói xám gầm gừ, nhảy lên đớp vào chân cô.",
        portrait: "lyra",
        choices: [
          { text: "Lao vào đánh lũ sói!", fx: [{ battle: { group: ["forest_wolf", "forest_wolf"], win: "win" } }] },
          { text: "Ném đá đánh lạc hướng rồi cắt dây lưới.", check: { attr: "agi", dc: 13, pass: "sneak", fail: "sneak_fail" } },
          { text: "Không phải việc của mình.", end: true, keep: true },
        ],
      },
      sneak: {
        text: "Bạn ném một hòn đá vào bụi cây xa. Lũ sói quay đầu — đủ lâu để bạn cắt đứt sợi dây. Cô gái rơi xuống, lộn một vòng, và trước khi bạn kịp chớp mắt, hai mũi tên bạc đã cắm phập xuống đất ngay trước mũi lũ sói. Chúng cụp đuôi bỏ chạy.",
        fx: [{ xp: 30 }],
        next: "meet",
      },
      sneak_fail: {
        text: "Hòn đá bay trúng... đầu cô gái. Cô ta rên lên. Lũ sói quay sang nhìn bạn.",
        fx: [{ battle: { group: ["forest_wolf", "forest_wolf"], win: "win" } }],
      },
      win: {
        text: "Con sói cuối cùng bỏ chạy vào rừng sâu. Bạn cắt dây lưới, và cô gái đáp xuống nhẹ như chiếc lá rơi.",
        next: "meet",
      },
      meet: {
        speaker: "Cô gái tai nhọn",
        portrait: "lyra",
        text: "Cảm ơn. Ta là Lyra, người gác rừng tộc Tiên. Ba trăm năm canh giữ cánh rừng này, và đây là lần đầu tiên ta bị chính bẫy của mình bắt được.\n\n...Đừng cười.",
        next: "talk",
      },
      talk: {
        speaker: "Lyra",
        portrait: "lyra",
        text: "Ngươi là người chuyển sinh, phải không? Mùi của ngươi khác. Những kẻ như ngươi đi xuống, và không ai quay lại.\n\nRừng đang bệnh. Rễ Cổ Thụ Mẹ bị một thứ gì đó đâm xuyên, và mọi sinh vật đều trở nên điên loạn. Nếu ngươi định đi về phía đó... ta sẽ đi cùng.",
        choices: [
          { text: "Rất vui được đồng hành, Lyra.", fx: [{ recruit: "lyra" }, { flag: "lyra_joined" }], next: "join" },
          { text: "Tôi quen đi một mình.", next: "alone" },
        ],
      },
      alone: {
        speaker: "Lyra",
        portrait: "lyra",
        text: "Ta không hỏi ý kiến ngươi.",
        fx: [{ recruit: "lyra" }, { flag: "lyra_joined" }],
        next: "join",
      },
      join: {
        text: "Lyra Lá Bạc đã gia nhập! Bạn có thể sắp xếp đội hình trong mục Đội.",
      },
    },
  },
  {
    id: "f1_village",
    title: "Làng Nấm Mũ Đỏ",
    start: "route",
    portrait: "bram",
    scenes: {
      route: {
        text: "",
        route: [
          { cond: { all: [{ flag: "f1_cleared" }, { flag: "village_helped" }, { notFlag: "village_rewarded" }] }, to: "reward" },
          { cond: { flag: "village_helped" }, to: "again" },
          { to: "a" },
        ],
      },
      a: {
        text: "Giữa những cây nấm khổng lồ là một ngôi làng nhỏ xíu. Những sinh vật cao ngang đầu gối, đội mũ nấm đỏ chấm trắng, nhìn bạn đầy cảnh giác từ sau những ô cửa sổ tròn. Một người lính nấm cầm khiên gỗ bước ra chặn đường.",
        portrait: "bram",
        next: "guard",
      },
      guard: {
        speaker: "Lính Nấm",
        portrait: "bram",
        text: "Dừng lại, kẻ to xác. Làng Mũ Đỏ không chào đón người lạ. Lần trước có kẻ như ngươi tới, hắn mang theo một chiếc gai đen... và từ đó Rễ Mẹ bắt đầu thối rữa.",
        choices: [
          { text: "Tôi không phải kẻ đó. Tôi có thể giúp gì?", next: "help" },
          { text: "Kẻ đó trông thế nào?", next: "who", cond: { notFlag: "kaito_village" }, hide: true },
          { text: "(Chìa ra 3 Thảo Dược Rừng) Tôi đến để trao đổi.", cond: { has: "herb", n: 3 }, fx: [{ take: { herb: 3 } }, { give: { seed_mushroom: 2, seed_berry: 2 } }], next: "trade" },
          { text: "Xin lỗi đã làm phiền.", end: true, keep: true },
        ],
      },
      who: {
        speaker: "Lính Nấm",
        portrait: "bram",
        text: "Tóc đen, mắt buồn, mặc áo khoác kỳ lạ có hàng cúc vàng. Hắn nói hắn tên Kaito. Hắn nói hắn đang cố \"sửa chữa\" mọi thứ.\n\nHắn đâm chiếc gai vào Rễ Mẹ, rồi quỳ xuống khóc như một đứa trẻ.",
        fx: [{ flag: "kaito_village" }],
        next: "guard",
      },
      trade: {
        text: "Người lính nấm hít hít đống thảo dược, rồi gọi vào trong làng. Một bà cụ nấm lụm cụm mang ra một túi hạt giống nhỏ: Bào Tử Nấm Tinh Linh và Hạt Dâu Lửa.",
        next: "guard",
      },
      help: {
        speaker: "Trưởng Làng Morel",
        portrait: "mushroom",
        text: "(Một cụ nấm râu dài chống gậy bước ra.) Bram, lùi lại. Người này có đôi mắt khác với kẻ kia.\n\nNgười lạ, nếu ngươi thật lòng muốn giúp: hãy tới Rễ Cổ Thụ Mẹ ở phía đông, rút chiếc gai đen ra. Lão Mộc Vương — người canh giữ rễ — đã phát điên vì đau đớn. Lão sẽ tấn công bất cứ ai tới gần.",
        next: "bram",
      },
      bram: {
        speaker: "Bram",
        portrait: "bram",
        text: "...Trưởng làng. Cho con đi cùng người này. Nếu hắn phản bội, con sẽ là người đầu tiên biết.",
        choices: [
          { text: "Rất hân hạnh, Bram.", fx: [{ recruit: "bram" }, { flag: "village_helped" }, { give: { potion_hp: 2 } }], next: "join" },
          { text: "Cảm ơn, nhưng tôi sẽ tự mình làm.", fx: [{ flag: "village_helped" }, { give: { potion_hp: 3, bark_shield: 1 } }], next: "solo" },
        ],
      },
      join: {
        text: "Bram Mũ Đỏ đã gia nhập! Anh ta không nói thêm gì, nhưng bạn để ý thấy anh luôn bước nửa bước phía trước bạn, khiên giơ cao.\n\nTrưởng làng Morel dúi vào tay bạn hai lọ thuốc.",
        keep: true,
      },
      solo: {
        speaker: "Trưởng Làng Morel",
        portrait: "mushroom",
        text: "Vậy hãy mang theo những thứ này. Và quay lại khi xong việc — làng Mũ Đỏ không bao giờ quên ơn.",
        keep: true,
      },
      again: {
        text: "Dân làng Mũ Đỏ vẫy tay chào bạn. Trưởng làng Morel gật đầu: \"Rễ Mẹ vẫn đang đau đớn. Hãy nhanh lên, người lạ.\"",
        choices: [
          { text: "(Chìa ra 3 Thảo Dược Rừng) Trao đổi hạt giống.", cond: { has: "herb", n: 3 }, fx: [{ take: { herb: 3 } }, { give: { seed_mushroom: 2, seed_berry: 2 } }], next: "again" },
          { text: "Tạm biệt.", end: true, keep: true },
        ],
      },
      reward: {
        text: "Khi bạn quay lại, cả làng Mũ Đỏ ùa ra. Những chiếc mũ nấm đỏ nhảy tưng tưng khắp nơi. Trưởng làng Morel rưng rưng: \"Rễ Mẹ đã hết đau. Ngươi đã cứu tất cả chúng ta.\"\n\nDân làng mang tới những món quà quý nhất của họ.",
        fx: [{ give: { seed_pumpkin: 2, mana_crystal: 3 } }, { gold: 150 }, { xp: 80 }, { flag: "village_rewarded" }],
        choices: [
          { text: "Bram, cậu có muốn đi cùng tôi không?", cond: { not: { recruited: "bram" } }, hide: true, fx: [{ recruit: "bram" }], next: "bram_joins" },
          { text: "Không có gì. Tạm biệt mọi người!" },
        ],
      },
      bram_joins: {
        speaker: "Bram",
        portrait: "bram",
        text: "...Tưởng ngươi không bao giờ hỏi.",
      },
    },
  },
  {
    id: "f1_tears",
    title: "Suối Nước Mắt",
    start: "a",
    scenes: {
      a: {
        text: "Một dòng suối trong vắt chảy ra từ khe đá có hình một khuôn mặt đang khóc. Nước mang vị mặn. Truyền thuyết của tộc Tiên kể rằng, ai uống nước này sẽ nhìn thấy ký ức mình đã đánh mất.",
        choices: [
          { text: "Uống một ngụm.", check: { attr: "wil", dc: 13, pass: "vision", fail: "sad" } },
          { text: "Đổ đầy các bình nước.", fx: [{ give: { potion_hp: 2 } }], next: "fill" },
          { text: "Rửa mặt rồi đi tiếp.", fx: [{ heal: 0.3 }], end: true, keep: true },
        ],
      },
      vision: {
        text: "Bạn thấy lại đêm mưa đó. Ánh đèn pha. Nhưng lần này bạn thấy rõ hơn: ngay trước khi chiếc xe lao tới, có một cái bóng đứng giữa đường — một cái bóng với những chiếc gai đen mọc ra từ lưng.\n\nNó đang nhìn bạn. Và nó mỉm cười.\n\nKhông phải tai nạn. Bạn đã bị gọi tới đây.",
        fx: [{ flag: "vision_seen" }, { xp: 30 }, { heal: 1 }],
      },
      sad: {
        text: "Nước suối đắng ngắt. Bạn thấy mẹ mình đang khóc trước một tấm ảnh thờ. Bạn không nhìn rõ khuôn mặt trong ảnh, nhưng bạn biết đó là ai.\n\nKhi hoàn hồn, má bạn đã ướt đẫm.",
        fx: [{ heal: 0.5 }, { mp: 0.5 }],
      },
      fill: {
        text: "Bạn đổ đầy hai bình. Nước suối có tác dụng chữa lành lạ kỳ — chúng sẽ hữu ích dưới kia.",
      },
    },
  },
  {
    id: "f1_hunter_camp",
    title: "Trại Thợ Săn Bỏ Hoang",
    start: "a",
    scenes: {
      a: {
        text: "Ba chiếc lều rách nát, một đống lửa nguội lạnh từ lâu. Trên cọc gỗ treo một tấm biển viết bằng than:\n\n\"ĐỪNG ĐI XA HƠN TẦNG 3.\"\n\n— bằng tiếng Việt.",
        choices: [
          { text: "Lục soát các lều.", check: { attr: "agi", dc: 12, pass: "loot", fail: "trap" } },
          { text: "Đọc cuốn nhật ký trên bàn.", next: "diary" },
          { text: "Rời đi.", end: true, keep: true },
        ],
      },
      loot: {
        text: "Bạn kịp nhận ra một sợi dây bẫy mảnh như tơ và bước qua nó. Trong lều còn nguyên một rương đồ.",
        fx: [{ give: { iron_sword: 1, leather_armor: 1 } }, { gold: 60 }],
        choices: [{ text: "Đọc cuốn nhật ký.", next: "diary" }, { text: "Rời đi." }],
      },
      trap: {
        text: "Tách! Một sợi dây bẫy bật lên, và một loạt phi tiêu tẩm độc bắn ra. Bạn vẫn kịp vớ lấy thanh kiếm dựng ở góc lều.",
        fx: [{ hurt: 0.2 }, { give: { iron_sword: 1 } }],
        choices: [{ text: "Đọc cuốn nhật ký.", next: "diary" }, { text: "Rời đi." }],
      },
      diary: {
        text: "Nhật ký của một người tên Minh — cùng quê với bạn.\n\n\"Ngày 12: Kaito nói Gai Đen là chìa khoá. Mỗi kẻ canh giữ tầng đều mang một cái. Thu đủ, và ta có thể mở cánh cửa về nhà.\"\n\n\"Ngày 30: Kaito đã thay đổi. Hắn nói hắn nghe thấy tiếng Gai Đen hát.\"\n\n\"Ngày 31: Tôi sẽ quay lại Thánh Địa. Mầm nói nó sẽ bảo vệ tôi.\"\n\nTrang cuối cùng đã bị xé mất.",
        fx: [{ flag: "minh_diary" }, { xp: 20 }, { give: { "ptome:p_vigor": 1 } }],
      },
    },
  },
  {
    id: "f1_guardian",
    title: "Rễ Cổ Thụ Mẹ",
    start: "route",
    portrait: "treant",
    scenes: {
      route: { text: "", route: [{ cond: { flag: "f1_cleared" }, to: "done" }, { to: "a" }] },
      a: {
        text: "Rễ của Cổ Thụ Mẹ to như những dãy đồi, vặn xoắn trong đau đớn. Ở trung tâm, một chiếc gai đen dài bằng cánh tay đâm xuyên qua lõi rễ, rỉ ra thứ nhựa đen như mực.\n\nMặt đất rung chuyển. Một cái cây khổng lồ với khuôn mặt méo mó đứng dậy — Lão Mộc Vương.",
        portrait: "treant",
        next: "b",
      },
      b: {
        speaker: "Lão Mộc Vương",
        portrait: "treant",
        text: "ĐAU... ĐAU QUÁ... KẺ... CHUYỂN SINH... CÁC NGƯƠI... MANG NÓ TỚI...\n\nCÚT... HOẶC... CHẾT...",
        choices: [
          { text: "Tôi đến để rút chiếc gai ra! Hãy để tôi giúp!", check: { attr: "wil", dc: 14, pass: "calm", fail: "fight" } },
          { text: "Lyra, cô có thể nói chuyện với ông ấy không?", cond: { party: "lyra" }, next: "lyra" },
          { text: "(Rút vũ khí) Chuẩn bị chiến đấu!", next: "fight" },
        ],
      },
      calm: {
        text: "Trong một khoảnh khắc, ánh mắt Lão Mộc Vương trở nên tỉnh táo. \"Nhanh... ta không... kìm được lâu...\" Lão gồng mình chống lại chính cơ thể mình.\n\nCơ hội của bạn!",
        fx: [{ battle: { win: "win", noFlee: true, enemyFx: [{ s: "weaken", t: 3 }, { s: "slow", t: 3 }] } }],
      },
      lyra: {
        speaker: "Lyra",
        portrait: "lyra",
        text: "(Lyra cất tiếng hát một khúc ca cổ của tộc Tiên. Những chiếc rễ ngừng quằn quại trong giây lát.)\n\nÔng ấy không thể dừng lại — Gai Đen đang điều khiển ông ấy. Nhưng ta đã làm ông ấy chậm lại. Đánh vào những vết nứt phát sáng!",
        fx: [{ battle: { win: "win", noFlee: true, enemyFx: [{ s: "slow", t: 3 }, { s: "vulnerable", t: 3 }] } }],
      },
      fight: {
        text: "Những chiếc rễ khổng lồ quất xuống!",
        fx: [{ battle: { win: "win", noFlee: true } }],
      },
      win: {
        text: "Lão Mộc Vương khuỵu xuống. Bạn trèo lên lõi rễ, nắm lấy chiếc gai đen và giật mạnh. Nó rời ra với một âm thanh như tiếng thở dài.\n\nChiếc gai ấm nóng trong tay bạn. Nó đang đập — chậm rãi — như một trái tim.",
        fx: [{ give: { black_thorn: 1 } }, { clearFloor: true }],
        next: "blessing",
      },
      blessing: {
        speaker: "Lão Mộc Vương",
        portrait: "treant",
        text: "Cảm ơn... người trẻ tuổi. Ta đã đợi... rất lâu. Hãy nhận lấy phước lành của rừng.\n\nVà nghe này: đừng để những chiếc gai tụ lại một chỗ. Chúng... đang gọi nhau.",
        fx: [{ give: { "ptome:p_regeneration": 1 } }, { xp: 100 }],
        next: "stairs",
      },
      stairs: {
        text: "Phía sau Rễ Mẹ, những bậc đá cổ xưa lộ ra, dẫn xuống sâu hơn. Cầu thang xuống tầng 2 đã mở.\n\n(Bạn có thể quay lại Thánh Địa qua Cổng Dịch Chuyển ở đầu tầng. Cổng Vực Sâu giờ đã có thể đưa bạn thẳng tới tầng 2.)",
      },
      done: {
        text: "Lão Mộc Vương đang ngủ yên, rễ của lão đã ngừng quằn quại. Cầu thang xuống tầng dưới ở ngay phía sau.",
        keep: true,
      },
    },
  },
];
