import type { Cond, Effect, StoryEvent } from "./types";

/**
 * The bottom of the Abyss. The gatekeeper of floor 100 is the Gardener's Heart; what happens
 * after depends on what the player chose, kept and learned on the way down.
 */

const G = "Người Làm Vườn";
const done = (id: string): Effect[] => [{ flag: `ending_${id}` }, { flag: "game_complete" }, { xpF: 30 }];

/** Enough of her story gathered to reach her, not just fight her. */
const REUNITE: Cond = {
  all: [
    { flag: "knows_iris" },
    { flag: "mam_with_you" },
    { any: [{ flag: "learned_lullaby" }, { flag: "freed_lullaby" }] },
    { any: [{ flag: "hana_free" }, { flag: "arc_60" }] },
  ],
};
/** The hidden ending: Kaito's seed, and a sanctuary big enough to take in every world. */
const SECRET: Cond = { all: [REUNITE, { has: "kaito_seed" }, { rank: 6 }] };

export const FINALE: StoryEvent = {
  id: "guard100", title: "Trái Tim Vực Sâu", start: "route", portrait: "sprout",
  scenes: {
    route: { text: "", route: [{ cond: { flag: "f100_cleared" }, to: "over" }, { to: "a" }] },
    a: {
      text: `Người phụ nữ ngẩng lên. Mái tóc bà dài chạm đất, đan đầy những bông hoa ép. Khuôn mặt bà — nếu bạn nhìn kỹ — vẫn còn nụ cười hơi lệch về bên trái của bức tượng ở tầng 78, chỉ là đã rất, rất mệt.\n\n"Người thứ bốn mươi bảy," bà nói. Giọng bà là giọng bạn đã nghe trong hư không, trong vách thịt, trong những lời mời gọi dịu dàng. "Ngươi đi xa hơn tất cả. Ta đã nhìn ngươi từ tầng một."`,
      speaker: G,
      next: "b",
    },
    b: {
      text: `"Ta biết ngươi muốn gì. Ngươi nhớ nhà. Ngươi nhớ bát canh, nhớ tiếng quạt trần, nhớ khuôn mặt mẹ ngươi. Ta có thể cho ngươi về — không phải một ảo ảnh, mà thật sự. Mãi mãi. Chỉ cần ngươi nói: 'Tôi ước.'"\n\nTrái Tim sau lưng bà đập mạnh hơn. Mỗi nhịp, những chiếc rễ trên đầu rung lên, và bạn cảm thấy — xa lắm, ở tầng trên cùng — Trái Đất bị ép thêm một chút.`,
      speaker: G,
      choices: [
        { text: "\"Tôi ước được về nhà.\"", next: "accept" },
        { text: "\"Tôi tới đây để dừng bà lại.\"", next: "fight" },
        { text: "Để Mầm bước ra.", cond: { flag: "mam_with_you" }, next: "mam" },
      ],
    },
    mam: {
      text: `Mầm bước ra từ sau lưng bạn, hai chiếc lá run rẩy.\n\nNgười Làm Vườn đứng bật dậy. Lần đầu tiên, khuôn mặt bà có một biểu cảm khác ngoài mệt mỏi — sợ hãi.\n\n"Không," bà thì thầm. "Ta đã ném ngươi đi rồi. Ta đã dựng hàng rào rồi. Ngươi không được quay lại. Nếu ngươi quay lại, ta sẽ phải — ta sẽ phải —"\n\nTrái Tim gầm lên. Những chiếc rễ quất xuống như roi. Nó không đợi bà nói hết câu. Nó không cần bà nữa.`,
      speaker: G,
      choices: [{ text: "Chắn trước Mầm!", fx: [{ battle: { win: "win", noFlee: true, enemyFx: [{ s: "weaken", t: 3 }] } }] }],
    },
    fight: {
      text: `Người Làm Vườn nhìn bạn rất lâu. "Tất cả đều nói vậy lúc đầu," bà nói, rồi ngồi xuống lại, ôm gối, quay mặt đi.\n\nTrái Tim sau lưng bà nứt ra, mở rộng, và những chiếc gai đen từ trong đó trồi lên, hướng về phía bạn.`,
      speaker: G,
      choices: [{ text: "Chiến đấu!", fx: [{ battle: { win: "win", noFlee: true } }] }],
    },
    win: {
      text: `Trái Tim khuỵu xuống, nhịp đập chậm lại, rời rạc. Từ lõi của nó, bạn thấy chiếc gai đầu tiên — nhỏ xíu, mềm như cỏ — vẫn đang cắm vào một bông hoa đã héo khô.\n\nNgười Làm Vườn ôm lấy Trái Tim đang hấp hối như ôm một đứa trẻ. "Đừng," bà nói. "Làm ơn. Nếu nó ngừng đập, tất cả sẽ tiếp tục. Tất cả sẽ kết thúc. Ta sẽ mất tất cả."\n\nMọi thứ giờ nằm trong tay bạn.`,
      speaker: G,
      fx: [{ give: { black_thorn: 1 } }, { clearFloor: true }, { flag: "mem_100" }, { xpF: 20 }, { goldF: 120 }],
      next: "choose",
    },
    choose: {
      text: `Trái Tim đập yếu ớt. Những chiếc rễ trên đầu lặng im, chờ đợi. Tám tỉ người trên Trái Đất vẫn đang đứng yên, giữa một nhịp thở.`,
      choices: [
        { text: "Phá vỡ Trái Tim.", next: "shatter" },
        { text: "Hát bài hát ru của Iris, và gọi tên bà ấy.", cond: REUNITE, next: "reunite" },
        { text: "Trồng hạt giống của Kaito vào lòng đất Hortus.", cond: SECRET, hide: true, next: "secret" },
        { text: "\"...Tôi ước được về nhà.\"", next: "accept" },
      ],
    },

    // ------------------------------------------------ ending: accept (the trap)
    accept: {
      text: `Người Làm Vườn mỉm cười, và nụ cười ấy buồn tới mức bạn muốn rút lại lời vừa nói. Nhưng đã muộn.\n\n"Được," bà nói. "Ta sẽ giữ ngươi. Ta sẽ giữ tất cả."`,
      speaker: G,
      next: "accept2",
    },
    accept2: {
      text: `Bạn đang ngồi ở bàn ăn. Quạt trần kêu cọt kẹt. Mẹ gắp cho bạn miếng cá ngon nhất. Ba càu nhàu về giá xăng. Ngoài cửa sổ, trời đang mưa.\n\nThật ấm áp. Thật đầy đủ. Bạn cười.\n\nBạn cười. Bạn cười. Bạn cười.\n\nMiếng cá không bao giờ tới miệng. Mưa không bao giờ tạnh. Mẹ không bao giờ đặt đũa xuống.`,
      next: "accept3",
    },
    accept3: {
      text: `Ở tầng cuối cùng của Vực Sâu, một tấm bia đá khắc thêm một dòng:\n\n"Mẫu vật 101: Trái Đất — hoàn tất."\n\nVà ở Thánh Địa, rất xa phía trên, Mầm ngồi một mình bên đền thờ, hai chiếc lá cụp xuống, chờ một người sẽ không bao giờ quay về.\n\n— KẾT THÚC: TRANG SÁCH CUỐI —\n\n(Có những kết thúc khác. Bạn vẫn có thể tiếp tục ở Thánh Địa và Vực Sâu.)`,
      fx: [...done("accept"), { clearFloor: true }],
    },

    // ------------------------------------------------ ending: shatter
    shatter: {
      text: `Bạn giơ vũ khí lên. Người Làm Vườn không ngăn bạn. Bà chỉ nhắm mắt lại, ôm chặt hơn.\n\nTrái Tim vỡ tan như thuỷ tinh.\n\nVà khắp Vực Sâu, một trăm tầng cùng lúc, những chiếc gai đen rơi xuống.`,
      next: "shatter2",
    },
    shatter2: {
      text: `Ở tầng 10, bé gái chạm đất và lao vào vòng tay cha. Ở tầng 29, dàn hợp xướng hát nốt nhạc thứ một nghìn. Ở tầng 45, pháo hoa tàn, và người Aetheria vỗ tay tiễn nó. Ở tầng 41, cơn mưa cuối cùng cũng được rơi.\n\nMọi thế giới đi nốt con đường của mình. Nhiều thế giới kết thúc. Nhưng chúng kết thúc bằng một lời tạm biệt, không phải bằng sự im lặng.\n\nTrên Trái Đất, tám tỉ người thở ra cùng một lúc — và không ai biết mình vừa bị giữ lại.`,
      next: "shatter3",
    },
    shatter3: {
      text: `Người Làm Vườn tan dần như sương, vẫn trong tư thế ôm lấy thứ đã vỡ. Câu cuối cùng của bà là một lời thì thầm, không dành cho bạn: "Mẹ ơi, con xin lỗi."\n\nỞ một bệnh viện nhỏ, giường số 7, một cô bé tóc hai bím mở mắt, và hỏi mẹ: "Anh cầm ô đâu rồi hả mẹ?"\n\nKhông ai trả lời được. Còn bạn — bạn ở lại Vực Sâu, nơi giờ đây thời gian đã trôi, và mùa đông đầu tiên sau một triệu năm đang về.\n\n— KẾT THÚC: MÙA ĐÔNG —\n\n(Có những kết thúc khác. Bạn vẫn có thể tiếp tục ở Thánh Địa và Vực Sâu.)`,
      fx: done("shatter"),
    },

    // ------------------------------------------------ ending: reunite
    reunite: {
      text: `Bạn không giơ vũ khí. Bạn quỳ xuống cạnh bà, và bắt đầu hát — lạc điệu, vụng về — bài hát bạn học được trong chiếc lồng không cửa:\n\n"Ngủ đi con, lá rụng rồi,\nLá rụng để cây được nghỉ ngơi..."\n\nNgười Làm Vườn cứng đờ.\n\n"...Cây nghỉ để xuân về lại,\nCon ngủ để mai lớn khôn."\n\n"Iris," bạn nói. "Mẹ của bà tên là Iris."`,
      next: "reunite2",
    },
    reunite2: {
      text: `Bà bật khóc — không phải những giọt nước mắt im lặng của một triệu năm, mà là tiếng khóc to, nức nở, của một cô bé bảy tuổi.\n\nMầm bước tới, đặt bàn tay nhỏ xíu lên ngực bà, đúng chỗ vết lõm hình trái tim. "Con về rồi," Mầm nói. "Con chưa bao giờ muốn đi đâu cả."\n\nVà Mầm tan vào bà, như một hạt giống chìm vào đất ấm.`,
      next: "reunite3",
    },
    reunite3: {
      text: `Người Làm Vườn đứng dậy. Bà không còn mệt. Bà nhìn lên những chiếc rễ, những tầng, những thế giới, như lần đầu tiên nhìn thấy chúng.\n\n"Ta sẽ trả lại," bà nói. "Từng cái một. Chậm rãi. Để mỗi thế giới kịp nói lời tạm biệt."\n\nBà rút chiếc gai đầu tiên ra khỏi bông hoa khô — và bông hoa, cuối cùng, được rụng.`,
      next: "reunite4",
    },
    reunite4: {
      text: `Trên Trái Đất, dòng sông linh hồn chảy ngược lên. Những người dưới băng ở tầng 61 mở mắt. Bà bán phở múc xong bát nước dùng. Tiếng trống trường vang nốt nửa còn lại.\n\nỞ giường số 7, Lan tỉnh dậy. Và ở giường số 8 bên cạnh — một chiếc giường mà suốt cả hành trình bạn chưa từng để ý — có một người băng kín đầu, tay còn nắm chặt cán một chiếc ô gãy, khẽ cử động ngón tay.\n\n"Anh cầm ô!" Lan hét lên. "Mẹ ơi, anh cầm ô tỉnh rồi!"\n\n— KẾT THÚC: ĐOÀN TỤ —\n\n(Hana gửi lời: cô sẽ ở lại thêm một thời gian, giúp bà ấy đếm những ngôi sao được trả về bầu trời. Bạn vẫn có thể tiếp tục ở Thánh Địa và Vực Sâu.)`,
      fx: done("reunite"),
    },

    // ------------------------------------------------ ending: secret
    secret: {
      text: `Bạn lấy hạt giống của Kaito ra. Vỏ nó đã nứt toác, mầm trắng vươn dài, run rẩy, háo hức.\n\n"Anh ấy bảo tới đáy rồi hãy trồng," bạn nói với Người Làm Vườn. "Tôi nghĩ anh ấy muốn bà thấy điều này."\n\nBạn quỳ xuống, đào một hố nhỏ trên lớp đất cứng như đá của Hortus — thế giới đã bị ép thành hạt giống — và đặt hạt của Kaito vào đó.`,
      next: "secret2",
    },
    secret2: {
      text: `Hạt giống bén rễ ngay lập tức. Rễ của nó không hút thời gian — nó cho thời gian. Nó chạm vào những chiếc rễ đen của Vực Sâu, và những chiếc rễ ấy đổi màu: nâu, rồi xanh.\n\nNhững chiếc gai đen hoá gỗ. Những trang sách ép phẳng phồng lên, thở, sống. Không thế giới nào bị kết thúc. Không thế giới nào bị giữ lại. Chúng mọc tiếp — lộn xộn, không hoàn hảo, như những thế giới ghép của người Nhặt Góc ở tầng 94.`,
      next: "secret3",
    },
    secret3: {
      text: `Người Làm Vườn nhìn cái cây mọc lên từ đáy Vực Sâu, xuyên qua từng tầng, vươn lên mãi, về phía ánh sáng — về phía Thánh Địa, Kinh Đô của bạn, nơi đủ rộng để đón tất cả những ai muốn bắt đầu lại.\n\n"Ta chưa bao giờ biết," bà nói khẽ, "rằng có thể giữ một thứ mà không cần ép nó lại."\n\n"Bà có thể trồng nó," bạn nói. "Rồi để nó lớn."`,
      next: "secret4",
    },
    secret4: {
      text: `Mầm trở về trong ngực bà. Iris cất tiếng hát từ trong gió. Kaito — hay thứ còn lại của Kaito — xào xạc trong từng chiếc lá.\n\nTrái Đất thở ra. Lan tỉnh dậy. Bạn tỉnh dậy.\n\nVà trên bầu trời của mọi tầng, Hana đếm được một ngôi sao mới — ngôi sao thứ một trăm lẻ bốn, trên bầu trời thật. Cô viết vào sổ: "Ngôi sao này không cần ai giữ. Nó tự sáng."\n\n— KẾT THÚC BÍ MẬT: KHU VƯỜN SỐNG —\n\n(Cảm ơn bạn đã đi tới tận cùng. Bạn vẫn có thể tiếp tục ở Thánh Địa và Vực Sâu.)`,
      fx: [...done("secret"), { take: { kaito_seed: 1 } }],
    },
    over: {
      text: "Cây mẹ ở đáy Vực Sâu đứng lặng. Những chiếc rễ không còn đập. Nơi này đã kể xong câu chuyện của nó.",
      keep: true,
    },
  },
};
