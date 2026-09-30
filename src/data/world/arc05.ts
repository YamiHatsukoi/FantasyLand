import { addArc } from "./arc";

addArc({
  41: {
    title: "Ngày Mưa Ngừng Rơi",
    scenes: [
      "Giữa Rừng Hạt Mưa Treo, bạn chạm vào một giọt mưa đông cứng — và trong đó có một ký ức, như một con côn trùng trong hổ phách.\n\nMột cô bé đứng dưới mưa, ngửa mặt lên trời. Mẹ cô gọi cô vào nhà. Cô không vào. \"Mẹ ơi, nếu mưa tạnh thì những giọt mưa đi đâu?\"",
      "Người mẹ cười, lau tóc cho cô bằng vạt áo. \"Chúng thấm vào đất, con ạ. Rồi thành cây, thành hoa, thành con.\"\n\n\"Con không muốn chúng đi,\" cô bé nói. \"Con muốn giữ chúng.\"\n\nGiọt mưa trong tay bạn tan ra. Kẹp trong nó là một trang giấy nhỏ, khô ráo: \"Mẹ ta nói đúng. Ta đã không nghe.\"",
    ],
    give: { garden_page: 1 },
  },
  42: {
    title: "Bầu Trời Xếp Thành Mũi Tên",
    scenes: [
      "Ở Tâm Hố, dưới ngôi sao băng chưa chạm đất, bạn trải tấm bản đồ sao của Hana ra. Hàng chục bầu trời, hàng chục chòm sao, mỗi tầng một khác.\n\nÁnh sáng từ ngôi sao chiếu xuyên qua trang giấy mỏng — và các chấm mực chồng lên nhau.",
    ],
    choices: [
      { text: "Chồng các trang lên nhau, soi dưới ánh sao.", cond: { has: "star_chart" }, reply: "Khi xếp chồng tất cả các trang theo thứ tự tầng, những ngôi sao sáng nhất tạo thành một hình: một mũi tên khổng lồ, chỉ thẳng xuống dưới. Ở đầu mũi tên, Hana đã khoanh một vòng tròn nhỏ bằng mực đỏ, và viết: \"Tim.\"\n\nCô ấy đã biết từ lâu. Cô ấy chỉ cần người đi đủ xa để nhìn thấy.", flag: "star_arrow" },
      { text: "Chỉ ngắm ngôi sao.", reply: "Ngôi sao lơ lửng, run rẩy, như một đứa trẻ đứng trên mép hồ bơi không dám nhảy. Bạn ngắm nó rất lâu, rồi đi tiếp.", keep: true },
    ],
  },
  43: {
    title: "Mầm Bị Cắt",
    scenes: [
      "Bào tử hồng tràn vào phổi bạn, và bạn đang mơ.\n\nMột người phụ nữ cao lớn quỳ giữa một khu vườn héo. Mái tóc bà dài chạm đất, và trong mái tóc ấy có những bông hoa bị ép. Bà đang khóc — không thành tiếng, chỉ có nước mắt.",
      "Bà đặt tay lên ngực mình và rút ra một thứ nhỏ xíu, xanh non: một mầm cây hai lá, run rẩy. Bà nhìn nó rất lâu.\n\n\"Mỗi lần ta ép một thế giới, ngươi lại khóc,\" bà nói với mầm cây. \"Ngươi làm ta chùn tay. Ta không thể làm việc này nếu còn ngươi.\"\n\nBà ném mầm cây lên trời. Nó bay lên, lên mãi, xuyên qua từng tầng, tới tận nơi có ánh sáng.",
      "Bạn tỉnh dậy. Hai chiếc lá xanh non ấy — bạn đã nhìn thấy chúng mỗi ngày ở Thánh Địa.",
    ],
    choices: [
      { text: "Ghi nhớ giấc mơ.", reply: "Bạn viết lại tất cả vào mặt sau lá thư của Hana. Tay bạn run. Có quá nhiều thứ bạn chưa hiểu, và một thứ bạn đã hiểu quá rõ.", flag: "saw_mam_cut" },
    ],
  },
  44: {
    title: "Bốn Mươi Sáu Giọng Nói",
    scenes: [
      "Phòng Bốn Mươi Sáu Giọng là một hang tròn, vách phủ bốn mươi sáu tinh thể lớn. Khi bạn bước vào, chúng lần lượt sáng lên, và nói — mỗi chiếc một giọng, một thứ tiếng.\n\n\"Tôi ước được về nhà.\" \"Tôi ước con tôi được sống.\" \"Tôi ước quay lại ngày hôm đó.\" \"Tôi ước được mọi người nhìn thấy.\" \"Tôi ước không phải chết.\" \"Tôi ước gặp lại mẹ.\"",
      "Bốn mươi sáu điều ước. Không có điều nào xấu xa. Không có điều nào tham lam. Chỉ là những điều mà bất cứ ai cũng sẽ ước.\n\nTinh thể thứ bốn mươi bảy vẫn tối. Nó đang chờ.",
    ],
    choices: [
      { text: "Nói vào tinh thể: \"Tôi không ước gì cả.\"", reply: "Tinh thể nhấp nháy, như bối rối, rồi tắt ngấm. Nó không ghi được gì. Ở đâu đó rất sâu bên dưới, bạn cảm thấy — không phải nghe thấy, mà cảm thấy — một sự thất vọng.", flag: "refused_crystal" },
      { text: "Im lặng rời đi.", reply: "Bạn quay lưng. Tinh thể thứ bốn mươi bảy vẫn sáng mờ mờ sau lưng bạn, kiên nhẫn như một cái bẫy.", flag: "heard_wishes" },
    ],
  },
  45: {
    title: "Người Không Ước",
    speaker: "Dũng", portrait: "villager",
    scenes: [
      "Trong Chòi Người Chuyển Sinh, một anh chàng mặc áo thun in hình ban nhạc đang nướng mực trên than hồng. \"Ủa, người Việt hả? Ngồi đi ông! Tui là Dũng, người thứ ba mươi. Ở đây vui lắm, lễ hội quanh năm.\"",
      "\"Tui không xuống đáy. Tui không ước gì hết. Tui chỉ... dừng lại.\" Dũng lật con mực. \"Ở đây không ai già, không ai chết, pháo hoa không bao giờ tàn. Ông biết không, trên Trái Đất tui làm shipper, mười hai tiếng một ngày. Ở đây tui chưa phải chạy một bước nào.\"\n\n\"Ở lại đi. Không ai trách ông đâu.\"",
    ],
    choices: [
      { text: "Ở lại một đêm hội.", reply: "Bạn ở lại. Hai người ăn mực nướng, ngắm pháo hoa, nói chuyện về những quán ăn ở quê. Đó là đêm vui nhất từ khi bạn xuống Vực Sâu.\n\nSáng hôm sau — nếu ở đây có sáng — bạn đứng dậy. Dũng không giữ. \"Biết mà,\" anh nói. \"Người đi tiếp thì nhìn là biết.\"", flag: "stayed_festival", give: { sig_f45: 2 } },
      { text: "\"Tôi còn người phải tìm.\"", reply: "Dũng gật đầu, gói cho bạn mấy xiên mực. \"Vậy đi đi. Mà nè — nếu ông tới được đáy, và nếu có cách nào về nhà mà không phải ước... thì quay lại gọi tui nha.\"", flag: "promised_dung" },
    ],
  },
  46: {
    title: "Danh Mục Mẫu Vật",
    scenes: [
      "Trong Hầm Mục Lục Đá, bạn tìm thấy một tấm bia khổng lồ — cao hơn cả tháp hải đăng. Trên đó khắc một danh sách dài, bằng thứ chữ bạn không biết mà vẫn đọc được.\n\n\"Mẫu vật 1: Rừng Thì Thầm — ép lúc bình minh.\"\n\"Mẫu vật 2: Biển Cát Hổ Phách — ép lúc chính ngọ.\"\n\"...\"\n\"Mẫu vật 46: Thalassa — ép lúc triều cường.\"",
      "Danh sách kéo dài tới tận một trăm. Và bên dưới, khắc nông hơn, nét còn mới:\n\n\"Mẫu vật 101: Trái Đất — đang ép. Tiến độ: 3%.\"\n\nBa phần trăm. Bạn nghĩ tới dòng sông linh hồn ở tầng 28. Những người mặc áo mưa, xách túi chợ, đội mũ bảo hiểm.",
    ],
    choices: [
      { text: "Cào nát dòng chữ cuối.", reply: "Bạn lấy vũ khí cào lên tấm bia cho tới khi tay tứa máu. Dòng chữ vẫn nguyên. Nhưng bên cạnh nó, xuất hiện một vết xước nhỏ — vết xước đầu tiên trên tấm bia này. Có những thứ không phá được bằng sức. Nhưng không có nghĩa là không phá được.", flag: "saw_catalog" },
      { text: "Chép lại danh sách.", reply: "Bạn chép lại từng dòng. Một trăm thế giới. Bạn đã đi qua gần một nửa trong số đó. Bạn nhớ từng cái tên.", flag: "saw_catalog" },
    ],
  },
  47: {
    title: "Vực Sâu Đang Thở",
    scenes: [
      "Không có thế giới nào ở tầng này. Không có làng, không có tàn tích, không có ai để kể chuyện. Chỉ có tường thịt đang thở, và nhịp đập ngày một rõ.\n\nBạn áp tai vào vách. Thình thịch. Thình thịch. Và giữa hai nhịp, một tiếng thì thầm — không phải từ vách thịt, mà từ trong đầu bạn.",
      "\"...Ngươi đã đi xa lắm rồi. Ngươi mệt rồi. Ta biết ngươi nhớ nhà. Ta có thể cho ngươi về. Ngay bây giờ. Chỉ cần nói một câu.\"\n\nGiọng nói dịu dàng như một người mẹ. Đó là điều đáng sợ nhất.",
    ],
    choices: [
      { text: "\"Không.\"", reply: "Nhịp đập ngừng lại một giây — một giây dài như cả năm. Rồi nó đập tiếp, chậm hơn, như đang suy nghĩ. \"...Ngươi sẽ đổi ý,\" giọng nói bảo. \"Tất cả đều đổi ý.\"", flag: "refused_heart_1" },
      { text: "Bịt tai, bỏ chạy.", reply: "Bạn chạy qua những hành lang thịt cho tới khi phổi bỏng rát. Giọng nói không đuổi theo. Nó không cần đuổi. Nó biết bạn đang đi về đâu.", flag: "fled_heart_1" },
    ],
  },
  48: {
    title: "Mầm Tới Thăm",
    speaker: "Mầm", portrait: "sprout",
    scenes: [
      "Hội Đồng Cây Già im lặng khi bạn bước vào khoảng rừng. Rồi tất cả các cây cùng nói, một giọng duy nhất, nhỏ và run — giọng của Mầm.\n\n\"Cậu ơi. Tớ mượn cây để nói chuyện với cậu. Tớ không xuống được. Tớ... tớ nhớ ra rồi.\"",
      "\"Tớ không phải cây. Tớ là một phần của bà ấy. Phần muốn mọi thứ được lớn lên, được già đi, được kết thúc. Bà ấy đã vứt tớ đi, vì tớ làm bà ấy đau.\"\n\n\"Tớ không giận bà ấy. Bà ấy chỉ là một cô bé không chịu được việc nhìn hoa héo. Rồi cô bé lớn lên, và không ai dạy cô ấy rằng héo cũng là một phần của hoa.\"",
      "\"Cậu hứa với tớ một chuyện nhé. Khi gặp bà ấy... đừng ghét bà ấy.\"",
    ],
    choices: [
      { text: "\"Tớ hứa.\"", reply: "Cả khu rừng thở phào, lá rung rinh như tiếng cười. \"Cảm ơn cậu,\" Mầm nói. \"Tớ biết tớ chọn đúng người mà.\"", flag: "mam_trust" },
      { text: "\"Bà ấy đang giết Trái Đất.\"", reply: "Cả khu rừng im lặng rất lâu. \"Tớ biết,\" Mầm nói, nhỏ tới mức gần như không nghe được. \"Tớ biết. Vì vậy mới cần cậu.\"", flag: "mam_doubt" },
    ],
  },
  49: {
    title: "Người Trong Gương",
    scenes: [
      "Trong Phòng Không Có Bóng, hàng trăm tấm gương phản chiếu hàng trăm phiên bản của bạn. Một bạn lúc năm tuổi. Một bạn ngày đầu tới Thánh Địa. Một bạn đang ngủ.\n\nVà một bạn đứng ở cuối hành lang — già hơn, gầy hơn, áo rách, một vết sẹo dài trên má. Đôi mắt mệt mỏi của người đã đi rất, rất xa.",
      "Người trong gương mấp máy môi. Không có âm thanh. Nhưng bạn đọc được khẩu hình ấy — bạn đã nghe nó ở tầng 17, ở tầng 24, ở trong thư của Hana.\n\n\"Đừng ước.\"\n\nRồi người trong gương mỉm cười, giơ tay lên chào, như một người lính chào một người lính khác.",
    ],
    choices: [
      { text: "Chào lại.", reply: "Bạn giơ tay chào. Tấm gương rạn một đường, rồi vỡ vụn. Trong những mảnh vỡ, bạn chỉ còn thấy mình của bây giờ. Nhưng bạn biết: ở phía trước, có một phiên bản của bạn đã tới được đích. Và nó vẫn còn đủ tỉnh táo để nhắn lại.", flag: "saw_future_self" },
    ],
  },
  50: {
    title: "Người Thứ Nhất",
    speaker: "Người Ép Hoa Đầu Tiên", portrait: "villager",
    scenes: [
      "Ở Bàn Làm Việc Cũ, một ông lão mặc áo nâu bạc màu, đầu cạo trọc, đang cẩn thận ép một bông cúc dại vào giữa hai trang giấy. Khuôn mặt ông mờ nhạt như tranh vẽ bằng nước, nhưng vẫn còn đó.\n\n\"Chào con,\" ông nói bằng thứ tiếng Việt cổ, chữ nào cũng tròn. \"Ta là người thứ nhất. Ta xuống đây vào năm... người ta còn gọi là năm Thuận Thiên thứ mấy ấy. Lâu quá rồi.\"",
      "\"Ta đi tìm mẹ. Mẹ ta chết vì dịch khi ta mười tuổi. Ở dưới đáy, Trái Tim hỏi ta muốn gì. Ta nói ta muốn gặp lại mẹ.\"\n\nÔng mở một cuốn sách dày. Kẹp giữa hai trang là một người đàn bà, ép phẳng như một bông hoa, đang mỉm cười.\n\n\"Nó không biết cách nào khác để giữ một thứ, ngoài cách ép nó lại. Nó không ác. Nó chỉ không biết.\"",
      "\"Ta đã ở đây gần một nghìn năm, chăm những trang sách này. Mỗi người sau ta đều đi qua đây. Ta đã kể cho tất cả nghe. Và tất cả, khi tới đáy, đều nói có.\"\n\nÔng nhìn bạn rất lâu. \"Con sẽ nói gì?\"",
    ],
    choices: [
      { text: "\"Con sẽ nói không.\"", reply: "Ông lão gật đầu chậm rãi. \"Bốn mươi sáu người trước con cũng nói vậy ở chỗ này.\" Ông đặt vào tay bạn một trang giấy trắng tinh. \"Nhưng con là người đầu tiên nói mà mắt không nhìn xuống. Cầm lấy. Trang giấy này chưa ép gì cả. Để dành cho một kết thúc khác.\"", flag: "vow_no", give: { garden_page: 1, blank_page: 1 } },
      { text: "\"Nếu nó thật sự cho con về nhà thì sao?\"", reply: "\"Thì con sẽ về,\" ông lão nói. \"Về một khoảnh khắc. Mãi mãi. Như mẹ ta ở đây.\" Ông vuốt ve trang sách. \"Ta không trách con đâu. Ta chỉ mong con nghĩ thật kỹ, trước khi con thành một trang giấy.\"", flag: "tempted", give: { garden_page: 1 } },
    ],
  },
});
