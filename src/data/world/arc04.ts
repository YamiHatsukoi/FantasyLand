import { addArc } from "./arc";

addArc({
  31: {
    title: "Căn Bếp Giữa Sa Mạc",
    scenes: [
      "Giữa hai cồn cát, không khí gợn lên, và bạn thấy nó: một căn bếp nhỏ. Tường ốp gạch men xanh đã ố, cái nồi cơm điện nháy đèn đỏ, chiếc quạt trần kêu cọt kẹt. Một người phụ nữ đứng quay lưng, đang nêm nồi canh.\n\nMùi canh chua bay tới, thật tới mức bạn thấy cay mắt.",
      "Ở tầng 19, khi nhìn vào khoảng trống trên mặt kẻ không mặt, bạn đã thấy một căn bếp. Căn bếp này.\n\nNgười phụ nữ sắp quay lại. Bạn biết khuôn mặt ấy. Bạn biết mình chỉ cần bước thêm ba bước.",
    ],
    choices: [
      { text: "Bước vào căn bếp.", reply: "Ba bước. Bạn chạm được vào vạt áo bà — và cát tràn qua kẽ tay. Căn bếp tan ra. Bạn quỳ giữa sa mạc, miệng đầy cát, và lần đầu tiên sau rất lâu, bạn khóc to như một đứa trẻ.\n\nTrong nắm tay bạn còn lại một nắm cát giữ nguyên hình một chiếc muôi.", flag: "touched_mirage", give: { sig_f31: 2 } },
      { text: "Đi vòng qua.", reply: "Bạn nhắm mắt lại và đi tiếp. Sau lưng, tiếng quạt trần kêu cọt kẹt nhỏ dần. Một giọng nói gọi tên bạn, đúng như cách bà vẫn gọi mỗi chiều.\n\nBạn không quay lại. Nếu quay lại, bạn biết mình sẽ không đi nổi nữa.", flag: "passed_mirage" },
    ],
  },
  32: {
    title: "Mục Lục Bị Xé",
    scenes: [
      "Trong Phòng Mục Lục, hàng nghìn ngăn kéo gỗ ngâm dưới nước. Mỗi ngăn ghi tên một thế giới. Hầu hết đều trống. Chỉ một ngăn còn thứ gì đó: một trang giấy khô cong, nét chữ nghiêng nghiêng bạn đã quá quen.\n\n\"Ta bắt đầu ghi mục lục. Mỗi thế giới một số. Số nhỏ là những thế giới ta yêu nhất. Ta không đánh số cho thế giới của chính ta. Ta không chịu nổi việc nhìn thấy nó trong danh sách.\"",
      "Ở mặt sau trang giấy, ai đó đã viết thêm bằng bút bi, nét chữ Việt tròn trịa của một người quen viết bảng:\n\n\"Thế giới của bà ấy không có số. Vậy nó ở đâu? — M.\"",
    ],
    give: { garden_page: 1 },
  },
  33: {
    title: "Kẻ Lên Dây Cót",
    scenes: [
      "Trên Mặt Đồng Hồ Lớn, một kẻ không mặt đang lên dây cót — xoay, xoay, xoay chiếc chìa khoá to bằng người. Áo choàng xám đã sờn tới rách. Trên cổ tay nó là một chiếc đồng hồ đeo tay nhựa, loại bán ở chợ, kim đứng im ở 10 giờ 10.\n\nNó dừng tay khi thấy bạn. Lần đầu tiên, một kẻ không mặt nói.",
      "\"...Người mới. Số bốn mươi bảy. Tôi là số ba.\" Giọng nó khàn như cát. \"Khi tới đáy, nó sẽ hỏi cậu muốn gì. Tôi đã trả lời. Tôi muốn thời gian quay lại. Và nó cho tôi đúng thứ đó — mãi mãi ở trong lúc quay lại.\"\n\n\"Đừng trả lời nó.\"",
    ],
    choices: [
      { text: "\"Anh tên gì?\"", reply: "Kẻ không mặt im lặng rất lâu. \"Tôi... có một cái tên. Nó ở trên kia. Tôi để quên nó cùng với cái mặt.\" Nó quay lại với chiếc chìa khoá, và xoay tiếp.", flag: "met_number3" },
      { text: "Giúp nó lên dây một vòng.", reply: "Hai người cùng xoay chiếc chìa khoá. Nặng khủng khiếp. Khi xong một vòng, kẻ không mặt gật đầu — một cử chỉ gần như con người. \"Cảm ơn. Lâu lắm rồi không ai giúp tôi.\"", flag: "met_number3" },
    ],
  },
  34: {
    title: "Nét Phấn Trên Đá Rune",
    scenes: [
      "Giữa những ký tự rune phát sáng tím, có những mũi tên vẽ bằng phấn trắng. Nét phấn ngay ngắn, đều đặn. Cạnh mỗi mũi tên là một con số nhỏ: 1, 2, 3... như đánh số bài tập.\n\nỞ mũi tên thứ mười, có một dòng chữ:\n\n\"Thầy đi lối này. Các em đừng theo. Nếu có ai từ trên xuống — anh/chị ơi, làm ơn nói với lớp 5A là thầy vẫn nhớ bài.\"",
    ],
    choices: [
      { text: "Đi theo những mũi tên phấn.", reply: "Mũi tên dẫn bạn qua những hầm ngầm vắng lặng, xuống sâu hơn, sâu hơn. Nét phấn mờ dần, như tay người viết run lên. Mũi tên cuối cùng chỉ xuống dưới, và bên cạnh nó chỉ còn một vệt phấn dài, như ai đó đã đánh rơi viên phấn.", flag: "minh_trail" },
    ],
  },
  35: {
    title: "Không Ai Sống Được Ở Đây",
    scenes: [
      "Ở Tim Núi, bạn nhìn thấy chiếc gai lớn nhất từ trước tới giờ: cao như một ngọn tháp, cắm thẳng xuống miệng núi lửa. Dung nham quanh nó đứng yên, sôi sùng sục tại chỗ.\n\nKhông có làng mạc nào ở Pyrakor. Không có tàn tích. Không có cả xương. Chỉ có một trang giấy, kẹt trong khe đá bọt, cháy xém mép.",
      "\"Có những thế giới ta tới quá muộn. Ta chỉ kịp giữ lại ngọn lửa, không kịp giữ lại những người đứng trước nó. Ta vẫn ép. Ta tự nhủ: một ngọn lửa đẹp cũng đáng được giữ.\n\nTa đã bắt đầu nói dối chính mình từ lúc nào vậy?\"",
    ],
    give: { garden_page: 1 },
  },
  36: {
    title: "Nhà Vô Địch Số Mười Hai",
    speaker: "Rin", portrait: "villager",
    scenes: [
      "Ở giữa sân cát đỏ, một cô gái tóc ngắn, mặc áo giáp của Sanguis, đang vung kiếm vào không khí. Không có đối thủ. Cô vẫn đánh, vì hàng vạn khán giả đông cứng trên khán đài vẫn đang nhìn.\n\nCô thấy bạn và bật cười — tiếng cười khàn đặc của người lâu lắm không nói chuyện. \"Ê! Người Việt hả? Nhìn cái mặt là biết. Tui là Rin, Quận 8.\"",
      "\"Ở dưới đáy, tui được hỏi muốn gì. Tui nói: tui muốn được nhìn thấy. Cả đời chẳng ai nhìn tui hết.\" Cô chỉ lên khán đài. \"Giờ thì cả thế giới nhìn tui. Họ không chớp mắt. Họ không về nhà. Họ không bao giờ thôi nhìn.\"\n\n\"Mày biết cái điều kinh khủng nhất không? Tui vẫn thấy vui. Mỗi ngày. Một chút.\"",
    ],
    choices: [
      { text: "\"Chị có muốn dừng lại không?\"", reply: "Rin hạ kiếm xuống — lần đầu tiên sau không biết bao lâu. Cô nhìn khán đài rất lâu. \"Tui không biết,\" cô nói. \"Nhưng nếu mày thắng được tui ở trận cuối, thì chắc là tui sẽ phải dừng. Luật của đấu trường mà.\" Cô nháy mắt.", flag: "rin_asked" },
      { text: "Ngồi lên khán đài, cổ vũ cho chị ấy.", reply: "Bạn ngồi xuống giữa những khán giả đá, và hét to tên cô. Rin khựng lại, rồi quay lên nhìn bạn — một khán giả duy nhất còn sống. Cô cười, lần này là nụ cười thật. \"Đủ rồi,\" cô nói khẽ. \"Một người là đủ rồi.\"", flag: "cheered_rin" },
    ],
  },
  37: {
    title: "Chim Giấy Đến Muộn",
    scenes: [
      "Một con chim giấy bay loạng choạng qua lớp khí độc và rơi vào tay bạn. Cánh nó đã sờn, mép giấy cháy vàng. Loại chim Hana vẫn gấp. Dấu ngày ghi bên cánh: một ngày trước khi cô lên Đài Thiên Văn ở tầng 25.\n\nThời gian ở Vực Sâu gãy vụn. Lá thư đã bay suốt ngần ấy tầng để tới được đây.",
      "\"Nếu cậu đọc được thư này thì có lẽ tôi đã không kịp. Tôi phát hiện một điều: tất cả những kẻ không mặt đều từng là người chuyển sinh. Tất cả đều từng ƯỚC.\n\nĐiều ước không làm người ta biến mất. Nó làm người ta thành bàn tay. Bàn tay của một thứ ở dưới đáy.\n\nĐừng ước. Dù có chuyện gì. — H.\"",
    ],
    choices: [
      { text: "Gấp lại con chim giấy, cất đi.", reply: "Bạn vuốt phẳng đôi cánh và cất con chim vào túi áo trong, cạnh những thứ quý giá nhất bạn đang có.", flag: "hana_letter2" },
    ],
  },
  38: {
    title: "Rễ Nối Mọi Tầng",
    scenes: [
      "Ở Ngã Ba Rễ Chính, người Sâu Đất chỉ cho bạn thấy: có những chiếc rễ đánh dấu bằng những mảnh vải màu. Vàng là tầng 2. Đỏ là tầng 22. Xanh lá là tầng 1. Mọi chiếc rễ đều cùng đi về một hướng — xuống dưới.\n\n\"Chúng uống thời gian bị bỏ thừa,\" một bà lão Sâu Đất nói. \"Thời gian mà những chiếc gai giữ lại không biến mất. Nó chảy xuống. Cho Trái Tim.\"",
      "Hạt giống của Kaito trong túi bạn bỗng ấm lên, rồi nóng rực, như một hòn than nhỏ. Những chiếc rễ gần đó co lại, né tránh nó như né lửa.\n\nBà lão nhìn túi áo bạn, mắt mở to. \"Ngươi mang theo một thứ không bị ép. Đi đi. Đừng để rễ chạm vào nó.\"",
    ],
    choices: [
      { text: "Đặt tay lên một chiếc rễ, lắng nghe.", reply: "Qua lớp vỏ sần sùi, bạn cảm thấy một nhịp đập. Chậm. Nặng. Ở rất xa bên dưới. Mỗi nhịp là một ngụm thời gian được nuốt vào. Và bạn đếm được: nhịp đập nhanh hơn một chút so với lúc ở tầng 25.", flag: "saw_roots" },
      { text: "Tránh xa những chiếc rễ.", reply: "Bạn bước nhanh qua ngã ba. Sau lưng, những chiếc rễ cựa quậy, như một con thú đang trở mình trong giấc ngủ.", flag: "saw_roots" },
    ],
  },
  39: {
    title: "Con Búp Bê Của Lan",
    scenes: [
      "Trong Tiệm Búp Bê, giữa hàng trăm con búp bê sứ trắng toát, có một con búp bê vải nhỏ xíu, đường khâu vụng về, tóc bằng len đen. Trên váy nó thêu một chữ bằng chỉ đỏ: LAN.\n\nKhông ai ở Hollowmere làm búp bê vải.",
      "Trên bức tường cạnh đó, vẽ bằng sáp màu, là một bức tranh: một cô bé tóc hai bím, tay nắm tay một người cao lớn mặc áo choàng xám. Người kia không có mặt. Nhưng trong tranh, cô bé đã vẽ thêm cho nó một khuôn mặt tươi cười bằng bút đỏ.\n\nBên dưới: \"LAN VỚI CHÚ KHÔNG MẶT. CHÚ HIỀN LẮM.\"",
    ],
    choices: [
      { text: "Mang theo con búp bê.", reply: "Bạn phủi bụi con búp bê và cất vào túi. Khi gặp Lan, bạn sẽ trả nó cho bé.", flag: "lan_doll", give: { lan_doll: 1 } },
      { text: "Để nó lại, phòng khi bé quay về tìm.", reply: "Bạn đặt con búp bê ngồi ngay ngắn trên quầy, quay mặt ra cửa, như đang đợi ai. Rồi bạn đi tiếp, nhanh hơn.", flag: "lan_trail2" },
    ],
  },
  40: {
    title: "Hai Nhân Hai Là Bốn",
    scenes: [
      "Tiếng chuông không dứt. Trên Gác Chuông, một bóng người trong áo choàng xám đang ôm chặt sợi dây kéo chuông bằng cả hai tay. Nửa trên khuôn mặt nó nhẵn nhụi như vỏ trứng. Nửa dưới vẫn còn một cái miệng — đang lẩm nhẩm.\n\n\"...hai nhân bảy mười bốn, hai nhân tám mười sáu...\"",
      "Giọng nói ấy. Nét chữ phấn ở tầng 12. Những mũi tên ở tầng 34.\n\nĐây là thầy Minh.",
    ],
    choices: [
      { text: "\"Thầy Minh! Lớp 5A vẫn đang chờ thầy ôn bài!\"", cond: { flag: "promised_minh" }, reply: "Chiếc miệng ngừng lẩm nhẩm. Rồi, từ trên khoảng trống nhẵn nhụi, một đôi mắt từ từ hiện ra — mờ, như vẽ bằng phấn, nhưng là mắt người. \"...Lớp 5A,\" ông nói. \"Thằng Tí có còn ngồi bàn đầu không?\"\n\nÔng buông một tay khỏi dây chuông, lục túi áo, đưa cho bạn một viên phấn. \"Cầm lấy. Thầy... thầy nhớ ra rồi. Thầy phải đi xuống. Có một đứa nhỏ ở dưới kia đang một mình.\"", flag: "minh_remembered" },
      { text: "Gọi tên ông.", reply: "\"Minh? Minh là ai?\" Chiếc miệng mỉm cười lịch sự, rồi tiếp tục. \"Hai nhân chín mười tám. Hai nhân mười...\" Ông không nhớ bạn, không nhớ tên mình. Nhưng ông vẫn nhớ bảng cửu chương. Có lẽ đó là thứ cuối cùng một người thầy quên đi.", flag: "met_minh" },
    ],
  },
});
