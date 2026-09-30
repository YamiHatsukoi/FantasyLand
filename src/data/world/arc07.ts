import { addArc } from "./arc";

addArc({
  61: {
    title: "Những Khuôn Mặt Dưới Băng",
    scenes: [
      "Bạn quỳ xuống mặt hồ và lau lớp sương giá. Ngay bên dưới, cách bạn một gang tay băng, là khuôn mặt một người đàn ông trung niên đeo kính, cà vạt lệch. Cạnh ông là một cô sinh viên đeo tai nghe. Rồi một ông cụ. Rồi một em bé còn quấn tã.\n\nHọ không chết. Môi họ vẫn hồng. Họ đang ngủ, và dòng sông đã ngừng chảy.",
      "Một người câu cá Crystalmere ngồi cạnh lỗ khoan, lắc đầu. \"Mấy tháng nay họ tới nhiều quá. Sông tắc. Họ kẹt ở đây, chờ tới lượt xuống.\"\n\n\"Xuống đâu?\"\n\nÔng chỉ cần câu xuống dưới, không nói gì.",
    ],
    choices: [
      { text: "Khoan một lỗ, cố kéo một người lên.", reply: "Bạn khoan tới khi tay rớm máu. Khi mũi khoan chạm tới bàn tay người đàn ông đeo kính, ông khẽ cử động ngón tay — như người đang ngủ mơ. Rồi băng liền lại ngay trước mắt bạn.\n\nKhông phải bằng sức. Bạn sẽ cần một cách khác.", flag: "tried_ice" },
      { text: "Ghi nhớ khuôn mặt họ.", reply: "Bạn đi dọc mặt hồ, nhìn từng khuôn mặt một, cho tới khi mắt mờ đi. Bạn không thể nhớ hết. Nhưng bạn nhớ được bốn mươi bảy khuôn mặt. Đó là một khởi đầu.", flag: "remember_faces" },
    ],
  },
  62: {
    title: "Lời Đề Nghị Trong Hư Không",
    scenes: [
      "Ở giữa Khoảng Trắng, không có gì để nhìn, không có gì để nghe. Rồi giọng nói tới — không từ đâu cả, từ mọi nơi.\n\n\"Ngươi đã đi sáu mươi hai tầng. Ta đã nhìn ngươi từ tầng một. Ngươi ngã, ngươi đứng dậy, ngươi khóc, ngươi cười. Ta chưa từng thấy ai đi như ngươi.\"",
      "\"Ta có thể cho ngươi về. Ngay bây giờ. Không phải tầng một trăm, không phải một khoảnh khắc ép phẳng — mà thật sự. Về căn bếp ấy. Về bát canh ấy. Chỉ cần ngươi nói: 'Tôi ước.'\"\n\nHư không im lặng, chờ đợi. Bạn nhận ra mình đang run.",
    ],
    choices: [
      { text: "\"Còn Lan? Còn những người dưới băng?\"", reply: "Hư không im lặng rất lâu. \"Họ... cũng sẽ được giữ lại,\" giọng nói trả lời, và lần đầu tiên, nó ngập ngừng. \"Ta sẽ giữ tất cả. Không ai phải mất ai nữa.\"\n\nĐó chính là câu trả lời bạn cần.", flag: "refused_heart_2" },
      { text: "\"Tôi không ước.\"", reply: "\"...Ngươi sẽ.\" Giọng nói rút đi như thuỷ triều. Nhưng trước khi tắt hẳn, bạn nghe thấy một điều lạ — một tiếng thở dài rất nhỏ, như của một cô bé mệt mỏi.", flag: "refused_heart_2" },
    ],
  },
  63: {
    title: "Vị Vua Và Đồng Tiền",
    scenes: [
      "Trên Ngai Vàng Ròng, xác ướp Pharaoh ngồi đếm một đồng tiền vàng. Một đồng duy nhất. Ông lật nó, đếm, lật lại, đếm lại. \"Một. Một. Một.\"\n\nMột người thợ đào mộ Aurumhet thì thầm: \"Ông ấy có cả núi vàng mà chỉ đếm mỗi đồng đó. Người ta nói đó là đồng tiền đầu tiên ông kiếm được, hồi còn là một cậu bé chăn dê.\"",
    ],
    choices: [
      { text: "Đặt thêm một đồng xu của bạn vào tay ông.", reply: "Xác ướp dừng lại. Ông nhìn hai đồng tiền trong lòng bàn tay — một đồng vàng, một đồng xu đồng lấm lem của bạn. \"...Hai,\" ông nói. Giọng ông khàn như cát. \"Hai.\"\n\nLần đầu tiên sau hàng nghìn năm, ông đếm được một số mới.", flag: "gave_coin" },
      { text: "Lặng lẽ rời đi.", reply: "Tiếng \"một, một, một\" đuổi theo bạn qua những hành lang vàng rực, cho tới khi nó hoà lẫn vào tiếng bước chân của chính bạn." },
    ],
  },
  64: {
    title: "Phòng Giam Của Kaito",
    scenes: [
      "Ở cuối Dãy Giam Tử Tù, có một phòng giam trống. Trên vách đá, ai đó đã khắc hàng trăm vạch đếm ngày, và một dòng chữ tiếng Nhật, bên dưới dịch ra tiếng Việt bằng nét chữ khác:\n\n\"Tôi rút gai ở tầng 3, 5, 9. Chúng bắt tôi. Tôi trốn được. — Kaito\"\n\"(Anh ấy dạy tôi tiếng Việt để trả công dịch. — M.)\"",
      "Dưới cùng, một dòng nhỏ hơn, của Kaito:\n\n\"Nếu có ai đọc được: gai không phải thứ xấu. Gai là nỗi sợ của một người. Đừng ghét người sợ hãi. Hãy dạy họ cách buông tay.\"",
    ],
    choices: [
      { text: "Mở tất cả các phòng giam.", reply: "Bạn tìm thấy chùm chìa khoá gỉ trong Phòng Đồ Tịch Thu và mở từng cánh cửa một. Những tù nhân bước ra, ngơ ngác, tay vẫn nắm chặt những chiếc gai đã rút. Một bà lão người cá nắm tay bạn: \"Chúng tôi sẽ đi lên. Nếu có ai cần giúp rút gai, chúng tôi sẽ ở đó.\"", flag: "freed_prisoners" },
      { text: "Khắc thêm một dòng bên dưới.", reply: "Bạn khắc: \"Đã đọc. Tôi đang đi xuống. — 47.\" Nét khắc của bạn nằm cạnh nét của Kaito và thầy Minh, như ba người bạn đi cùng một con đường.", flag: "carved_47" },
    ],
  },
  65: {
    title: "Kính Viễn Vọng Thứ Hai",
    scenes: [
      "Ở Nơi Nhìn Thấy Tầng 25, có một chiếc kính viễn vọng bằng đồng, to hơn cả chiếc ở Đài Thiên Văn trên kia. Bạn ghé mắt nhìn — và thấy chính căn phòng ấy. Thấu kính. Chiếc bàn. Hana, đứng im, chiếc khăn của bạn trên vai.\n\nNhưng từ góc này, bạn thấy điều mà từ bên trên không thấy được: Hana không nhìn xuống đáy. Cô ấy đang nhìn thẳng về phía bạn.",
    ],
    choices: [
      { text: "Mở sổ tay của Hana, tìm trang có hình mũi tên.", cond: { has: "hana_notebook" }, reply: "Trang có hình mũi tên là trang cuối cùng Hana viết trước khi bị ép — mặt sau của trang bạn đã đọc. Cô viết: \"Nếu tôi bị ép, đừng rút gai — không có gai. Hãy trả lại tôi thứ tôi đang nhìn. Tôi sẽ nhìn lên trời. Hãy cho tôi thấy một ngôi sao mà tôi chưa đếm.\"\n\nBạn lấy bút, vẽ một ngôi sao mới vào bản đồ sao của cô — ngôi sao của tầng 65 — và giơ nó trước ống kính.\n\nỞ tầng 25, rất xa phía trên, một ngón tay khẽ cử động.", flag: "hana_signal" },
      { text: "Vẫy tay với cô ấy.", reply: "Bạn vẫy tay, cảm thấy mình thật ngốc. Hana không cử động. Nhưng bạn tin, bằng một cách nào đó, cô ấy biết bạn vẫn đang đi.", keep: true },
    ],
  },
  66: {
    title: "Nghi Thức Trả Lại",
    scenes: [
      "Trong Kho Cấm, một cuốn sách bay chậm rãi tới trước mặt bạn và tự mở ra ở trang cuối. Chữ viết run rẩy, như được viết trong khi tháp đang nổ.\n\n\"Người bị ép không cần bị rút gai. Họ cần được trả lại khoảnh khắc họ đang nhìn khi thời gian dừng. Người mẹ đang nhìn con: hãy cho bà thấy con. Người lính đang nhìn cờ: hãy cho anh thấy cờ. Khi được trả lại, họ sẽ nhớ ra mình đang sống.\"",
      "Bên dưới, trên một tấm bia nhỏ ở góc phòng — cùng loại đá với danh mục ở tầng 46 — một dòng chữ mới khắc:\n\n\"Mẫu vật 101: Trái Đất — đang ép. Tiến độ: 19%.\"",
    ],
    choices: [
      { text: "Ghi nhớ nghi thức.", reply: "Bạn chép nghi thức vào sổ, từng chữ một. Mười chín phần trăm. Bạn không còn nhiều thời gian — nhưng giờ bạn đã có một cách.", flag: "knows_unpress" },
    ],
  },
  67: {
    title: "Giọt Mật Hạnh Phúc Nhất",
    scenes: [
      "Nữ Hoàng Ong đưa cho bạn một giọt mật vàng óng trên chiếc thìa bằng cánh hoa. \"Mỗi vị khách được một giọt,\" bà nói. \"Giọt này giữ khoảnh khắc hạnh phúc nhất đời ngươi. Ngươi sẽ được sống lại nó. Mãi mãi, nếu ngươi muốn.\"",
    ],
    choices: [
      { text: "Nếm thử một chút.", reply: "Vị ngọt tràn ra trong miệng — và bạn đang ở đó. Bữa cơm tối. Tiếng tivi. Mẹ gắp cho bạn miếng cá ngon nhất. Ba càu nhàu về giá xăng. Bạn cười.\n\nBạn phải dùng hết ý chí để nhả nó ra. Khi mở mắt, má bạn ướt đẫm. Nữ Hoàng nhìn bạn với vẻ kinh ngạc. \"Chưa ai nhả ra được,\" bà nói.", flag: "tasted_honey", give: { sig_f67: 2 } },
      { text: "\"Tôi muốn có những khoảnh khắc mới hơn.\"", reply: "Nữ Hoàng Ong đặt chiếc thìa xuống. Rất lâu. \"Những khoảnh khắc mới,\" bà lặp lại, như thử nếm một từ lạ. \"Ta đã quên mất vị của chúng.\" Bà cho phép bạn đi qua vương quốc mà không phải trả giá gì.", flag: "refused_honey" },
    ],
  },
  68: {
    title: "Những Mảnh Vụn Trôi",
    scenes: [
      "Trôi lềnh bềnh trong bể dịch, bạn nhận ra những mảnh vụn. Một góc mái Chùa Không Chuông ở tầng 8. Một cánh buồm của đoàn lữ hành tầng 2. Một chiếc đèn lồng đầm lầy tầng 3 — tắt ngấm.\n\nVà rồi, một thứ khiến bạn lạnh sống lưng: một tấm biển xanh lá cây quen thuộc. Chữ trắng. Tên một con phố ở quê bạn.",
    ],
    choices: [
      { text: "Vớt tấm biển lên.", reply: "Axit ăn cháy găng tay bạn khi bạn kéo tấm biển lên bờ. Nó đã mòn một nửa. Nhưng bạn vẫn đọc được tên phố — con phố bạn đi qua mỗi ngày. Trái Đất đang được tiêu hoá, từng mảnh một, ngay lúc này.", flag: "abyss_hungry" },
    ],
  },
  69: {
    title: "Trái Tim Giả",
    scenes: [
      "Hàng trăm kẻ không mặt quỳ quanh trái tim khổng lồ, lẩm nhẩm điều ước của họ. Không ai trả lời. Trái tim chỉ đập, đập, đập.\n\nMột kẻ không mặt ở hàng cuối quay lại nhìn bạn. \"Tới rồi,\" nó thì thầm. \"Cuối cùng cũng tới đáy rồi. Ước đi. Nó sẽ nghe.\"",
      "Nhưng Hana đã nói: tầng 100. Và nhịp đập này sai — nhanh hơn, rỗng hơn nhịp đập bạn nghe qua rễ cây ở tầng 38.\n\nTrên bệ thờ, một trang giấy được ép cẩn thận:\n\n\"Ta tạo ra trái tim này để những kẻ đi xuống dừng lại ở đây. Họ sẽ ước với nó và không có gì xảy ra. Họ sẽ thất vọng, nhưng họ sẽ được an toàn — xa khỏi ta. Đó là lòng tốt cuối cùng ta còn làm được.\"",
    ],
    choices: [
      { text: "Nói với những kẻ quỳ: \"Đây không phải đáy.\"", reply: "Vài kẻ không mặt ngẩng lên. Hầu hết không nghe. Nhưng ba người đứng dậy, và lặng lẽ đi theo bạn một đoạn, trước khi tan vào bóng tối. Có lẽ họ sẽ đi lên. Có lẽ họ sẽ đi xuống. Ít nhất, họ đã đứng dậy.", flag: "woke_kneelers", give: { garden_page: 1 } },
      { text: "Lặng lẽ đi qua.", reply: "Bạn đi qua đám đông quỳ gối, không nhìn lại. Trang giấy trên bệ thờ nằm gọn trong túi bạn.", give: { garden_page: 1 } },
    ],
  },
  70: {
    title: "Cổng Sao Mở",
    speaker: "Hana", portrait: "hana",
    scenes: [
      "Cổng sao giữa quảng trường Stellaris xoay chầm chậm, và qua nó, bạn nhìn thấy những bầu trời — hàng trăm bầu trời, của hàng trăm đài thiên văn. Người Giữ Cổng đã tránh sang một bên.\n\nMột trong những bầu trời ấy là bầu trời tầng 25.",
    ],
    choices: [
      { text: "Giơ bản đồ sao có ngôi sao mới qua cổng, gọi tên Hana.", cond: { all: [{ flag: "hana_signal" }, { flag: "knows_unpress" }] }, reply: "Bạn gọi tên cô, to hết cỡ. Qua cổng sao, bạn thấy Hana chớp mắt — một lần, hai lần. Cô nhìn ngôi sao mới trên trang giấy, và môi cô mấp máy đếm: \"...Một trăm lẻ hai.\"\n\nRồi cô bước qua cổng, loạng choạng, và ngã vào vòng tay bạn. Cơ thể cô ấm. Tay trái cô không còn run nữa.\n\n\"Cậu đi chậm quá,\" Hana nói, giọng khàn đặc, và bật khóc. \"Tôi đã đếm được bốn nghìn ngôi sao để chờ cậu.\"\n\nCô lau nước mắt, chỉnh lại chiếc khăn trên vai. \"Được rồi. Ba mươi tầng nữa. Lần này tôi đi cùng.\"", flag: "hana_free", recruit: "hana" },
      { text: "Gọi tên Hana.", reply: "Bạn gọi tên cô qua cổng sao. Hana không cử động. Có lẽ cần một điều gì đó hơn là giọng nói — một thứ để cô nhìn vào, một cách để cô nhớ lại. Người Giữ Cổng lắc đầu buồn bã: \"Cổng sẽ còn mở. Khi ngươi sẵn sàng, hãy quay lại.\"", flag: "hana_called", keep: true },
    ],
  },
});
