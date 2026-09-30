import { addArc } from "./arc";

addArc({
  51: {
    title: "Chiếc Điện Thoại Còn Một Phần Trăm Pin",
    scenes: [
      "Ở Chợ Đồ Rơi, những người buôn bán bày la liệt đồ vật rơi xuống theo dòng sông linh hồn: ô dù gãy, dép tổ ong, mũ bảo hiểm, một con gấu bông mất một mắt. Họ không biết chúng là gì. Họ bán chúng như bán đồ cổ.\n\nGiữa đống đồ, một chiếc điện thoại màn hình nứt vẫn còn sáng. Góc trên: 1%.",
      "Màn hình khoá là ảnh một bà cụ đang cười. Ngày giờ hiện trên màn hình đứng im — đúng vào cái đêm mưa hôm ấy. Đêm bạn chết.\n\nMột tin nhắn chưa đọc: \"Mưa to lắm, con đi đường cẩn thận nha. Mẹ để phần cơm.\"",
    ],
    choices: [
      { text: "Mua chiếc điện thoại.", reply: "Người bán lấy của bạn vài đồng, nhìn bạn như nhìn một kẻ ngốc. Bạn giữ chiếc điện thoại trong lòng bàn tay cho tới khi màn hình tắt hẳn. Bạn không biết đó là điện thoại của ai. Nhưng tối hôm ấy, có rất nhiều bà mẹ để phần cơm.", flag: "saw_phone" },
      { text: "Để nó lại.", reply: "Bạn đặt chiếc điện thoại xuống, úp màn hình. Có những thứ không nên nhìn quá lâu, nếu muốn còn đi tiếp được.", flag: "saw_phone" },
    ],
  },
  52: {
    title: "Tiếng Gọi Dưới Hắc Ín",
    scenes: [
      "Bên Hồ Gương Đen, một bàn tay xám vươn lên khỏi mặt nhựa, run rẩy, rồi một cái đầu không mặt nhô lên theo. Nó không tấn công. Nó chỉ thì thầm, giọng như bọt khí vỡ.\n\n\"Đừng nói với chúng là tôi ở đây. Tôi là số chín. Tôi đang trốn.\"",
      "\"Người ước thì thành bàn tay. Bàn tay phải ép. Nếu không ép, bàn tay sẽ tan. Tôi đã ép... nhiều lắm. Tới một ngày tôi ép một đứa bé đang ngủ, và tôi không chịu được nữa.\"\n\n\"Những bàn tay khác đang tăng ca. Có một thế giới rất lớn đang được ép. Cần rất nhiều tay. Tôi không muốn là một trong số đó.\"",
    ],
    choices: [
      { text: "\"Tôi sẽ không nói với ai.\"", reply: "Số chín gật đầu, rồi chìm dần xuống lớp nhựa đen. Trước khi biến mất, nó nói: \"Cảm ơn. Nếu cậu tới được đáy... hãy nhớ rằng có những bàn tay không muốn ép.\"", flag: "knows_hands" },
      { text: "\"Đi cùng tôi.\"", reply: "\"Tôi không đi được nữa. Chân tôi tan mất rồi.\" Số chín cười — một âm thanh khô khốc. \"Nhưng cảm ơn. Đã lâu lắm không ai rủ tôi đi đâu.\" Nó chìm xuống.", flag: "knows_hands" },
    ],
  },
  53: {
    title: "Lan Vẽ Anh Cầm Ô",
    scenes: [
      "Vách Tranh Lớn là một bức tường thạch anh tím phủ kín hình vẽ bằng sáp màu. Một ngôi nhà mái đỏ. Một cây khế. Mầm — hai chiếc lá xanh, đôi mắt tròn, rõ ràng là Mầm. Và một người cao gầy mặc áo choàng xám, được vẽ thêm khuôn mặt cười.",
      "Ở góc cuối bức tường, một bức vẽ khác hẳn: nét vẽ run hơn, màu tối hơn. Một con đường mưa. Một chiếc xe tải to đùng với hai con mắt đèn pha. Một cô bé nhỏ xíu mặc áo mưa vàng.\n\nVà một người lớn đứng chắn giữa cô bé và chiếc xe tải, tay cầm một chiếc ô bị gió lật ngửa.\n\nBên dưới: \"ANH CẦM Ô. LAN CHƯA KỊP CẢM ƠN.\"",
    ],
    choices: [
      { text: "Chạm vào hình người cầm ô.", reply: "Sáp màu ấm dưới ngón tay bạn. Và bạn nhớ ra — không phải cả đêm hôm đó, chỉ một mảnh: cái lạnh của nước mưa, tiếng còi xe, và chiếc áo mưa vàng nhỏ xíu ở giữa đường.\n\nBạn đã chạy ra. Bạn đã không nghĩ gì cả.", flag: "lan_draws_you" },
    ],
  },
  54: {
    title: "Mùa Thu Mẹ Mất",
    scenes: [
      "Trong Tim Rỗng — khoang ngực trống của vị thần đã chết — có một chiếc hộp gỗ nhỏ. Bên trong là một trang giấy, được ép cẩn thận như một bông hoa.\n\n\"Mẹ ta mất vào mùa thu. Bà nói: 'Đừng buồn con ạ. Lá rụng để cây nghỉ, cây nghỉ để mùa xuân tới.' Ta không tin bà. Ta ép bà vào giữa hai trang sách đầu tiên của ta, để bà không bao giờ phải rụng.",
      "\"Rồi ta ép khu vườn của bà. Rồi ta ép thế giới của bà — thế giới của ta — để không ai phải rụng nữa.\n\nTa ép nó chặt tới mức nó không còn là thế giới. Nó chỉ còn là một hạt giống cứng, ở dưới đáy. Ta đặt Trái Tim của ta lên trên nó, để giữ ấm.\n\nĐã bao nhiêu mùa thu rồi, mẹ ơi?\"",
    ],
    give: { garden_page: 1 },
  },
  55: {
    title: "Canh Chua Của Bà Tư",
    speaker: "Bà Tư", portrait: "villager",
    scenes: [
      "Trong Tiệm Tạp Hoá Bà Tư, một bà cụ tóc bạc búi cao đang nấu một nồi canh. Mùi me, mùi thơm, mùi cá. \"Con ăn cơm chưa? Ngồi đi. Nồi canh chua này bà nấu mỗi ngày, mà không có ai ăn.\"",
      "\"Bà nấu cho ông nhà. Ổng đi xuống trước bà, lâu lắm rồi. Ổng thích canh chua lắm.\" Bà múc canh ra bát, tay run run. \"Mà con biết không... bà quên tên ổng rồi. Bà chỉ nhớ ổng hay ngồi câu cá, nướng cá, cười hề hề.\"",
    ],
    choices: [
      { text: "\"Bà ơi, con gặp ông rồi. Ông Bảy, ở hồ sao tầng 14. Ông cũng nhớ canh chua của bà.\"", cond: { flag: "met_bay" }, reply: "Chiếc muôi rơi xuống nền. Bà Tư đứng im rất lâu. Rồi bà bật khóc — khóc to, như một cô gái trẻ.\n\n\"Bảy... Bảy! Trời ơi, ông Bảy! Sao tui quên được cái tên đó...\" Bà lau nước mắt bằng vạt áo, rồi vội vàng múc canh vào một cái cà mèn. \"Con ơi, nếu con đi lên... con đem cho ổng. Nói là bà Tư vẫn nấu. Nói là bà nhớ tên ổng rồi.\"", flag: "bay_reunion", give: { canh_chua: 1 } },
      { text: "Ngồi ăn canh với bà.", reply: "Bạn ăn hết bát canh. Chua, ngọt, cay, đúng vị quê nhà. Bà Tư nhìn bạn ăn, cười hiền. \"Ăn đi con. Đi xa thì nhớ ăn cho no.\" Bát canh ấm tới tận tầng sau.", flag: "ate_canh_chua" },
    ],
  },
  56: {
    title: "Sét Đánh Hai Lần",
    scenes: [
      "Tia sét thứ hai bắn lên từ Khe Sâu Nhất, và trong ánh chớp trắng xoá, bạn không còn ở Fulminar nữa.\n\nBạn đang đứng giữa một ngã tư ướt mưa. Đèn giao thông nháy vàng. Chiếc ô trong tay bị gió lật ngửa. Bên kia đường, một cô bé mặc áo mưa vàng vừa buông tay mẹ để nhặt một con búp bê vải rơi xuống lòng đường.",
      "Đèn pha. Tiếng còi. Bạn buông chiếc ô.\n\nBạn chạy.\n\nTia sét tắt. Bạn ngã khuỵu giữa Fulminar, tim đập thình thịch, hai tay vẫn còn đang đẩy về phía trước — đẩy một thứ gì đó nhỏ xíu, mặc áo mưa vàng, ra khỏi con đường.",
    ],
    choices: [
      { text: "Đứng dậy.", reply: "Bạn đứng dậy. Chân bạn run. Nhưng lần đầu tiên từ khi tới Vực Sâu, bạn biết chính xác vì sao mình ở đây — và bạn không hối hận.", flag: "memory_rain" },
    ],
  },
  57: {
    title: "Tăng Ca",
    scenes: [
      "Trong Phòng Quản Đốc, một tấm bảng đen ghi chỉ tiêu sản xuất bằng phấn trắng. Hầu hết các dòng đã bị gạch. Chỉ còn một dòng, được viết lại nhiều lần, con số mỗi lần một lớn hơn:\n\n\"MẪU VẬT 101 — GAI CẦN THIẾT: 8.000.000.000\"",
      "Tám tỉ. Một chiếc gai cho mỗi người.\n\nDưới dòng chữ, những dây chuyền chạy không ngừng. Những bàn tay xám rèn, mài, xếp gai vào thùng. Mỗi thùng được băng tải đưa xuống dưới, xuống mãi.",
    ],
    choices: [
      { text: "Phá dây chuyền.", reply: "Bạn đập nát bánh răng chính bằng tất cả sức lực. Dây chuyền rít lên, khựng lại, những chiếc gai dở dang rơi loảng xoảng. Những bàn tay xám dừng tay, quay đầu nhìn bạn — và không ai ngăn bạn lại.\n\nMột giờ sau, dây chuyền lại chạy. Nhưng một giờ là một nghìn chiếc gai không được rèn.", flag: "sabotaged_thorns" },
      { text: "Lấy một chiếc gai mẫu để nghiên cứu.", reply: "Bạn lấy một chiếc gai chưa mài. Nó nhẹ bẫng, lạnh buốt, và trên thân khắc một dòng chữ nhỏ bằng tiếng Việt: \"Nguyễn Thị L—\". Phần còn lại chưa khắc xong.", flag: "took_thorn_sample" },
    ],
  },
  58: {
    title: "Hana Thở",
    speaker: "Hana", portrait: "hana",
    scenes: [
      "Khí độc cuộn thành những hình thù kỳ quặc trước mắt bạn, và trong làn khí vàng lục, bạn nhìn thấy Đài Thiên Văn ở tầng 25. Hana vẫn đứng đó, đông cứng trước thấu kính, chiếc khăn của bạn vắt trên vai.\n\nRồi, rất chậm, một giọt nước mắt lăn xuống má cô.",
      "Môi cô không cử động, nhưng bạn nghe thấy giọng cô — mỏng như sợi chỉ.\n\n\"...Tôi vẫn ở đây. Tôi đang đếm sao để không quên mình. Cậu đi tới đâu rồi? Nếu cậu cầm sổ của tôi... đọc trang có hình mũi tên. Tôi đã tìm ra cách ngược lại...\"\n\nLàn khí tan đi.",
    ],
    choices: [
      { text: "\"Chị Hana, em sẽ quay lại!\"", reply: "Không có tiếng trả lời. Nhưng bạn tin là cô đã nghe thấy.", flag: "hana_resisting" },
    ],
  },
  59: {
    title: "Cây Có Lạnh Không",
    scenes: [
      "Ở Rừng Già Nhất, giữa những thân cây đá, có hai hàng dấu chân in trên lớp bụi. Một hàng to, bước dài, nhẹ tới mức gần như không in dấu. Một hàng nhỏ xíu, nhảy chân sáo.\n\nCây Nhớ — cây cổ thụ lớn nhất rừng — kêu lên một tiếng như chuông gió khi bạn tới gần.",
      "\"Người cầm ô. Ta biết là ngươi. Con bé đã kể về ngươi.\" Cây nói chậm, như đá cọ vào đá. \"Nó đi cùng một người không mặt. Người ấy dạy nó đếm, dạy nó đọc chữ trên đá. Họ đi về phía một thế giới được vẽ bằng sáp màu.\"\n\n\"Đi nhanh lên. Ở tầng dưới, có những bàn tay khác đang tìm con bé.\"",
    ],
    choices: [
      { text: "Chạy theo dấu chân.", reply: "Bạn chạy. Những dấu chân nhỏ xíu dẫn bạn qua rừng đá, và trên một phiến đá, ai đó đã vẽ bằng phấn trắng một mũi tên, đánh số 11 — nét phấn ngay ngắn của một người thầy.", flag: "lan_close" },
    ],
  },
  60: {
    title: "Lan",
    speaker: "Lan", portrait: "villager",
    scenes: [
      "Ở Nơi Lan Vẽ, một cô bé tóc hai bím, áo mưa vàng, đang ngồi bệt dưới đất, tô màu một bông hoa to hơn cả người. Cạnh bé, một người cao lớn mặc áo choàng xám ngồi xếp bằng, lặng lẽ gọt bút sáp.\n\nCô bé ngẩng lên. Mắt bé mở to. Rồi bé đứng bật dậy, làm rơi cả hộp sáp.",
      "\"Anh cầm ô!\" Lan chạy ào tới, ôm chầm lấy chân bạn. \"Anh cầm ô! Lan biết mà! Lan biết anh sẽ tới mà!\"\n\nBé ngửa cổ lên, mắt đỏ hoe. \"Hôm đó anh đẩy Lan ra, Lan té trầy đầu gối, Lan khóc. Lan chưa kịp cảm ơn anh. Rồi Lan ngủ, rồi Lan thấy mình ở đây.\"\n\n\"Cảm ơn anh nha.\"",
      "Người không mặt đứng dậy. Nửa dưới khuôn mặt vẫn còn cái miệng — đang mỉm cười. Và nếu bạn nhìn kỹ, có hai vệt phấn trắng ở chỗ lẽ ra là đôi mắt.\n\n\"Thầy tìm thấy con bé ở tầng 41, đang khóc một mình,\" thầy Minh nói khẽ. \"Thầy dạy nó đếm tới một trăm rồi. Nó giỏi lắm.\"",
    ],
    choices: [
      { text: "\"Thầy Minh, thầy đưa Lan lên Thánh Địa được không? Ở đó có Mầm.\"", cond: { flag: "minh_remembered" }, reply: "Thầy Minh gật đầu, bế Lan lên vai. \"Thầy đi lên được. Bàn tay thì đi lên được, chỉ là không ai muốn.\" Lan vẫy tay với bạn mãi cho tới khi hai người khuất sau đồi cỏ xanh lè.\n\n\"Anh cầm ô ơi, xuống dưới đó nhanh rồi về nha! Lan đợi!\"", flag: "lan_safe" },
      { text: "Trả con búp bê cho Lan.", cond: { has: "lan_doll" }, reply: "Lan ôm chặt con búp bê vải vào ngực. \"Bé Na! Lan tưởng mất bé Na rồi!\" Bé dúi vào tay bạn một mẩu sáp màu vàng. \"Cái này làm phép được đó. Anh cầm đi, lỡ có quái vật.\"", flag: "lan_doll_returned", give: { sig_f60: 2 } },
      { text: "\"Anh hứa sẽ đưa em về nhà.\"", reply: "Lan nhìn bạn rất nghiêm túc, rồi chìa ngón út ra. \"Ngoéo tay.\" Bạn ngoéo tay. \"Ngoéo tay là không được nuốt lời đâu nha.\"\n\nNgười không mặt đặt một bàn tay lên vai Lan, như để nói: tôi sẽ trông con bé cho tới khi anh quay lại.", flag: "promise_lan" },
    ],
  },
});
