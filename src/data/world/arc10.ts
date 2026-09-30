import { addArc } from "./arc";

addArc({
  91: {
    title: "Rễ Của Trái Đất",
    scenes: [
      "Giữa hàng nghìn chiếc rễ, có một chiếc to hơn tất cả — to như một con sông, xanh và trắng, và bên trong lớp vỏ trong suốt của nó, bạn thấy những hình ảnh trôi qua: một con phố, một cánh đồng lúa, một sân bóng, một đám cưới, một bệnh viện, một ngôi trường.\n\nNó đang chảy xuống. Nhanh hơn mọi rễ khác.",
      "Hạt giống của Kaito trong túi bạn nóng rực lên, nóng tới mức bạn phải lấy nó ra. Vỏ hạt đã nứt một đường. Bên trong, một mầm trắng nhỏ xíu đang ngọ nguậy — hướng lên, không phải hướng xuống.",
    ],
    choices: [
      { text: "Cất hạt giống thật cẩn thận.", cond: { has: "kaito_seed" }, reply: "Bạn bọc hạt giống trong chiếc khăn ấm nhất và cất vào túi áo trong, sát ngực. \"Chưa đâu,\" bạn thì thầm với nó. \"Tới đáy đã.\" Hạt giống ấm lên một chút, như gật đầu.", flag: "seed_stirring" },
      { text: "Áp tay lên chiếc rễ Trái Đất.", reply: "Qua lớp vỏ, bạn cảm thấy hàng tỉ nhịp tim đang đập chậm dần. Bạn áp trán vào rễ, và nói với tất cả những người ở trong đó: \"Chờ thêm chút nữa thôi.\"", flag: "touched_earth_root" },
    ],
  },
  92: {
    title: "Giây Của Bạn",
    scenes: [
      "Trong Mạch Tinh Thể Trái Đất, một người thợ mỏ già đưa cho bạn một tinh thể nhỏ. \"Cái này mang tên cậu,\" ông nói. \"Nó rơi xuống từ đêm hôm ấy.\"\n\nBạn nhìn vào. Bên trong là một giây: bạn đang chạy ra giữa đường, chiếc ô rời khỏi tay, hai tay dang ra phía trước. Khuôn mặt bạn trong tinh thể không sợ hãi. Nó chỉ tập trung — như một người đang cố với lấy thứ quan trọng nhất đời mình.",
    ],
    choices: [
      { text: "Giữ tinh thể.", reply: "Bạn giữ nó trong lòng bàn tay. Đây không phải khoảnh khắc bạn chết. Đây là khoảnh khắc bạn sống trọn vẹn nhất.", flag: "kept_own_second", give: { sig_f92: 1 } },
      { text: "Trả nó cho người thợ mỏ.", reply: "\"Ông giữ nó giùm tôi,\" bạn nói. \"Nếu tôi không quay lại, hãy trả nó cho một cô bé tên Lan.\" Ông lão gật đầu, gói tinh thể vào một miếng vải sạch.", flag: "gave_own_second" },
    ],
  },
  93: {
    title: "Lối Mòn Của Kaito",
    scenes: [
      "Giữa Biển Gai, có một lối mòn hẹp, ai đó đã bẻ từng chiếc gai để mở đường. Những chiếc gai bị bẻ không còn đen — chúng đã hoá gỗ, nâu và mộc, và trên vài chiếc đã mọc những chồi lá xanh.\n\nỞ đầu lối mòn, khắc trên một khúc gỗ: \"Đi theo đường tôi. Đừng nhìn xuống. — K.\"",
    ],
    choices: [
      { text: "Đi theo lối mòn.", reply: "Bạn đi theo lối mòn suốt ba ngày — hoặc ba giờ, không ai biết ở đây. Tới Bến Đỗ Cuối, bạn thấy một chiếc mũ lưỡi trai cũ treo trên một cành gai đã hoá gỗ. Bên trong mũ, một dòng chữ: \"Tôi tới được đây. Tôi không đi tiếp được. Phần còn lại là của cậu.\"", flag: "kaito_path" },
    ],
  },
  94: {
    title: "Những Thế Giới Không Hoàn Hảo",
    scenes: [
      "Ở Xưởng Ghép Lại, người Nhặt Góc cho bạn xem thành quả của họ: một thế giới nhỏ bằng cái sân, được ghép từ nửa cây cầu Fulgur, một góc chợ Zahr, một mảnh ruộng bậc thang, và một đoạn vỉa hè có dán tờ quảng cáo tiếng Việt.\n\nNó xấu xí, méo mó. Nhưng có cỏ mọc giữa các khe ghép. Có một con chim đang làm tổ trên nửa cây cầu. Và khi bạn đứng đó, bạn thấy một chiếc lá rụng.",
    ],
    choices: [
      { text: "\"Nó đẹp.\"", reply: "Người Nhặt Góc già cười móm mém. \"Không, nó không đẹp. Nhưng nó sống. Bà ấy chưa bao giờ hiểu rằng hai chuyện đó khác nhau.\" Ông dúi vào tay bạn một mảnh ghép nhỏ. \"Đem xuống cho bà ấy xem.\"", flag: "imperfect_world", give: { sig_f94: 1 } },
    ],
  },
  95: {
    title: "Chiếc Ghế Giữa Sảnh",
    scenes: [
      "Ở giữa Đại Sảnh Danh Mục là một chiếc ghế gỗ cũ, mòn vẹt. Trên tay vịn có những vết xước — dấu móng tay. Trước mặt chiếc ghế là tủ kính cuối cùng, lớn nhất, gắn nhãn \"Mẫu vật 101\".\n\nBên trong tủ, Trái Đất đang dần phẳng lại. Tám mươi ba phần trăm.",
      "Trên ghế là một trang giấy, trang cuối cùng của Sổ Tay Người Làm Vườn:\n\n\"Ta không biết cách dừng lại. Mỗi lần ta ép xong một thế giới, ta thấy trống rỗng, và ta lại tìm một thế giới khác. Ta nghĩ ta đang cứu chúng. Ta nghĩ ta đang giữ chúng.\n\nNhưng ta đã giữ tất cả mọi thứ, trừ mẹ. Và trừ chính ta.\n\nNếu có ai đọc được những trang này — xin hãy dừng ta lại.\"",
    ],
    choices: [
      { text: "Ngồi xuống ghế, nhìn Trái Đất một lúc.", reply: "Bạn ngồi xuống chiếc ghế của bà, nhìn qua lớp kính. Tám tỉ người, rất nhiều người đang nắm tay nhau. Bạn hiểu vì sao bà ngồi đây lâu tới vậy. Bạn đứng dậy.", flag: "last_page", give: { garden_page: 1 } },
    ],
  },
  96: {
    title: "Bậc Thang Chót",
    scenes: [
      "Trên Chiếu Nghỉ — hòn đảo đá cuối cùng trước khi cầu thang chạm đáy — những người đồng hành của bạn dừng lại. Bên dưới, bạn nghe thấy nhịp đập. Chậm, nặng, và gần tới mức mỗi nhịp làm bậc thang dưới chân rung lên.",
    ],
    choices: [
      { text: "Nhìn Hana.", cond: { flag: "hana_free" }, reply: "Hana chỉnh lại kính, rút cuốn sổ ra, và vẽ thêm một ngôi sao cuối cùng vào bản đồ — ngôi sao của tầng 96. \"Một trăm lẻ ba,\" cô đếm. \"Tôi muốn đếm được một trăm lẻ bốn. Ở bầu trời thật. Trên Trái Đất.\" Cô nắm tay bạn. \"Đi thôi.\"", flag: "hana_resolve" },
      { text: "Nhìn Mầm.", cond: { flag: "mam_with_you" }, reply: "Mầm đang run, hai chiếc lá cụp xuống. \"Tớ sợ,\" Mầm thú nhận. \"Lỡ bà ấy không nhận ra tớ thì sao?\" Bạn cúi xuống, nắm tay Mầm. \"Thì tớ sẽ giới thiệu. 'Đây là Mầm, bạn thân nhất của tớ.'\" Mầm bật cười, lá dựng lên.", flag: "mam_resolve" },
      { text: "Hít một hơi thật sâu, rồi bước xuống.", reply: "Bạn nhìn lên trước — lên những tầng bạn đã đi qua, những người bạn đã gặp. Rồi bạn nhìn xuống. Bậc thang cuối cùng hiện ra dưới chân bạn.", flag: "last_step" },
    ],
  },
  97: {
    title: "Cổng Gỗ Cũ",
    scenes: [
      "Cánh cổng gỗ đóng chặt. Hàng rào gai cao ngất hai bên, không có kẽ hở. Trên cổng treo một tấm biển nhỏ, nét chữ trẻ con: \"NHÀ CỦA IRIS VÀ CON GÁI. KHÔNG AI ĐƯỢC VÀO.\"\n\nNét chữ bên dưới, của người lớn, nghiêng nghiêng: \"Kể cả ta.\"",
    ],
    choices: [
      { text: "Để Mầm mở cổng.", cond: { flag: "mam_with_you" }, reply: "Mầm bước tới, đặt bàn tay nhỏ xíu lên cánh cổng. Gỗ khẽ kêu cót két — như một tiếng thở dài — rồi cổng mở ra, nhẹ như chưa từng khoá. \"Con về rồi,\" Mầm nói khẽ với ngôi nhà. \"Con về rồi đây.\"", flag: "gate_opened" },
      { text: "Trèo qua hàng rào gai.", reply: "Gai cào rách áo và da bạn khi bạn trèo qua. Bạn ngã xuống phía bên kia, máu rỉ ra từ hàng chục vết xước. Nhưng bạn đã vào được. Ở đây, lá vàng rơi, và vết thương của bạn đau — đau thật, như ở nhà.", flag: "climbed_hedge" },
    ],
  },
  98: {
    title: "Phòng Của Cô Bé",
    scenes: [
      "Trong ngôi nhà gỗ nhỏ, có một căn phòng với chiếc giường gỗ, một kệ đầy hoa ép, và những bức vẽ bằng than dán trên tường: một người phụ nữ tóc dài đang hát, một cô bé ngồi trong vườn, một bông hoa.\n\nTrên gối là một con búp bê vải, đường khâu vụng về. Giống hệt búp bê của Lan.",
      "Ở bàn học, một cuốn sổ tay nhỏ, bìa vải. Trang đầu tiên — trang đầu tiên thật sự, trước cả trang ở tầng 79:\n\n\"Mẹ bảo mai mẹ sẽ đi xa. Mẹ bảo mẹ sẽ thành đất, thành hoa, thành con. Con không hiểu. Con không muốn mẹ thành hoa. Con muốn mẹ ở đây.\n\nCon sẽ giữ mẹ lại. Con sẽ giữ tất cả lại. Không ai phải đi đâu hết.\"",
    ],
    choices: [
      { text: "Đan nốt chiếc khăn của Iris.", reply: "Chiếc khăn đan dở vẫn nằm trên ghế mây, que đan còn cắm. Bạn không biết đan. Nhưng bạn thử — một mũi, hai mũi, vụng về, lỏng lẻo. Mũi cuối cùng, bạn buộc nút.\n\nỞ đâu đó bên dưới, rất gần, nhịp đập khựng lại — như một người vừa nhận ra có ai đó đang ở trong nhà mình.", flag: "finished_scarf" },
      { text: "Mang theo cuốn sổ nhỏ.", reply: "Bạn cất cuốn sổ bìa vải vào túi, cạnh những trang sổ tay khác bạn đã nhặt được suốt chín mươi tám tầng. Giờ bạn đã có câu chuyện từ đầu tới cuối. Chỉ còn thiếu đoạn kết.", flag: "child_diary", give: { garden_page: 1 } },
    ],
  },
  99: {
    title: "Đừng Ước",
    scenes: [
      "Ở Nơi Tiếng Vọng Bắt Đầu, hành lang pha lê kết thúc ở một bức tường trắng. Mọi âm thanh từ các tầng trên đổ về đây: tiếng Lyra hát, tiếng Kaito cười, tiếng Hana đếm sao, tiếng Lan gọi \"Anh cầm ô!\", tiếng Mầm hỏi \"Cậu có nhớ tên mẹ cậu không?\"\n\nVà trên bức tường, một tờ giấy: \"Mẫu vật 101. Tiến độ: 97%.\"",
      "Bạn hiểu ra. Tiếng vọng ở tầng 17. Giọng nói của chính bạn ở tầng 24. Người trong gương ở tầng 49. Tất cả đều bắt đầu từ đây — từ bạn, ngay bây giờ, vang ngược lên quá khứ.\n\nBạn đã nghe câu này suốt hành trình. Giờ tới lượt bạn nói.",
    ],
    choices: [
      { text: "Nói to: \"Đừng ước. Dù nó hứa gì. Dù nó cho cậu thấy nhà. Đừng ước.\"", reply: "Giọng bạn vang vào vách pha lê, dội ngược lên trên, lên mãi, xuyên qua chín mươi tám tầng, về tận một con người mệt mỏi đang đứng ở tầng 24, lần đầu tiên nghe thấy nó.\n\nVòng lặp khép lại. Bạn mỉm cười. Bạn đã tới được đây — và bạn vẫn là chính mình.", flag: "said_dont_wish" },
    ],
  },
});
