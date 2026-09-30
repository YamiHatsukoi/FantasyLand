import { addArc } from "./arc";

addArc({
  71: {
    title: "Sợi Chỉ Đỏ",
    scenes: [
      "Ở Giếng Chỉ Đỏ, bạn tìm thấy một cuộn chỉ đỏ buộc vào miệng giếng. Sợi chỉ chạy dài vào mê cung, qua hàng trăm ngã rẽ. Có người đã buộc nó để tìm đường về.\n\nBên cạnh, khắc trên đá bằng mũi dao: \"Sợi chỉ này dẫn tới trung tâm. Người ở trung tâm không phải quái vật. — Kaito.\"",
    ],
    choices: [
      { text: "Lần theo sợi chỉ.", reply: "Sợi chỉ dẫn bạn qua những hành lang tối, rẽ trái, rẽ phải, cho tới một căn phòng nhỏ ở trung tâm. Trên tường có hình vẽ một cậu bé có sừng đang ngồi cạnh một người đàn ông đội mũ lưỡi trai, cả hai cùng cười. Kaito đã ở đây. Anh đã nói chuyện với 'quái vật'.", flag: "followed_thread" },
      { text: "Cắt một đoạn chỉ, mang theo.", reply: "Bạn cắt một đoạn chỉ đỏ và buộc vào cổ tay, cạnh sợi dây thắt nút Suri tặng. Hai sợi dây, hai lời hứa. Có lẽ bạn sẽ cần tìm đường về.", flag: "red_thread", give: { sig_f71: 1 } },
    ],
  },
  72: {
    title: "Cuốn Sách Của Bạn",
    scenes: [
      "Trên kệ cuối cùng của Babelis, có một cuốn sách mang tên bạn. Nó dày cộp. Bạn mở ra: đêm mưa. Chiếc ô bị lật. Chiếc áo mưa vàng. Rồi Thánh Địa, Mầm, Lyra, Kaito, Hana, Lan... Từng trang, từng tầng.\n\nTrang cuối cùng bạn đọc được là trang bạn đang sống. Trang tiếp theo trắng tinh.",
      "Nhưng không hoàn toàn trắng. Ở chính giữa, mờ như dấu nước, có một dòng chữ viết ngược, như nhìn qua gương:\n\n\".cớưđ gnừĐ\"\n\nBạn biết đọc nó. Bạn đã nghe nó bốn lần.",
    ],
    choices: [
      { text: "Viết tiếp một dòng vào trang trắng.", reply: "Bạn cầm bút lông ngỗng trên bàn, viết: \"Tôi sẽ không ước. Tôi sẽ tìm cách khác.\" Mực thấm vào giấy, và cuốn sách khẽ rung lên — như một người vừa thở phào.", flag: "wrote_own_page" },
      { text: "Gấp sách lại, đặt về kệ.", reply: "Bạn đặt cuốn sách về chỗ cũ. Có những câu chuyện không nên đọc trước đoạn kết." },
    ],
  },
  73: {
    title: "Ngọn Đèn Đầu Tiên",
    scenes: [
      "Dưới gốc Cây Nấm Mẹ — cây nấm đầu tiên phát sáng — có một đứa trẻ đang ngủ, cuộn tròn trên lớp rêu. Nó không phải người Lumenwood. Nó mặc bộ đồ ngủ in hình khủng long, và ôm một con gấu bông.\n\nMột đốm sáng khác, lạc khỏi dòng sông linh hồn, đã trôi tới đây và dừng lại dưới ngọn đèn.",
    ],
    choices: [
      { text: "Đánh thức đứa trẻ.", reply: "Đứa trẻ dụi mắt, nhìn bạn, rồi nhìn quanh khu rừng xanh ngọc. \"Đẹp quá,\" nó thì thầm, rồi lại nhắm mắt. Nhưng lần này, nó mỉm cười trong giấc ngủ, và thân thể nó mờ dần, nhẹ dần, như một đốm sáng bay lên — lên, không phải xuống.\n\nCó những người vẫn có thể về được.", flag: "sent_child_up" },
      { text: "Để yên cho nó ngủ.", reply: "Bạn đắp cho đứa trẻ một chiếc lá nấm to như chăn. Cây Nấm Mẹ sáng lên dịu dàng hơn, như cảm ơn.", flag: "tucked_child" },
    ],
  },
  74: {
    title: "Tên Mẹ Của Mầm",
    scenes: [
      "Giữa Bão Nhớ, những hạt cát xoáy quanh bạn, và mỗi hạt thì thầm một mảnh ký ức. Bạn nghe thấy tên vợ của lão Bảy. Bạn nghe thấy tiếng cười của cậu bé lớp 5A. Bạn nghe thấy tên thật của Số Ba.\n\nVà rồi, một cái tên được thì thầm bằng giọng một cô bé: \"Mẹ ơi. Mẹ Iris.\"",
      "Iris. Tên mẹ của Người Làm Vườn. Tên mà Mầm đã quên — tên mà bà đã cố tình quên, để khỏi phải nhớ.",
    ],
    choices: [
      { text: "Hứng lấy hạt cát mang cái tên ấy.", reply: "Bạn nắm chặt hạt cát trong tay. Nó ấm, và nhẹ, và khi bạn mở tay ra, nó đã thành một bông diên vĩ nhỏ xíu màu tím.\n\nBạn cẩn thận cất nó đi. Có một người ở dưới đáy cần được nghe lại cái tên này.", flag: "knows_iris", give: { iris_flower: 1 } },
    ],
  },
  75: {
    title: "Nếu Bạn Ước",
    scenes: [
      "Thánh Địa. Nhà Chính. Ruộng lúa vàng. Mọi người dân bạn biết đều ở đây, tươi cười, đứng im trong nắng chiều. Họ không trả lời khi bạn gọi.\n\nỞ giữa quảng trường, có một người đang ngồi trên ghế đá, mặc quần áo của bạn, mang khuôn mặt của bạn — nhưng khuôn mặt ấy phẳng lặng, không một nếp nhăn lo âu, không một tia sáng trong mắt.",
      "\"Chào,\" phiên bản kia nói, giọng êm như nước. \"Tôi là bạn, nếu bạn ước. Nhìn xem — không ai chết. Không ai đi. Không có đêm mưa nào nữa.\"\n\n\"Ở đây không có Mầm. Mầm là hy vọng. Ở đây không ai cần hy vọng nữa.\"",
    ],
    choices: [
      { text: "\"Nơi này không có ai sống cả.\"", reply: "Phiên bản kia nghiêng đầu, như không hiểu câu hỏi. \"Sống là gì?\" Bạn quay lưng bước đi. Sau lưng, buổi chiều vàng vẫn không tắt, và bạn chưa bao giờ ghét màu vàng tới vậy.", flag: "rejected_copy" },
      { text: "Ngồi xuống cạnh nó một lúc.", reply: "Bạn ngồi cạnh chính mình, ngắm hoàng hôn không bao giờ tắt. Thật yên bình. Thật dễ chịu. Thật dễ để ở lại.\n\nBạn đứng dậy trước khi quá muộn. Đôi chân bạn nặng như đá.", flag: "felt_copy" },
    ],
  },
  76: {
    title: "Trời Trong",
    scenes: [
      "Trong Mắt Lốc Lặng, những người diều Cyclonar đang ngửa mặt nhìn lên. Qua khe hở giữa những cột gió, có một mảnh trời xanh — mảnh trời trong đầu tiên họ thấy sau một nghìn năm.\n\n\"Người từ trên xuống,\" một cô bé người diều hỏi, \"trời trong trông như thế nào?\"",
    ],
    choices: [
      { text: "Kể cho cô bé nghe về bầu trời Trái Đất.", reply: "Bạn kể: trời xanh, mây trắng như bông, buổi sáng có chim sẻ đậu trên dây điện, buổi chiều có diều giấy bay trên đê. Cả làng người diều im lặng lắng nghe.\n\n\"Diều giấy,\" cô bé lặp lại, mắt sáng rỡ. \"Ở chỗ anh cũng có diều à?\"\n\n\"Có. Rất nhiều.\"", flag: "told_sky" },
    ],
  },
  77: {
    title: "Quay Lại Không Phải Giữ Lại",
    scenes: [
      "Ở Giây Đầu Tiên, mọi thứ trong Retrogrado sắp chạm tới điểm khởi đầu. Một người đàn ông già — hay trẻ, khó nói ở nơi thời gian chạy ngược — ngồi ôm hai cánh tay trống rỗng.\n\n\"Ta đã quay lại để ôm con gái lâu hơn,\" ông nói. \"Ta được ôm nó. Rồi nó nhỏ dần trong tay ta. Rồi không còn gì.\"",
      "Ông nhìn lên bạn. \"Ngươi đang đi tìm cách cứu một thế giới phải không? Đừng quay lại. Đừng dừng lại. Hãy để nó đi tiếp. Thứ duy nhất tệ hơn một kết thúc buồn, là không có kết thúc nào cả.\"",
    ],
    choices: [
      { text: "\"Cảm ơn ông.\"", reply: "Ông lão gật đầu. Rồi, lần đầu tiên, thời gian quanh ông chạy xuôi — một giây, hai giây. Ông già đi một chút, và ông mỉm cười vì điều đó.", flag: "lesson_forward" },
    ],
  },
  78: {
    title: "Cô Bé Ôm Hoa",
    scenes: [
      "Ở Điện Thờ Chính, tượng một cô bé ôm bông hoa đứng giữa những ngọn nến đã tắt từ hàng nghìn năm. Khuôn mặt tượng được tạc rất kỹ: đôi mắt to, cái mũi hếch, và một nụ cười hơi lệch về bên trái.\n\nBạn đã thấy nụ cười ấy. Trong tia chớp ở tầng 21. Trong giấc mơ bào tử ở tầng 43.",
      "Dưới chân tượng, khắc bằng một thứ chữ cổ mà bạn đọc được như mọi thứ khác ở Vực Sâu:\n\n\"Tặng cô bé làm vườn nhà bên — người đã làm cho làng ta nở hoa. Cầu cho em không bao giờ phải buồn.\"\n\nLời cầu nguyện ấy, có lẽ, đã là chiếc gai đầu tiên.",
    ],
    choices: [
      { text: "Thắp lại một ngọn nến.", reply: "Ngọn nến bén lửa ngay lần quẹt đầu tiên, như đã chờ sẵn. Ánh sáng vàng ấm hắt lên khuôn mặt tượng. Trong một thoáng, bạn có cảm giác nụ cười lệch kia hơi rung lên.", flag: "lit_shrine" },
      { text: "Đặt một bông hoa dưới chân tượng.", reply: "Bạn đặt một bông hoa dại hái từ tầng trên xuống chân tượng. Nó sẽ héo. Đó là điều tự nhiên. Và bạn nghĩ, cô bé này cần được nhìn thấy một bông hoa héo đi mà không có gì tồi tệ xảy ra.", flag: "left_flower" },
    ],
  },
  79: {
    title: "Nỗi Sợ Đầu Tiên",
    scenes: [
      "Ở Gai Đầu Tiên — chiếc gai già nhất Vực Sâu, xù xì như một thân cây cổ thụ — có một bông hoa nhỏ xíu, héo khô, bị kẹp giữa hai chiếc gai non. Bông hoa đầu tiên cô bé thấy héo. Nó đã ở đây, giữa rừng gai, từ trước khi có bất cứ tầng nào.",
      "Một trang giấy nằm cạnh bông hoa, nét chữ tròn trịa của trẻ con, khác hẳn nét chữ nghiêng nghiêng quen thuộc:\n\n\"Hoa ơi, đừng héo. Tớ sẽ tưới cho cậu mỗi ngày. Tớ sẽ hát cho cậu nghe. Tớ sẽ không bao giờ để cậu đi đâu.\"\n\nĐó là trang đầu tiên của Sổ Tay Người Làm Vườn. Được viết khi bà mới bảy tuổi.",
    ],
    choices: [
      { text: "Cầm trang giấy đầu tiên.", reply: "Bạn gấp trang giấy cẩn thận. Bảy tuổi. Bằng tuổi Lan.", flag: "first_page", give: { garden_page: 1 } },
    ],
  },
  80: {
    title: "Phán Quyết",
    scenes: [
      "Bốn mươi sáu kẻ không mặt ngồi quanh bạn trên những hàng ghế đá. Không ai nói gì. Rồi, từng người một, họ đứng dậy.\n\nSố Ba, với chiếc đồng hồ nhựa. Rin, thanh kiếm vẫn trong tay. Số Chín, nửa thân mình đã tan. Người thứ nhất, với cuốn sách ép hoa ôm trước ngực.",
      "\"Chúng tôi không thể phán xét cậu,\" Người thứ nhất nói. \"Chúng tôi chỉ có thể nói cho cậu biết điều chúng tôi đã học được. Điều ước không phải cái bẫy vì bà ấy ác. Nó là cái bẫy vì bà ấy chỉ biết giữ. Cậu phải cho bà ấy thấy một cách khác.\"\n\n\"Chúng tôi sẽ không cản đường cậu. Và nếu cậu cần — chúng tôi ở đây.\"",
    ],
    choices: [
      { text: "Gọi tên từng người mà bạn biết.", reply: "\"Số Ba. Rin. Số Chín. Thầy Minh. Người thứ nhất.\" Mỗi cái tên bạn gọi, một kẻ không mặt khẽ run lên. Ở chỗ trống trên mặt Rin, một nụ cười mờ nhạt hiện ra.\n\n\"Nhớ tên chúng tôi đấy,\" Rin nói. \"Tới dưới đó thì hét to lên cho bà ấy nghe.\"", flag: "court_parted" },
      { text: "Cúi đầu chào họ.", reply: "Bạn cúi đầu thật sâu. Bốn mươi sáu kẻ không mặt cúi đầu đáp lại. Rồi họ dạt sang hai bên, mở ra một lối đi dẫn tới cánh cửa xuống.", flag: "court_parted" },
    ],
  },
});
