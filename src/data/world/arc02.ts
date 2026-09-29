import { addArc } from "./arc";

addArc({
  11: {
    title: "Những Hạt Giống Không Rơi",
    scenes: [
      "Một cô bé người thỏ đang nhảy lên, cố với lấy một hạt bồ công anh lơ lửng ngay trên đầu. Cô nhảy mãi, nhảy mãi, nhưng hạt giống vẫn ở đó, cao hơn đầu ngón tay cô một chút.\n\n\"Mẹ bảo nếu bắt được hạt của mình thì mình sẽ biết mình sẽ lớn lên ở đâu,\" cô bé nói mà không nhìn bạn. \"Em bắt từ lúc em còn nhỏ xíu. Giờ em vẫn nhỏ xíu.\"",
      "Bạn với tay và lấy hạt giống xuống cho cô bé. Nó nằm im trong lòng bàn tay cô, không bay đi, không nảy mầm.\n\nTrong hốc cây gần đó, một trang giấy cũ kẹp giữa hai phiến vỏ:\n\n\"Ta đã ép được bốn mươi thế giới. Ta đặt tên cho khu vườn là Vực Sâu, vì nó ngày càng sâu. Đôi khi ta nghe thấy chúng gọi ta. Ta giả vờ như không nghe.\"",
    ],
    give: { garden_page: 1 },
  },
  12: {
    title: "Lớp Học Của Thầy Minh",
    scenes: [
      "Trên vách núi phấn, giữa những phép tính và bảng chữ cái, có một dòng chữ viết bằng tiếng Việt, nét chữ ngay ngắn của một người quen cầm phấn:\n\n\"Các em ơi, thầy phải đi xuống dưới một chuyến. Nhớ ôn bài. Thầy sẽ về.\"\n\nNhững đứa trẻ Calcis vẫn ngồi ngay ngắn trước bảng đá, tay cầm phấn, chờ.",
      "Một cậu bé giơ tay. \"Anh cũng đến từ chỗ của Thầy phải không? Anh có biết bao giờ Thầy về không?\"\n\nBạn nhớ tới cuốn nhật ký ở tầng 1. Minh. Cùng quê với bạn. Người đã nói sẽ quay lại Thánh Địa.",
    ],
    choices: [
      { text: "\"Thầy sẽ về. Anh hứa.\"", reply: "Cậu bé cười toe. Cả lớp đồng thanh đọc bảng cửu chương, to hơn, vui hơn. Bạn bước tiếp, biết rằng ở cuối tầng này có thứ gì đang chờ bạn.", flag: "promised_minh" },
      { text: "\"Anh không biết.\"", reply: "Cậu bé gật đầu như đã quen với câu trả lời đó. \"Vậy em ôn bài tiếp. Thầy về mà em quên bài thì Thầy buồn.\"" },
    ],
  },
  13: {
    title: "Lá Thư Dưới Mưa Đỏ",
    scenes: [
      "Một con chim giấy gấp ướt sũng đậu xuống vai bạn — loại chim mà Hana dùng để gửi thư. Nét chữ vội vã:\n\n\"Tôi nghe tin về tầng 12. Nếu Boss Canh Cửa có thể là người chuyển sinh... thì những người khác đâu? Kaito nói cậu là người thứ bốn mươi bảy. Vậy bốn mươi sáu người trước đã đi đâu?\"",
      "\"Tôi đã đếm được: Kaito, Minh, tôi, cậu, một ông già ở tầng 14. Còn bốn mươi mốt người nữa.\n\nĐừng tin những gì trông giống cứu rỗi. — H.\"\n\nMưa đỏ thấm vào tờ giấy, làm nhoè chữ ký.",
    ],
  },
  14: {
    title: "Lão Bảy Ở Hồ Sao",
    speaker: "Lão Bảy", portrait: "villager",
    scenes: [
      "Trong căn chòi bên hồ, một ông già gầy gò đang nướng cá. Ông nói tiếng Việt, giọng Nam Bộ đặc sệt, nhưng cứ ngập ngừng như người lâu rồi không nói.\n\n\"Người... mới hả? Ngồi đi con. Tui ở đây... bốn chục năm rồi. Hay năm chục. Ở đây không có năm.\"",
      "\"Hồi mới xuống tui cũng như con, cứ lầm lũi đi xuống. Tới đây thì tui mệt. Tui ở lại. Mà con biết sao không? Càng ở lâu càng quên. Tui quên tên vợ tui rồi. Tui chỉ nhớ bả nấu canh chua ngon lắm.\"\n\nÔng lật con cá. \"Đi tiếp đi con. Đừng ở lại chỗ nào lâu quá. Ở đây cái gì cũng giữ người ta lại.\"",
    ],
    choices: [
      { text: "\"Ông đi với con không?\"", reply: "Lão Bảy cười, lắc đầu. \"Già rồi. Mà con nhớ giùm tui một chuyện: vợ tui tên... tên...\" Ông ngừng lại rất lâu. \"Thôi. Con cứ nhớ là bả nấu canh chua ngon.\"", flag: "met_bay" },
      { text: "Ngồi ăn cá với ông.", reply: "Hai người ngồi ăn cá nướng bên hồ sao, không nói gì. Lúc bạn đứng dậy, ông dúi vào tay bạn một túi nhỏ. \"Hạt giống. Tui mang theo từ nhà. Không biết còn mọc không.\"", flag: "met_bay", give: { seed_rice: 3 } },
    ],
  },
  15: {
    title: "Mầm Hỏi",
    scenes: [
      "Đêm đó bạn ngủ trên mai rùa, nghe tiếng tim nó đập chậm rãi. Trong mơ, bạn thấy mình ở Thánh Địa. Mầm ngồi bên cạnh, hai chiếc lá cụp xuống.\n\n\"Cậu ơi, cậu có nhớ tên mẹ cậu không?\"",
      "Bạn mở miệng định trả lời. Và bạn nhận ra mình phải nghĩ một lúc mới nhớ ra.\n\nMầm gật đầu, như đã biết. \"Tớ hỏi vì... tớ cũng từng có một người mẹ. Tớ quên tên bà rồi. Tớ nghĩ ở đây, ai rồi cũng quên.\"\n\n\"Cậu đừng quên nhé. Hứa với tớ đi.\"",
    ],
    choices: [
      { text: "Nói to tên mẹ mình.", reply: "Bạn nói to cái tên ấy. Mầm lặp lại theo, từng âm một, cẩn thận như học thuộc một bài thơ. \"Tớ sẽ nhớ giùm cậu,\" nó nói.", flag: "told_mam_name" },
      { text: "\"Tại sao cậu quên?\"", reply: "Mầm im lặng rất lâu. \"Vì có người muốn tớ quên,\" nó nói, rồi giấc mơ tan biến." },
    ],
  },
  16: {
    title: "Hãy Nhớ Tên Em",
    speaker: "Suri", portrait: "villager",
    scenes: [
      "Một cô gái du mục chặn ngựa trước mặt bạn. \"Người từ trên xuống. Tôi là Suri. Tộc tôi hát tên người chết để họ không biến mất. Nhưng tôi là người hát cuối cùng.\"",
      "\"Nếu tôi chết — hoặc nếu tôi cứ đứng yên thế này mãi — sẽ không còn ai hát tên tôi. Anh là người lạ, anh sẽ đi rất xa. Anh có thể mang tên tôi theo không?\"",
    ],
    choices: [
      { text: "\"Suri. Tôi sẽ nhớ.\"", reply: "Suri buộc vào cổ tay bạn một sợi dây thắt nút. \"Mỗi nút là một người. Nút cuối là tôi.\" Cô quay ngựa về phía gió, bắt đầu hát.", flag: "remember_suri", give: { sig_f16: 1 } },
      { text: "\"Tôi không hứa được.\"", reply: "Suri gật đầu. \"Ít nhất anh thành thật.\" Cô vẫn hát tên bạn một lần — dù bạn chưa từng nói tên mình cho cô." },
    ],
  },
  17: {
    title: "Bốn Mươi Sáu Tấm Gương",
    scenes: [
      "Ở trung tâm mê cung có một căn phòng tròn với bốn mươi bảy tấm gương. Bốn mươi sáu tấm phản chiếu những người lạ: một cô gái mặc đồng phục học sinh, một ông già đeo kính, một người lính cứu hoả, một bà mẹ ôm con…\n\nTấm thứ bốn mươi bảy phản chiếu bạn.",
      "Bạn nhận ra vài khuôn mặt: Kaito, tấm thứ nhất. Minh. Hana. Lão Bảy. Những tấm khác bạn chưa gặp — nhưng dưới mỗi tấm có khắc một con số tầng.\n\nMột số tấm gương đã nứt. Dưới chúng không có số nào cả.",
    ],
    choices: [
      { text: "Ghi lại các con số tầng.", reply: "Bạn chép lại danh sách. Tầng 12, tầng 27, tầng 40, tầng 55, tầng 66... Có những tầng lặp lại nhiều lần. Có những người dường như đang ở cùng một chỗ.", flag: "mirror_list" },
      { text: "Chạm vào một tấm gương nứt.", reply: "Mảnh gương lạnh buốt. Trong một thoáng bạn nghe thấy tiếng ai đó thì thầm bằng tiếng Việt: \"...đừng ước...\" Rồi im lặng.", flag: "mirror_whisper" },
    ],
  },
  18: {
    title: "Những Bông Hoa Không Ép",
    scenes: [
      "Giữa hồ sen, một bông sen duy nhất đã héo. Cánh hoa rũ xuống, nâu đi, rơi xuống nước. Nó là thứ duy nhất ở Padmavar đang thay đổi.\n\nMột tu sĩ già ngồi bên cạnh nó, mắt mở. Ông là người duy nhất không ngủ.",
      "\"Bông hoa này, Người Làm Vườn đã bỏ qua,\" ông nói. \"Ta không biết vì sao. Ta ngồi đây ngắm nó héo từng ngày, và ta nhận ra đó là thứ đẹp nhất ta từng thấy.\"\n\nDưới đài sen có một trang giấy:\n\n\"Có những bông hoa ta không nỡ ép. Ta để chúng héo. Mỗi lần như thế ta khóc cả trăm năm. Ta không hiểu vì sao ta lại làm vậy.\"",
    ],
    give: { garden_page: 1 },
  },
  19: {
    title: "Kẻ Ép Hoa",
    scenes: [
      "Bài hát của cá voi đột ngột ngừng. Giữa những chiếc xương sườn, kẻ không mặt lại xuất hiện — lần này nó không biến mất. Nó giơ tay về phía bạn, nhẹ nhàng như muốn vuốt tóc một đứa trẻ.\n\nNhững chiếc gai trong túi bạn lạnh buốt, và bạn cảm thấy chân mình chậm lại, chậm lại...",
    ],
    choices: [
      { text: "Rút vũ khí!", reply: "Bạn vung vũ khí. Lưỡi thép xuyên qua chiếc áo choàng xám như xuyên qua khói. Kẻ không mặt lùi lại, nghiêng đầu — lần này có vẻ tò mò hơn là tức giận — rồi tan vào bóng tối giữa những bộ xương.\n\nChân bạn nhúc nhích lại được. Trên nền cát, nó để lại một chiếc lông vũ xám.", flag: "fought_presser" },
      { text: "Đứng yên, nhìn thẳng vào nó.", reply: "Bạn nhìn vào khoảng trống nơi lẽ ra là khuôn mặt. Và trong một khoảnh khắc, bạn thấy — không phải khuôn mặt, mà là một ký ức: một căn bếp, mùi canh, một người phụ nữ quay lưng lại. Kẻ không mặt run lên, rồi biến mất.\n\nNó đã từng là người.", flag: "saw_presser_memory" },
    ],
  },
  20: {
    title: "Sự Cứu Rỗi",
    speaker: "Đại Tư Tế", portrait: "nomad",
    scenes: [
      "Đại Tư Tế của Aeterna tiếp bạn trong ngôi đền thờ Người Làm Vườn. Trên tường là những bức tranh vẽ một bóng người khổng lồ nâng niu các thế giới trong lòng bàn tay như những đoá hoa.\n\n\"Ngươi mang gai trong túi. Ngươi đang rút đinh khỏi các thế giới. Ngươi có biết mình đang làm gì không?\"",
      "\"Người Làm Vườn yêu chúng ta. Người không để chúng ta chết. Ở đây không ai già, không ai đói, không ai phải khóc tiễn con. Ngươi muốn phá vỡ điều đó để làm gì? Để chúng ta được chết?\"\n\nÔng mở rộng hai tay. \"Ở lại đây. Làm dân của Aeterna. Ngươi sẽ không bao giờ phải mất gì nữa.\"",
    ],
    choices: [
      { text: "\"Không mất gì, cũng là không có gì.\"", reply: "Đại Tư Tế nhìn bạn rất lâu. \"Ngươi nói giống hệt người thứ nhất,\" ông nói. \"Hắn cũng đi xuống. Hắn cũng hối hận.\"", flag: "refused_aeterna" },
      { text: "\"Có thể ông đúng.\"", reply: "\"Tất nhiên ta đúng.\" Ông đặt tay lên vai bạn. \"Khi nào mệt, hãy nhớ Aeterna vẫn ở đây. Mãi mãi.\"", flag: "doubt_aeterna" },
    ],
  },
});
