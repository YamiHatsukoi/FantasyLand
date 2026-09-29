import type { StoryEvent } from "./types";

export const FLOOR2: StoryEvent[] = [
  {
    id: "f2_caravan",
    title: "Đoàn Lữ Hành Cuối Cùng",
    start: "route",
    portrait: "samira",
    scenes: {
      route: { text: "", route: [{ cond: { flag: "caravan_saved" }, to: "shop" }, { to: "a" }] },
      a: {
        text: "Năm chiếc xe kéo bởi những con thằn lằn khổng lồ đang bị vây kín bởi đàn bọ cạp hổ phách. Những người du mục quấn khăn chống trả bằng giáo, nhưng họ đang thua.\n\nỞ giữa đoàn xe, một thiếu nữ giơ cao một ngọn đèn — ngọn lửa trắng của nó đẩy lùi lũ bọ cạp, nhưng đang yếu dần.",
        portrait: "samira",
        choices: [
          { text: "Xông vào giúp đoàn lữ hành!", fx: [{ battle: { group: ["amber_scorpion", "amber_scorpion", "amber_scorpion"], win: "win" } }] },
          { text: "Nấp sau cồn cát chờ mọi chuyện kết thúc.", next: "hide" },
        ],
      },
      hide: {
        text: "Bạn nấp sau cồn cát. Tiếng hét, tiếng giáo gãy, tiếng lửa tắt... Khi mọi thứ im lặng, chỉ còn lại xác xe và cát. Bạn nhặt được vài thứ, nhưng lương tâm thì nặng trĩu.",
        fx: [{ give: { chitin: 3, amber: 1 } }, { flag: "caravan_lost" }],
      },
      win: {
        speaker: "Thiếu nữ cầm đèn",
        portrait: "samira",
        text: "Ngọn Lửa Trắng phù hộ ngươi, người lạ. Ta là Samira, tư tế của đoàn lữ hành Sa Nhân. Chúng ta đang tìm Ốc Đảo Gương — nơi mẹ ta biến mất mười năm trước.",
        next: "ask",
      },
      ask: {
        speaker: "Samira",
        portrait: "samira",
        text: "Ngọn lửa của ta... nó chỉ về phía ngươi từ lúc ngươi xuất hiện. Có lẽ đó là ý của Nữ Thần. Ngươi có đồng ý để ta đi cùng không? Đổi lại, đoàn lữ hành sẽ bán hàng cho ngươi với giá hữu nghị.",
        choices: [
          { text: "Chào mừng, Samira.", fx: [{ recruit: "samira" }, { flag: "caravan_saved" }, { xp: 40 }], next: "joined" },
          { text: "Đội tôi hơi đông, nhưng cô có thể đợi ở Thánh Địa.", fx: [{ recruit: "samira" }, { flag: "caravan_saved" }, { xp: 40 }], next: "joined" },
        ],
      },
      joined: {
        text: "Samira Hổ Phách đã gia nhập! (Nếu đội đã đủ người, cô sẽ đợi ở Thánh Địa — đổi đội hình trong mục Đội.)",
        next: "shop",
      },
      shop: {
        text: "Trưởng đoàn lữ hành, một ông già râu bạc có hình xăm mặt trời trên trán, mở những thùng hàng. \"Ân nhân muốn gì cứ lấy — giá hữu nghị!\"",
        choices: [
          { text: "Mua 3 Hạt Chà Là Vàng — 60 vàng", cond: { gold: 60 }, fx: [{ gold: -60 }, { give: { seed_date: 3 } }], next: "shop" },
          { text: "Mua 2 Bình Dầu Cháy — 50 vàng", cond: { gold: 50 }, fx: [{ gold: -50 }, { give: { oil_flask: 2 } }], next: "shop" },
          { text: "Mua 3 Thuốc Hồi Máu — 60 vàng", cond: { gold: 60 }, fx: [{ gold: -60 }, { give: { potion_hp: 3 } }], next: "shop" },
          { text: "Mua 1 Lông Phượng Hoàng — 120 vàng", cond: { gold: 120 }, fx: [{ gold: -120 }, { give: { phoenix_down: 1 } }], next: "shop" },
          { text: "Tạm biệt.", end: true, keep: true },
        ],
      },
    },
  },
  {
    id: "f2_oasis",
    title: "Ốc Đảo Gương",
    start: "a",
    scenes: {
      a: {
        text: "Mặt hồ phẳng lặng như gương. Trong nó, bạn không thấy bóng mình — mà thấy một phiên bản khác của bạn: đang ngồi trong lớp học, cười đùa với bạn bè, như thể chưa từng chết.",
        choices: [
          { text: "Chạm tay vào mặt nước.", check: { attr: "wil", dc: 15, pass: "pass", fail: "fail" } },
          { text: "Samira... đây có phải nơi mẹ cô...?", cond: { party: "samira" }, next: "samira" },
          { text: "Múc nước uống rồi đi tiếp.", fx: [{ heal: 0.4 }], end: true, keep: true },
        ],
      },
      pass: {
        text: "Bạn chạm vào. Phiên bản kia của bạn ngẩng lên, nhìn thẳng vào mắt bạn, và nói không thành tiếng:\n\n\"Đừng quay về. Ở đây, cậu còn có thể làm được điều gì đó.\"\n\nRồi mặt nước vỡ tan thành hàng ngàn mảnh tinh thể.",
        fx: [{ give: { mana_crystal: 3 } }, { xp: 50 }, { flag: "mirror_self" }],
      },
      fail: {
        text: "Bàn tay bạn chìm xuống, và mặt hồ kéo bạn vào. Bạn vùng vẫy... Khi bò được lên bờ, bạn thấy những bóng người từ dưới nước bò lên theo.",
        fx: [{ battle: { group: ["mummy", "dust_djinn", "mummy"], win: "after" } }],
      },
      after: {
        text: "Những ảo ảnh tan biến. Mặt hồ lại phẳng lặng như chưa có chuyện gì xảy ra.",
        keep: true,
      },
      samira: {
        speaker: "Samira",
        portrait: "samira",
        text: "(Samira quỳ xuống bên bờ hồ. Ngọn lửa trắng trong đèn của cô bùng lên.)\n\nMẹ ơi...",
        next: "samira2",
      },
      samira2: {
        text: "Trong mặt nước hiện lên hình ảnh một người phụ nữ cầm cùng một ngọn đèn. Bà mỉm cười, và đặt tay lên mặt nước từ phía bên kia. Khi hình ảnh tan đi, một chiếc bùa hổ phách nổi lên.",
        fx: [{ give: { amber_amulet: 1 } }],
        next: "samira3",
      },
      samira3: {
        speaker: "Samira",
        portrait: "samira",
        text: "Bà ấy... đã trở thành một phần của hồ. Bà canh giữ nơi này để những người lạc lối có nước uống.\n\n(Samira lau nước mắt, mỉm cười.) Cảm ơn ngươi, {hero}. Ta đã sẵn sàng đi tiếp. Và ta nghĩ... ta đã hiểu được một lời cầu nguyện mà mẹ từng dạy.",
        fx: [{ learn: "sanctuary", to: "samira" }, { xp: 60 }, { flag: "samira_mother" }],
      },
    },
  },
  {
    id: "f2_zahr",
    title: "Cổng Thành Zahr",
    start: "a",
    scenes: {
      a: {
        text: "Hai bức tượng nhân sư khổng lồ canh giữ một cánh cổng chìm một nửa trong cát. Khi bạn tới gần, mắt chúng sáng rực. Một giọng nói trầm vang lên:\n\n\"Ta nuốt vua chúa và thành trì, bào mòn núi cao thành cát bụi. Ai cũng có ta, nhưng không ai giữ được ta. Ta là gì?\"",
        choices: [
          { text: "\"Cát.\"", next: "wrong" },
          { text: "\"Thời gian.\"", next: "right" },
          { text: "\"Cái chết.\"", next: "death" },
          { text: "(Suy ngẫm thật kỹ...)", check: { attr: "int", dc: 12, pass: "hint", fail: "nohint" } },
        ],
      },
      hint: {
        text: "Vua chúa... thành trì... núi cao... Tất cả đều bị thứ gì đó làm hao mòn. Không phải cát — chính cát cũng do nó tạo ra. Và \"ai cũng có\" nhưng \"không ai giữ được\"...",
        next: "a",
      },
      nohint: { text: "Bạn nghĩ mãi mà vẫn không ra. Nhân sư kiên nhẫn chờ đợi.", next: "a" },
      right: {
        text: "\"Đúng.\"\n\nCánh cổng rung chuyển và mở ra một khe hở. Bên trong là kho báu của vương triều Zahr: những bình hổ phách, vàng, và một cuốn sách cổ bọc da viết về sức mạnh của đất.",
        fx: [{ give: { amber: 4, "tome:earthquake": 1 } }, { gold: 200 }, { xp: 60 }],
      },
      wrong: {
        text: "\"Sai.\"\n\nCát dưới chân bạn sụt xuống, và những xác ướp trỗi dậy.",
        fx: [{ battle: { group: ["mummy", "mummy", "mummy"], win: "after" } }],
      },
      death: {
        text: "\"Gần đúng. Nhưng cái chết chỉ là một phần của ta.\"\n\nNhân sư phun ra một luồng cát nóng bỏng.",
        fx: [{ hurt: 0.25 }],
        next: "a",
      },
      after: {
        text: "Những xác ướp gục xuống. Cánh cổng vẫn đóng im lìm — nhân sư vẫn đang chờ câu trả lời. Bạn nhặt được vài thứ từ đống vải liệm.",
        fx: [{ give: { linen: 3, bone: 2 } }],
        keep: true,
      },
    },
  },
  {
    id: "f2_amber",
    title: "Thung Lũng Hổ Phách",
    start: "a",
    scenes: {
      a: {
        text: "Cả thung lũng là những khối hổ phách khổng lồ. Bên trong chúng: côn trùng, thú vật, và... một cô gái mặc đồng phục học sinh.\n\nMắt cô mở to, miệng như đang hét lên một điều gì đó — đông cứng mãi mãi.",
        choices: [
          { text: "Đập vỡ khối hổ phách để giải thoát cô ấy.", check: { attr: "str", dc: 15, pass: "free", fail: "failfree" } },
          { text: "Đọc tấm thẻ tên trên áo cô ấy.", cond: { notFlag: "elena_name" }, hide: true, next: "name" },
          { text: "Rời đi. Không thể giúp được.", end: true, keep: true },
        ],
      },
      name: {
        text: "Tấm thẻ ghi: \"Elena Voss — Lớp 11A2\".\n\nDưới chân khối hổ phách, có ai đó đã khắc: \"Người thứ 7. Cô ấy đã cố cảnh báo chúng ta.\"",
        fx: [{ flag: "elena_name" }],
        next: "a",
      },
      free: {
        text: "Bạn đập liên tục cho tới khi tay tê dại. Khối hổ phách nứt ra, và Elena đổ gục vào tay bạn. Cô mở mắt — chỉ trong một giây.\n\n\"Mầm... không phải là bạn...\" cô thì thầm. \"Nó là... người thu hoạch...\"\n\nRồi cơ thể cô tan thành bụi vàng, bay lên như những con đom đóm.",
        fx: [{ flag: "elena_warning" }, { xp: 80 }, { give: { amber: 5, mana_crystal: 2 } }],
      },
      failfree: {
        text: "Khối hổ phách cứng hơn đá. Bạn chỉ làm vỡ được vài mảnh nhỏ ở rìa. Có lẽ cần mạnh hơn nữa.",
        fx: [{ give: { amber: 2 } }, { hurt: 0.1 }],
        keep: true,
      },
    },
  },
  {
    id: "f2_graveyard",
    title: "Nghĩa Địa Lữ Hành",
    start: "a",
    scenes: {
      a: {
        text: "Hàng trăm cột mốc bằng xương đánh dấu những ngôi mộ của các đoàn lữ hành. Gió hú qua những hộp sọ tạo thành một giai điệu buồn. Một cây sáo xương cắm trên ngôi mộ lớn nhất.",
        choices: [
          { text: "Lấy cây sáo xương.", next: "take" },
          { text: "Cúi đầu cầu nguyện cho người đã khuất.", check: { attr: "wil", dc: 12, pass: "bless", fail: "quiet" } },
          { text: "Rời đi.", end: true, keep: true },
        ],
      },
      take: {
        text: "Ngay khi bạn rút cây sáo lên, những ngôi mộ nứt toác.",
        fx: [{ battle: { group: ["mummy", "mummy", "vulture"], win: "take2" } }],
      },
      take2: {
        text: "Cây sáo tự cất lên một giai điệu — một khúc ru buồn đến nỗi những xác ướp còn lại nằm xuống, ngủ yên trở lại.",
        fx: [{ give: { "tome:lullaby": 1, bone: 3, linen: 2 } }],
      },
      bless: {
        text: "Gió ngừng hú. Trong khoảnh khắc tĩnh lặng, bạn cảm thấy những bàn tay vô hình vỗ nhẹ lên vai mình.",
        fx: [{ heal: 1 }, { mp: 1 }, { give: { "ptome:p_pure_soul": 1 } }, { xp: 40 }],
      },
      quiet: {
        text: "Không có gì xảy ra. Nhưng lòng bạn nhẹ nhõm hơn.",
        fx: [{ heal: 0.5 }],
      },
    },
  },
  {
    id: "f2_storm",
    title: "Mắt Bão",
    start: "a",
    scenes: {
      a: {
        text: "Một cơn bão cát khổng lồ xoáy tròn quanh một khu vực. Ở trung tâm — mắt bão — bạn thấy thấp thoáng những bộ xương khổng lồ và ánh hổ phách lấp lánh.",
        choices: [
          { text: "Lao qua bão cát.", check: { attr: "agi", dc: 14, pass: "pass", fail: "fail" } },
          { text: "Ngồi chờ bão lặng.", next: "wait" },
          { text: "Quay lại.", end: true, keep: true },
        ],
      },
      pass: {
        text: "Bạn luồn lách giữa những luồng cát và tới được mắt bão. Ở đó, giữa bộ xương của một con sa trùng cổ đại, là cả một mỏ hổ phách.",
        fx: [{ give: { amber: 6, chitin: 4, monster_core: 1 } }, { xp: 50 }],
      },
      fail: {
        text: "Cát cứa vào da như dao. Bạn bị hất văng ra ngoài, mình mẩy đầy vết xước.",
        fx: [{ hurt: 0.3 }],
        keep: true,
      },
      wait: {
        text: "Bạn ngồi đợi... và đợi. Cơn bão không có dấu hiệu dừng lại, nhưng một đàn kền kền đã phát hiện ra bạn.",
        fx: [{ battle: { group: ["vulture", "vulture", "vulture"], win: "after" } }],
      },
      after: { text: "Bạn đuổi được lũ kền kền. Cơn bão vẫn còn đó, gầm gừ.", keep: true },
    },
  },
  {
    id: "f2_guardian",
    title: "Sa Trùng Vương",
    start: "route",
    portrait: "wyrm",
    scenes: {
      route: { text: "", route: [{ cond: { flag: "f2_cleared" }, to: "done" }, { to: "a" }] },
      a: {
        text: "Cồn cát trước mặt bạn không phải cồn cát. Nó đang thở.\n\nKhi bạn bước lên, cả sa mạc rung chuyển, và một cái miệng khổng lồ với hàng ngàn chiếc răng hổ phách trồi lên từ lòng đất. Trên đỉnh đầu con sa trùng, một chiếc Gai Đen cắm sâu, rỉ nhựa đen.",
        portrait: "wyrm",
        next: "b",
      },
      b: {
        text: "Tiếng hát bạn nghe thấy từ khi đặt chân xuống tầng này — đó là tiếng của chiếc gai. Và bây giờ, nó hát rất gần. Rất to. Chiếc gai trong túi bạn đập mạnh như đang đáp lời.",
        choices: [
          { text: "Samira, dùng Ngọn Lửa Trắng!", cond: { party: "samira" }, next: "samira" },
          { text: "Đứng vững, đối mặt với nó!", check: { attr: "wil", dc: 15, pass: "brave", fail: "fight" } },
          { text: "Chiến đấu!", next: "fight" },
        ],
      },
      samira: {
        speaker: "Samira",
        portrait: "samira",
        text: "Ngọn Lửa Trắng, soi rõ tội lỗi!\n\n(Ánh sáng trắng rọi vào những vết nứt trên lớp vỏ con sa trùng. Nó gào lên đau đớn.)",
        fx: [{ battle: { win: "win", noFlee: true, enemyFx: [{ s: "vulnerable", t: 3 }, { s: "armorBreak", t: 2 }] } }],
      },
      brave: {
        text: "Bạn đứng yên trong khi cát cuộn quanh chân. Con sa trùng khựng lại — lần đầu tiên sau hàng thế kỷ, có kẻ không bỏ chạy trước nó.",
        fx: [{ battle: { win: "win", noFlee: true, enemyFx: [{ s: "slow", t: 2 }, { s: "weaken", t: 2 }] } }],
      },
      fight: {
        text: "Con sa trùng lao tới!",
        fx: [{ battle: { win: "win", noFlee: true } }],
      },
      win: {
        text: "Sa Trùng Vương đổ sập xuống, cát tràn vào miệng nó như nước. Bạn trèo lên đầu nó và rút chiếc Gai Đen. Tiếng hát tắt lịm.\n\nChiếc gai thứ hai. Khi bạn đặt nó cạnh chiếc thứ nhất trong túi, cả hai khẽ rung lên — như đang nhận ra nhau.",
        fx: [{ give: { black_thorn: 1 } }, { clearFloor: true }, { xp: 150 }],
        next: "stairs",
      },
      stairs: {
        text: "Giữa những đụn cát, một cầu thang đá dẫn xuống tầng 3 hiện ra. Từ bên dưới vọng lên tiếng nước chảy... và tiếng chuông.",
      },
      done: { text: "Xác Sa Trùng Vương đã bị cát vùi gần hết. Cầu thang xuống tầng dưới ở ngay gần đây.", keep: true },
    },
  },
];
