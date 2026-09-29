import type { StoryEvent } from "./types";

export const FLOOR3: StoryEvent[] = [
  {
    id: "f3_ferry",
    title: "Bến Đò Không Người",
    start: "a",
    scenes: {
      a: {
        text: "Một chiếc thuyền gỗ mục neo bên bến. Trên thuyền, một bóng người mặc áo giáp rỉ sét đứng bất động, tay cầm sào. Khuôn mặt dưới mũ giáp chỉ là bóng tối với hai đốm sáng xanh.",
        next: "b",
      },
      b: {
        speaker: "Người Lái Đò",
        portrait: "drowned",
        text: "Qua sông... năm mươi đồng vàng... hoặc... một ký ức.",
        choices: [
          { text: "Trả 50 vàng.", cond: { gold: 50 }, fx: [{ gold: -50 }], next: "ride" },
          { text: "Trả bằng một ký ức.", next: "memory" },
          { text: "Ngài là ai?", cond: { notFlag: "aldric" }, hide: true, check: { attr: "wil", dc: 14, pass: "truth", fail: "silence" } },
          { text: "Không cần.", end: true, keep: true },
        ],
      },
      memory: {
        text: "Người lái đò đặt bàn tay lạnh ngắt lên trán bạn. Một thoáng choáng váng.\n\nBạn không còn nhớ nổi khuôn mặt của người bạn thân nhất thời thơ ấu. Chỉ còn lại cảm giác rằng đã từng có một người như thế.",
        fx: [{ flag: "memory_given" }],
        next: "ride",
      },
      ride: {
        text: "Chiếc thuyền trôi đi không một tiếng động. Dưới làn nước trong vắt, bạn thấy những mái nhà, những con phố, những ngọn tháp — cả một thành phố chìm.\n\nNgười lái đò đưa bạn tới một hòn đảo nhỏ, nơi chất đầy những chiếc rương của người chết.",
        fx: [{ give: { pearl: 1, bog_iron: 3, soul_wax: 2 } }, { gold: 80 }, { xp: 40 }],
      },
      truth: {
        speaker: "Người Lái Đò",
        portrait: "drowned",
        text: "...Ta từng là Hiệp sĩ Aldric, cận vệ của Nữ Hoàng Ysolde.\n\nKhi người dìm vương quốc xuống nước để giam giữ chiếc Gai, ta đã tình nguyện ở lại... để chở những linh hồn lạc lối. Nếu ngươi gặp người... hãy nói rằng Aldric vẫn đang đợi.",
        fx: [{ flag: "aldric" }, { give: { "ptome:p_steadfast": 1 } }, { xp: 50 }],
        next: "b",
      },
      silence: { text: "Bóng người không trả lời. Hai đốm sáng xanh nhìn bạn chằm chằm.", next: "b" },
    },
  },
  {
    id: "f3_morwen",
    title: "Túp Lều Trên Lưng Rùa",
    start: "a",
    portrait: "morwen",
    scenes: {
      a: {
        text: "Một túp lều dựng trên lưng một con rùa đầm lầy khổng lồ đang ngủ. Khói xanh bốc lên từ ống khói. Cửa mở ra trước khi bạn kịp gõ.",
        next: "b",
      },
      b: {
        speaker: "Phù thủy",
        portrait: "morwen",
        text: "Vào đi, người chuyển sinh. Ta đã thấy ngươi trong nồi súp từ ba ngày trước. Ngồi xuống. Đừng chạm vào cái lọ màu tím.",
        next: "c",
      },
      c: {
        speaker: "Morwen",
        portrait: "morwen",
        text: "Ta là Morwen. Bọn người ếch gọi ta là \"Morwen Đèn Lồng\", vì ta nói chuyện được với những linh hồn trong đèn.\n\nTa cần một người đủ mạnh để đưa ta tới Cung Điện Ngập Nước. Nữ hoàng ở đó... là chị gái ta.",
        choices: [
          { text: "Chị gái cô? Nữ Hoàng Ysolde?", next: "sister" },
          { text: "Tôi sẽ giúp. Đổi lại cô có gì?", next: "deal" },
        ],
      },
      deal: {
        speaker: "Morwen",
        portrait: "morwen",
        text: "Ha! Thực dụng. Ta thích. Ta có độc dược, lời nguyền, và kiến thức về mọi thứ đã chết trong đầm lầy này. Đủ chưa?",
        next: "sister",
      },
      sister: {
        speaker: "Morwen",
        portrait: "morwen",
        text: "Ysolde đã dìm cả vương quốc Lyss để giam chiếc Gai Đen dưới nước. Nó đã có tác dụng — suốt ba trăm năm.\n\nNhưng chiếc gai đã thì thầm với chị ấy lâu tới mức... chị ấy không còn là chị ấy nữa. Ta cần tiễn chị ấy đi. Và ta không đủ can đảm để làm điều đó một mình.",
        next: "q",
      },
      q: {
        speaker: "Morwen",
        portrait: "morwen",
        text: "Nhưng trước khi ta đi cùng ngươi, hãy trả lời ta: ngươi định làm gì với những chiếc Gai Đen?",
        choices: [
          { text: "Thu thập chúng. Tôi cần về nhà.", fx: [{ recruit: "morwen" }, { flag: "thorn_intent", v: "collect" }], next: "honest" },
          { text: "Phá huỷ chúng, nếu có thể.", fx: [{ recruit: "morwen" }, { flag: "thorn_intent", v: "destroy" }], next: "destroy" },
          { text: "Tôi... không biết.", fx: [{ recruit: "morwen" }, { flag: "thorn_intent", v: "unsure" }], next: "unsure" },
        ],
      },
      honest: {
        speaker: "Morwen",
        portrait: "morwen",
        text: "Thành thật. Ngu ngốc, nhưng thành thật. Được, ta sẽ đi cùng — nếu chỉ để ngăn ngươi làm điều ngu ngốc nhất.",
        next: "end",
      },
      destroy: {
        speaker: "Morwen",
        portrait: "morwen",
        text: "Nhiều người đã nói vậy. Kaito cũng đã nói vậy. Để xem ngươi giữ lời được bao lâu.",
        next: "end",
      },
      unsure: {
        speaker: "Morwen",
        portrait: "morwen",
        text: "Câu trả lời khôn ngoan nhất ta nghe được trong trăm năm. Đi thôi.",
        next: "end",
      },
      end: {
        text: "Morwen Đèn Lồng đã gia nhập! Cô ta nhét vào túi bạn vài lọ thuốc \"để phòng hờ\" — và một lọ màu tím mà bạn quyết định sẽ không bao giờ mở.",
        fx: [{ give: { antidote: 2, potion_mp: 2 } }],
      },
    },
  },
  {
    id: "f3_frogs",
    title: "Làng Người Ếch",
    start: "route",
    portrait: "frogman",
    scenes: {
      route: { text: "", route: [{ cond: { flag: "frogs_done" }, to: "market" }, { to: "a" }] },
      a: {
        text: "Những ngôi nhà sàn nối với nhau bằng cầu lá sen. Người ếch với đôi mắt vàng to tròn giương giáo nhìn bạn. Một người ếch già đội vương miện rêu bước ra.",
        portrait: "frogman",
        next: "b",
      },
      b: {
        speaker: "Tù Trưởng Ộp",
        portrait: "frogman",
        text: "Người lạ! Ộp! Lũ Đỉa Khổng Lồ đã bắt đi những đứa con nòng nọc của chúng ta! Ộp! Nếu ngươi mang chúng về, người ếch sẽ là bạn của ngươi mãi mãi! Ộp ộp!",
        choices: [
          { text: "Tôi sẽ đi cứu lũ trẻ.", next: "hunt" },
          { text: "Trả công thế nào?", next: "pay" },
          { text: "Không phải việc của tôi.", end: true, keep: true },
        ],
      },
      pay: {
        speaker: "Tù Trưởng Ộp",
        portrait: "frogman",
        text: "Ộp! Ngọc trai! Sắt đầm lầy! Và hạt sen ma — thứ hạt chỉ mọc ở nơi có nước mắt! Ộp!",
        next: "b",
      },
      hunt: {
        text: "Bạn lần theo vệt nhớt tới một hang bùn. Bên trong, những con đỉa khổng lồ và một con cua giáp sắt đang canh giữ một cái lồng lá đầy nòng nọc.",
        fx: [{ battle: { group: ["leech", "bog_crab", "leech"], win: "win" } }],
      },
      win: {
        speaker: "Tù Trưởng Ộp",
        portrait: "frogman",
        text: "(Hàng chục con nòng nọc nhảy tõm xuống nước, bơi về làng. Tiếng ộp ộp vang lên khắp đầm lầy như một bản hợp xướng.)\n\nỘp! Ân nhân! Nhận lấy những thứ này! Và từ nay chợ của người ếch luôn mở cửa với ngươi! Ộp!",
        fx: [{ give: { pearl: 2, bog_iron: 4, seed_lotus: 2 } }, { gold: 120 }, { xp: 80 }, { flag: "frogs_done" }],
        keep: true,
      },
      market: {
        text: "Người ếch ộp ộp chào đón bạn. Tù Trưởng Ộp mở chợ bên bờ lá sen.",
        choices: [
          { text: "Mua 2 Bom Sấm — 100 vàng", cond: { gold: 100 }, fx: [{ gold: -100 }, { give: { thunder_bomb: 2 } }], next: "market" },
          { text: "Mua 3 Sắt Đầm Lầy — 60 vàng", cond: { gold: 60 }, fx: [{ gold: -60 }, { give: { bog_iron: 3 } }], next: "market" },
          { text: "Mua 2 Hạt Sen Ma — 80 vàng", cond: { gold: 80 }, fx: [{ gold: -80 }, { give: { seed_lotus: 2 } }], next: "market" },
          { text: "Mua 2 Bình Nước Thánh — 30 vàng", cond: { gold: 30 }, fx: [{ gold: -30 }, { give: { water_flask: 2 } }], next: "market" },
          { text: "Tạm biệt. Ộp!", end: true, keep: true },
        ],
      },
    },
  },
  {
    id: "f3_bell",
    title: "Tháp Chuông Chìm",
    start: "a",
    scenes: {
      a: {
        text: "Một tháp chuông nghiêng ngả nhô lên khỏi mặt nước, chiếc chuông đồng khổng lồ phủ đầy rêu. Trên thành chuông khắc một dòng chữ cổ.",
        choices: [
          { text: "Đọc dòng chữ.", cond: { notFlag: "bell_read" }, hide: true, check: { attr: "int", dc: 14, pass: "read", fail: "noread" } },
          { text: "Rung chuông.", check: { attr: "str", dc: 13, pass: "ring", fail: "ringfail" } },
          { text: "Rời đi.", end: true, keep: true },
        ],
      },
      read: {
        text: "\"Khi chuông ngân lần cuối, Lyss sẽ chìm để thế giới được nổi. — Ysolde, Nữ hoàng cuối cùng.\"\n\nBên dưới, một dòng chữ nhỏ hơn, nguệch ngoạc như viết vội: \"Em xin lỗi, Morwen.\"",
        fx: [{ flag: "bell_read" }, { xp: 40 }],
        next: "a",
      },
      noread: { text: "Chữ cổ quá, bạn chỉ đọc được vài từ: \"chuông\", \"chìm\", \"thế giới\"...", next: "a" },
      ring: {
        text: "BOONG...\n\nÂm thanh lan khắp đầm lầy. Mặt nước rung lên, và những xác chết trôi nổi lên — nhưng chúng không tấn công. Chúng quay mặt về phía Cung Điện Ngập Nước, như đang chỉ đường cho bạn.",
        fx: [{ flag: "bell_rung" }, { give: { soul_wax: 3 } }, { xp: 50 }],
      },
      ringfail: {
        text: "Chiếc chuông kêu một tiếng méo mó, và những xác chết trôi nổi lên — đầy giận dữ.",
        fx: [{ battle: { group: ["drowned", "drowned", "lantern_ghost"], win: "after" } }],
      },
      after: { text: "Bạn đánh bại lũ xác chết. Chiếc chuông vẫn còn đó, lặng lẽ chờ đợi.", keep: true },
    },
  },
  {
    id: "f3_lanterns",
    title: "Hồ Đèn Lồng",
    start: "a",
    scenes: {
      a: {
        text: "Hàng vạn chiếc đèn lồng lơ lửng trên mặt hồ, mỗi chiếc chứa một đốm lửa nhỏ run rẩy. Khi bạn tới gần, bạn nghe thấy chúng — hàng vạn giọng nói thì thầm cùng lúc:\n\n\"Lạnh quá... cho tôi về nhà...\"",
        choices: [
          { text: "Thắp 3 Sáp Linh Hồn để giải thoát họ.", cond: { has: "soul_wax", n: 3 }, fx: [{ take: { soul_wax: 3 } }], next: "free" },
          { text: "Morwen, cô có thể nói chuyện với họ không?", cond: { all: [{ party: "morwen" }, { notFlag: "lantern_hint" }] }, next: "morwen" },
          { text: "Cạy lấy sáp từ những chiếc đèn.", next: "steal" },
          { text: "Rời đi.", end: true, keep: true },
        ],
      },
      free: {
        text: "Bạn thắp sáp linh hồn thành một ngọn nến lớn giữa hồ. Từng chiếc đèn lồng một vỡ ra, và những đốm lửa bay lên, tan vào lớp sương mù phía trên.\n\nMột vài đốm lửa lượn vòng quanh bạn trước khi biến mất, như để nói lời cảm ơn. Một trong số chúng để lại một cuốn sách nhỏ trong lòng bàn tay bạn.",
        fx: [{ give: { "tome:resurrection": 1 } }, { xp: 100 }, { flag: "souls_freed" }],
      },
      morwen: {
        speaker: "Morwen",
        portrait: "morwen",
        text: "(Morwen nhắm mắt, lẩm bẩm một câu thần chú. Những ngọn lửa trong đèn quay về phía cô.)\n\nHọ nói... nữ hoàng đang khóc. Mỗi đêm. Họ nói, nếu chúng ta tới, hãy nhắc cho chị ấy nhớ rằng vẫn còn người đang đợi chị ấy.",
        fx: [{ flag: "lantern_hint" }, { give: { soul_wax: 2 } }, { xp: 40 }],
        next: "a",
      },
      steal: {
        text: "Bạn cạy những chiếc đèn, gom lấy lớp sáp. Mỗi chiếc đèn bị lấy sáp, một giọng nói im bặt. Mãi mãi.",
        fx: [{ give: { soul_wax: 6 } }, { flag: "souls_stolen" }],
        next: "steal2",
      },
      steal2: {
        text: "Khi bạn quay đi, những chiếc đèn còn lại đồng loạt quay về phía bạn — và bùng lên đỏ rực.",
        fx: [{ battle: { group: ["lantern_ghost", "lantern_ghost", "wisp"], win: "steal3" } }],
      },
      steal3: { text: "Những hồn ma tan biến. Mặt hồ giờ tối hơn một chút." },
    },
  },
  {
    id: "f3_kaito",
    title: "Người Thứ Nhất",
    start: "a",
    portrait: "kaito",
    scenes: {
      a: {
        text: "Trên một hòn đảo nhỏ giữa khu cung điện ngập nước, một người đàn ông ngồi quay lưng lại, mặc chiếc áo khoác đồng phục học sinh đã bạc màu. Nửa người anh đã hoá thành gỗ, những chiếc rễ mọc ra từ lưng cắm sâu xuống đất.",
        next: "b",
      },
      b: {
        speaker: "Người đàn ông",
        portrait: "kaito",
        text: "...Cậu đến rồi. Người thứ bốn mươi bảy.",
        next: "c",
      },
      c: {
        speaker: "Kaito",
        portrait: "kaito",
        text: "Tôi là Kaito. Người đầu tiên. Hoặc ít nhất là người đầu tiên còn nhớ tên mình. Tôi đã nghe thấy cậu từ tầng 1 — qua những cái cây.",
        choices: [
          { text: "Anh đã cắm chiếc gai vào Rễ Mẹ. Tại sao?", next: "why" },
          { text: "Mầm là gì? Elena nói nó là \"người thu hoạch\".", cond: { flag: "elena_warning" }, next: "sprout" },
          { text: "Làm sao để về nhà?", next: "home" },
        ],
      },
      why: {
        speaker: "Kaito",
        portrait: "kaito",
        text: "Vì tôi ngu. Tôi nghĩ nếu cắm những chiếc gai trở lại, Vực Sâu sẽ ngủ yên.\n\nNhưng những chiếc gai không phải là ổ khoá. Chúng là hạt giống. Và thứ gì đó ở tầng 100 đang chờ chúng nảy mầm.",
        next: "end",
      },
      sprout: {
        speaker: "Kaito",
        portrait: "kaito",
        text: "Mầm... là một nửa của Nữ Thần. Nửa tốt, tôi từng nghĩ vậy. Nó cho chúng ta chỗ trú, cho chúng ta sức mạnh.\n\nVà mỗi khi một người chuyển sinh chết, nó lớn thêm một chút.\n\nTôi không biết nó có ý thức được điều đó không. Tôi không biết điều nào tệ hơn.",
        fx: [{ flag: "sprout_truth" }],
        next: "end",
      },
      home: {
        speaker: "Kaito",
        portrait: "kaito",
        text: "Về nhà? (Anh cười, tiếng cười khô khốc như gỗ nứt.) Cậu nghĩ chúng ta còn cơ thể ở thế giới cũ sao?\n\nĐiều ước ở tầng 100 là thật. Nhưng cái giá... không ai biết cái giá là gì. Kể cả tôi.",
        next: "end",
      },
      end: {
        speaker: "Kaito",
        portrait: "kaito",
        text: "Thời gian của tôi hết rồi. Rễ đã chạm tới tim. Cầm lấy những thứ này — tôi đã giữ chúng đủ lâu.\n\nVà, {hero}... khi tới tầng 4, hãy tìm một người tên là Hana. Cô ấy biết nhiều hơn tôi.",
        fx: [{ give: { "tome:overload": 1, "ptome:p_catalyst": 1 } }, { xp: 120 }, { flag: "kaito_met" }],
        next: "final",
      },
      final: {
        text: "Người đàn ông nhắm mắt. Những chiếc rễ khép lại quanh anh, và khi bạn chớp mắt, chỉ còn một cây non nhỏ xíu đứng đó, lá khẽ run trong gió.",
      },
    },
  },
  {
    id: "f3_guardian",
    title: "Nữ Hoàng Chết Đuối",
    start: "route",
    portrait: "queen",
    scenes: {
      route: { text: "", route: [{ cond: { flag: "f3_cleared" }, to: "done" }, { to: "a" }] },
      a: {
        text: "Cung điện ngập nước chìm trong ánh sáng xanh lạnh lẽo. Trên chiếc ngai san hô, một người phụ nữ ngồi bất động, tóc xoã trôi lơ lửng như rong biển, vương miện ngọc trai đen trên đầu.\n\nChiếc Gai Đen cắm xuyên qua ngực bà.",
        portrait: "queen",
        next: "b",
      },
      b: {
        speaker: "Nữ Hoàng Ysolde",
        portrait: "queen",
        text: "Lại một kẻ nữa... đến để lấy nó. Tất cả các ngươi. Tất cả các ngươi đều muốn nó.",
        choices: [
          { text: "Morwen, cô có muốn nói gì với chị mình không?", cond: { party: "morwen" }, next: "morwen" },
          { text: "Hiệp sĩ Aldric vẫn đang đợi người.", cond: { flag: "aldric" }, next: "aldric" },
          { text: "Tôi đến để giải thoát cho người.", next: "fight" },
        ],
      },
      morwen: {
        speaker: "Morwen",
        portrait: "morwen",
        text: "Chị Ysolde. Là em đây. Morwen.\n\n— Morwen? Em gái bé nhỏ... Em đã lớn quá rồi.\n\n— Chị đã làm đủ rồi. Để bọn em lấy nó đi. Chị có thể nghỉ ngơi.\n\n— Chị không thể... nó không cho chị... CHẠY ĐI, MORWEN!",
        fx: [{ battle: { win: "winm", noFlee: true, enemyFx: [{ s: "weaken", t: 3 }, { s: "curse", t: 3 }] } }],
      },
      aldric: {
        text: "Nữ hoàng khựng lại. \"Aldric... người hiệp sĩ ngốc nghếch của ta... vẫn còn chở thuyền sao?\"\n\nTrong một khoảnh khắc, mắt bà trong trẻo. Rồi chiếc gai lại đập, và bà gào lên.",
        fx: [{ battle: { win: "win", noFlee: true, enemyFx: [{ s: "slow", t: 2 }, { s: "vulnerable", t: 2 }] } }],
      },
      fight: {
        text: "Nước quanh ngai vàng dựng lên thành những bức tường sóng.",
        fx: [{ battle: { win: "win", noFlee: true } }],
      },
      win: {
        text: "Nữ hoàng ngã xuống ngai. Bạn rút chiếc Gai Đen ra khỏi ngực bà. Nước trong cung điện bắt đầu rút đi, và lần đầu tiên sau ba trăm năm, những ngọn đèn lồng trên mặt hồ lần lượt tắt — thanh thản.\n\n\"Cảm ơn...\" bà thì thầm. \"Hãy cẩn thận... chúng đã có ba cái rồi...\"",
        fx: [{ give: { black_thorn: 1, drowned_crown: 1 } }, { clearFloor: true }, { xp: 200 }],
        next: "end",
      },
      winm: {
        text: "Nữ hoàng ngã xuống ngai. Morwen chạy tới, ôm lấy chị mình trong khi bạn rút chiếc Gai Đen ra.\n\nYsolde mỉm cười với em gái lần cuối, rồi tan thành bọt nước. Morwen đứng im rất lâu.\n\n\"Đi thôi,\" cô nói, giọng khàn đặc. \"Chị ấy sẽ không muốn chúng ta khóc.\"",
        fx: [{ give: { black_thorn: 1, drowned_crown: 1 } }, { clearFloor: true }, { xp: 200 }, { learn: "maelstrom", to: "morwen" }],
        next: "end",
      },
      end: {
        text: "Ba chiếc Gai Đen nằm trong túi bạn, đập cùng một nhịp.\n\nCầu thang xuống tầng 4 đã mở.\n\n— Hết Chương 1: Ba Chiếc Gai —\n\n(Các tầng từ 4 trở đi đã có bản đồ, quái vật, trùm và sự kiện ngẫu nhiên. Cốt truyện riêng của từng tầng sẽ được viết trong các bản cập nhật tiếp theo.)",
      },
      done: { text: "Ngai vàng giờ trống trơn. Nước đã rút, để lộ những bậc thang dẫn xuống sâu hơn.", keep: true },
    },
  },
];
