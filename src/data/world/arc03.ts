import { addArc } from "./arc";

addArc({
  21: {
    title: "Tia Chớp Nhớ",
    scenes: [
      "Một tia sét đánh xuống ngay cạnh bạn — và trong khoảnh khắc chói loà ấy, bạn không nhìn thấy đảo mây. Bạn thấy một khu vườn nhỏ dưới bầu trời xám. Một cô bé quỳ bên luống hoa, hai tay ôm một bông hoa đang héo.\n\nTia sét tắt. Ký ức tắt theo.",
      "Tia sét thứ hai: cô bé đã lớn hơn. Cả thế giới quanh cô xám xịt, cây cối, nhà cửa, bầu trời đều héo úa như tờ giấy cũ. Chỉ có khu vườn nhỏ của cô còn màu.\n\nTia sét thứ ba: cô không còn là cô bé nữa. Cô cao lớn tới mức đầu chạm vào mây, và trong lòng bàn tay cô là một thế giới nhỏ, xoay chầm chậm.",
    ],
    choices: [
      { text: "Chờ tia sét thứ tư.", reply: "Không có tia sét thứ tư. Chỉ có tiếng sấm, cuối cùng cũng tới, muộn cả nghìn năm, vang dội khắp quần đảo.", flag: "saw_gardener_child" },
    ],
  },
  22: {
    title: "Bức Vẽ Trên Đá Cháy",
    scenes: [
      "Trên một tảng đá san hô đã nguội, ai đó vẽ bằng than một ngôi nhà có mái ngói đỏ, một cây khế, một con mèo vàng. Nét vẽ nguệch ngoạc của trẻ con.\n\nBên dưới, chữ viết tay tiếng Việt, xiêu vẹo: \"NHÀ CỦA LAN. LAN 7 TUỔI.\"",
      "Bức vẽ còn mới. Than chưa bị gió thổi phai. Một đứa trẻ bảy tuổi từ Trái Đất đang ở đâu đó dưới Vực Sâu — một mình.",
    ],
    choices: [
      { text: "Chép lại bức vẽ.", reply: "Bạn chép lại bức vẽ vào sổ. Ngôi nhà, cây khế, con mèo. Nếu gặp Lan, bạn sẽ cho bé xem.", flag: "saw_lan_drawing" },
    ],
  },
  23: {
    title: "Hana Bị Thương",
    speaker: "Hana", portrait: "hana",
    scenes: [
      "Trong một chiếc kén bị xé toạc, Hana ngồi co ro, một bên vai quấn băng tơ nhện. Cô cười khi thấy bạn — một nụ cười mệt mỏi.\n\n\"Tôi đi trước cậu vài tầng. Ngu thật. Tôi đã gặp một kẻ không mặt. Nó chạm vào tay tôi và tay tôi... chậm lại.\" Cô giơ tay trái lên. Nó run rẩy như ở trong nước.",
      "\"Nhưng nghe này. Tôi đã ghép được mười hai trang Sổ Tay. Có một câu cứ lặp đi lặp lại: 'Trái tim ta vẫn đập ở dưới đáy, và ta không dám nghe nó.'\"\n\nCô nhìn bạn. \"Người Làm Vườn có một trái tim ở tầng 100. Và tôi nghĩ trái tim ấy không phải của chính bà ta nữa.\"",
      "\"Tôi sẽ lên Đài Thiên Văn ở tầng 25. Từ đó có thể nhìn thẳng xuống đáy. Cậu... đi cẩn thận.\"",
    ],
    choices: [
      { text: "\"Để tôi đi cùng chị.\"", reply: "\"Không. Cậu cần đi theo nhịp của cậu. Nếu cả hai cùng bị bắt thì ai tìm tiếp?\" Hana nắm tay bạn bằng bàn tay còn lành. \"Hẹn gặp ở tầng 25.\"", flag: "hana_promise" },
      { text: "Đưa chị ấy thuốc.", reply: "Bạn đưa Hana một lọ thuốc. Cô uống, vết thương khép lại, nhưng bàn tay trái vẫn run. \"Thuốc không chữa được thời gian,\" cô nói. \"Cảm ơn cậu.\"", flag: "hana_promise" },
    ],
  },
  24: {
    title: "Tiếng Vọng Từ Phía Trước",
    scenes: [
      "Giữa Vực Im Lặng, nơi hẻm núi không dội lại bất cứ âm thanh nào, bạn nghe thấy một giọng nói. Không phải tiếng vọng từ quá khứ.\n\nĐó là giọng của bạn.\n\n\"...đừng ước. Dù nó hứa gì. Dù nó cho cậu thấy nhà. Đừng ước.\"",
      "Giọng nói có vẻ mệt mỏi, già hơn giọng bạn một chút, như thể đã đi một chặng đường rất dài.\n\nTiếng vọng ở Resonar chỉ lưu lại những gì từng được nói ở đây. Vậy thì khi nào bạn đã nói câu này?",
    ],
    choices: [
      { text: "Nói to: \"Tôi nghe rồi.\"", reply: "Tiếng của bạn vang đi, dội vào vách đá, và tiếp tục vang mãi. Ở đâu đó, một phiên bản khác của bạn có lẽ sẽ nghe thấy.", flag: "heard_own_echo" },
    ],
  },
  25: {
    title: "Mẫu Vật Số 101",
    speaker: "Hana", portrait: "hana",
    scenes: [
      "Trong phòng kính viễn vọng, Hana đứng im trước thấu kính, mắt dán vào ống kính. Cô không quay lại. Khi bạn chạm vào vai cô, vai cô lạnh và cứng như đá.\n\nHana đã bị ép.",
      "Trên bàn là cuốn sổ của cô, mở ở trang cuối cùng. Nét chữ run rẩy dần về cuối:\n\n\"Nhìn thấy rồi. Dưới đáy là một danh mục. Một trăm mẫu vật, mỗi cái một thế giới. Và có một dòng thứ một trăm lẻ một, mực còn ướt:\n\nMẫu vật 101 — đang ép.\n\nTên của nó là Trái Đ—\"",
      "Dòng chữ dừng ở đó. Qua thấu kính, bạn chỉ thấy bóng tối, và rất xa bên dưới, thứ gì đó đang đập, chậm rãi, như một trái tim.",
    ],
    choices: [
      { text: "Cầm cuốn sổ của Hana.", reply: "Bạn gấp cuốn sổ lại, cất vào túi áo trong. Trước khi đi, bạn quàng chiếc khăn của mình lên vai Hana. Ở đây lạnh lắm.", flag: "hana_notebook", give: { hana_notebook: 1 } },
      { text: "Thử rút gai trên người Hana.", reply: "Không có chiếc gai nào. Kẻ không mặt không dùng gai — chúng dùng bàn tay. Bạn không biết làm sao để gỡ một bàn tay vô hình. Bạn cầm cuốn sổ và hứa sẽ quay lại.", flag: "hana_notebook", give: { hana_notebook: 1 } },
    ],
  },
  26: {
    title: "Người Thợ Săn Và Cá Voi",
    speaker: "Lão thợ săn", portrait: "nomad",
    scenes: [
      "Một ông già ngồi bên lỗ băng, tay cầm cần câu không có mồi. \"Ta không câu cá. Ta nghe cá voi thở. Mỗi đêm một hơi.\"\n\n\"Người ta đồn rằng người từ trên xuống có thể đánh thức chúng. Đừng làm thế. Nếu chúng thức, chúng sẽ phát hiện ra mùa xuân không bao giờ đến. Chúng sẽ chết vì thất vọng.\"",
    ],
    choices: [
      { text: "\"Tôi sẽ để chúng ngủ.\"", reply: "\"Tốt.\" Ông già gật đầu. \"Có những giấc mơ đáng được giữ lại.\" Ông ngồi đó, nghe tiếp.", flag: "let_whales_sleep" },
      { text: "\"Biết đâu chúng muốn biết sự thật.\"", reply: "Ông già im lặng rất lâu. \"Có thể,\" ông nói. \"Ta chỉ là không đủ can đảm để là người nói cho chúng.\"", flag: "truth_whales" },
    ],
  },
  27: {
    title: "Chiếc Khăn Lạ",
    scenes: [
      "Một người tuyết nhỏ đứng tách biệt khỏi làng, quay mặt về phía Vực Sâu. Chiếc khăn nó quàng không phải khăn len của Nivalis. Đó là khăn quàng đỏ của đội thiếu niên — loại bạn từng đeo mỗi sáng thứ Hai chào cờ.",
      "Người tuyết không có tên. Nhưng dưới chân nó, ai đó đã viết lên tuyết bằng một que củi: \"Đợi anh ở dưới. — L.\"\n\nNét chữ trẻ con, giống hệt nét chữ dưới bức vẽ ở tầng 22.",
    ],
    choices: [
      { text: "Đi nhanh hơn.", reply: "Bạn quấn lại chiếc khăn cho người tuyết, rồi đi tiếp, nhanh hơn. Đâu đó bên dưới có một đứa trẻ đang đợi.", flag: "lan_trail" },
    ],
  },
  28: {
    title: "Dòng Sông Linh Hồn",
    scenes: [
      "Cực quang đột nhiên uốn cong xuống, như có ai đó kéo nó từ dưới đất. Và trong những dải sáng xanh, bạn thấy những đốm sáng nhỏ trôi xuôi — hàng trăm, hàng nghìn — về phía lòng Vực Sâu.",
      "Vài đốm sáng lướt qua đủ gần để bạn nhìn thấy hình dạng bên trong: một người đàn ông mặc áo mưa. Một bà cụ ôm túi chợ. Một cậu thanh niên đội mũ bảo hiểm. Họ đều nhắm mắt, như đang ngủ.\n\nHọ mặc quần áo của Trái Đất.",
    ],
    choices: [
      { text: "Gọi họ.", reply: "Không ai tỉnh dậy. Dòng sáng trôi đi, xuống dưới, xuống mãi. Bạn đứng nhìn tới khi đốm sáng cuối cùng biến mất.", flag: "saw_soul_river" },
      { text: "Chạm vào một đốm sáng.", reply: "Đốm sáng ấm như bàn tay người. Trong một giây, bạn nghe tiếng còi xe, tiếng mưa, một câu nói dở dang: \"...con về liền mà mẹ...\" Rồi nó trôi đi.", flag: "saw_soul_river" },
    ],
  },
  29: {
    title: "Nốt Nhạc Cuối Cùng",
    scenes: [
      "Trong nhà hát ngầm, cả dàn hợp xướng đông cứng, miệng mở, chờ nốt nhạc thứ một nghìn. Tờ tổng phổ còn mở trên giá. Nốt cuối cùng được đánh dấu bằng mực đỏ.\n\nBạn có thể đọc được nó. Bạn có thể hát nó.",
      "Nhưng Cantora được giữ lại vì bài hát chưa kết thúc. Nếu bạn hát nốt cuối...",
    ],
    choices: [
      { text: "Hát nốt nhạc cuối.", reply: "Giọng bạn run rẩy, lạc điệu. Nhưng cả dàn hợp xướng đồng thanh theo bạn. Nốt nhạc vang lên, tròn đầy, đẹp tới mức nước mắt bạn trào ra — và khi nó tắt, những người hát mỉm cười, cúi chào, và tan thành những bông tuyết nhỏ.\n\nHang động im lặng. Lần đầu tiên, sự im lặng không đáng sợ.", flag: "released_29", give: { sig_f29: 3 } },
      { text: "Để bài hát dở dang.", reply: "Bạn gấp tổng phổ lại, nhẹ nhàng. Dàn hợp xướng vẫn chờ. Có lẽ một bài hát chưa kết thúc cũng là một cách để sống mãi.", flag: "kept_29" },
    ],
  },
  30: {
    title: "Tiếng Nói Trong Thân Cây",
    speaker: "Kaito", portrait: "kaito",
    scenes: [
      "Ở trung tâm khu rừng là một cây non cao ngang ngực bạn, lá xanh non tơ. Khi bạn chạm vào, thân cây ấm lên, và một giọng nói quen thuộc vang lên, nhẹ như tiếng lá.\n\n\"...Vẫn còn sống hả? Tốt. Tôi là Kaito. Hoặc là thứ còn lại của Kaito. Nhờ cậu mà hạt giống của tôi mới rơi xuống được đến đây.\"",
      "\"Tôi đã sai về những chiếc gai. Tôi tưởng rút gai là giải thoát. Thật ra rút gai là trả lại thời gian — và thời gian sẽ đưa mỗi thế giới đi nốt con đường của nó. Tới cái kết mà nó đã tránh.\"\n\n\"Cậu nhìn khu rừng này đi. Ở đây không có gai. Cây mọc, cây chết, cây mọc lại. Đẹp không? Nhưng một khu rừng cần đất. Những thế giới kia... không còn đất nữa.\"",
      "\"Cầm lấy cái này.\" Một quả nhỏ rơi vào tay bạn, vỏ cứng như gỗ. \"Hạt giống của tôi. Đừng trồng nó vội. Tới đáy rồi hãy trồng. Cậu sẽ biết lúc nào.\"",
    ],
    choices: [
      { text: "\"Cảm ơn anh, Kaito.\"", reply: "\"Đừng cảm ơn. Cứ đi tiếp.\" Lá cây rung nhẹ, như một cái vẫy tay.", flag: "kaito_seed", give: { kaito_seed: 1 } },
    ],
  },
});
