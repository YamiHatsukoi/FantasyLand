import type { Cond } from "../../story/types";
/**
 * Main story beats, one per floor. Each beat is a short chain of scenes that ends with an
 * optional choice. Flags set here are read by later beats and by the ending on floor 100.
 */
export interface ArcChoice {
  text: string;
  /** Only selectable when this holds (e.g. a flag from an earlier floor). */
  cond?: Cond;
  hide?: boolean;
  reply: string;
  flag?: string;
  give?: Record<string, number>;
}
export interface ArcBeat {
  title: string;
  speaker?: string;
  portrait?: string;
  scenes: string[];
  choices?: ArcChoice[];
  give?: Record<string, number>;
  /** Only shows up if this flag is set (otherwise a quieter fallback scene plays). */
  needs?: string;
}

export const ARC: Record<number, ArcBeat> = {};
export const addArc = (beats: Record<number, ArcBeat>) => Object.assign(ARC, beats);

addArc({
  4: {
    title: "Người Đếm Sao", speaker: "Hana", portrait: "hana",
    scenes: [
      "Trên đỉnh Tháp Thiên Văn phủ băng, một cô gái trong chiếc áo khoác phao đỏ bạc màu đang ngửa cổ nhìn trời, tay cầm một cuốn sổ dày cộp. Cô không quay lại.\n\n\"Đừng đi nhanh thế, cậu làm tuyết rơi vào kính thiên văn của tôi. ...Kaito bảo cậu tới đúng không? Tôi là Hana. Trước đây tôi học vật lý thiên văn ở Osaka.\"",
      "\"Cậu có để ý bầu trời không? Ở tầng 1 có bốn chòm sao sáng nhất xếp thành hình cánh hoa. Ở tầng 2 không có ngôi nào trùng. Ở đây — không trùng luôn. Tôi đã vẽ bản đồ sao của mười một tầng.\"\n\nCô chìa ra những trang giấy chi chít chấm mực.\n\n\"Nếu đây là một cái hang sâu một trăm tầng, thì bầu trời của mỗi tầng phải giống nhau. Nhưng không. Mỗi tầng có một bầu trời riêng, một vật lý riêng, một thời gian riêng.\"",
      "\"Tôi nghĩ mỗi tầng là một thế giới khác nhau. Không phải 'giống như' một thế giới. Là một thế giới thật. Và ai đó đã... chồng chúng lên nhau như những trang sách.\"\n\nHana gập cuốn sổ lại. \"Tôi cần người đi xuống sâu hơn tôi dám. Có những trang giấy rải rác khắp Vực Sâu — cùng một nét chữ, cùng một loại mực. Tôi gọi chúng là Sổ Tay Người Làm Vườn. Nếu cậu tìm thấy, mang về cho tôi đọc.\"",
    ],
    choices: [
      { text: "Tôi sẽ giúp chị.", reply: "Hana mỉm cười lần đầu tiên. \"Tốt. Và này — đừng kể chuyện này với Mầm. Chưa phải lúc.\"", flag: "hana_trust" },
      { text: "Tại sao không được kể với Mầm?", reply: "\"Vì tôi không biết Mầm là gì. Và cậu cũng không biết.\" Cô nhìn cậu rất lâu. \"Cứ tìm những trang giấy đó đã.\"", flag: "hana_trust" },
      { text: "Chị nghĩ quá nhiều rồi.", reply: "\"Có thể.\" Hana quay lại với kính thiên văn. \"Nhưng khi cậu thấy một bầu trời có ba mặt trăng, hãy nhớ tới tôi.\"" },
    ],
    give: { star_chart: 1 },
  },
  5: {
    title: "Giấc Mơ Của Người Khác",
    scenes: [
      "Bào tử dày đặc tới mức bạn không còn nhìn thấy tay mình. Mùi đất ẩm, rồi... mùi nhựa đường ướt.\n\nBạn đang đứng giữa một con phố. Mưa. Đèn đường vàng vọt. Một chiếc xe tải phanh gấp, đèn pha trắng xoá lao về phía bạn — và dừng lại, cách mặt bạn một gang tay. Những hạt mưa lơ lửng giữa không trung.",
      "Từ khe nứt trên mặt đường, một mầm cây nhỏ xíu vươn lên, hai chiếc lá run rẩy. Nó không nói gì. Nó chỉ nhìn bạn — nếu một cái mầm có thể nhìn.\n\nRồi giấc mơ vỡ tan, và bạn tỉnh dậy trên lớp rêu mềm. Trong tay bạn là một trang giấy cũ, mực đã phai, nét chữ nghiêng nghiêng:\n\n\"Ngày thứ nhất. Ta hái bông hoa đầu tiên. Nó đang héo. Ta không chịu được việc nhìn nó héo, nên ta ép nó vào giữa hai trang sách. Nó sẽ đẹp mãi.\"",
    ],
    give: { garden_page: 1 },
  },
  6: {
    title: "Gai Giả", speaker: "Thợ rèn Brakka", portrait: "villager",
    scenes: [
      "Trong một góc lò rèn vẫn còn ấm, một người lùn già đang gõ búa lên thứ gì đó đen bóng. Ông không ngẩng lên.\n\n\"Ngươi mang gai thật trong túi. Ta ngửi thấy. Ta đã cố rèn lại nó cả trăm năm.\"",
      "Ông đưa cho bạn một chiếc gai đen thô kệch, nhẹ hơn gai thật. Đặt nó cạnh ngọn nến — ngọn lửa đông cứng lại, một giọt sáp dừng giữa chừng. Rút gai ra, ngọn lửa lại lay động.\n\n\"Thấy chưa? Nó không phải vũ khí. Nó là cái đinh. Cái đinh đóng thời gian lại. Tổ tiên ta tưởng ai đó đóng đinh thế giới ta để cứu nó. Giờ ta không chắc nữa.\"",
    ],
    choices: [
      { text: "Giữ chiếc gai giả.", reply: "\"Cầm lấy. Có thể một ngày ngươi cần dừng một khoảnh khắc nào đó.\"", give: { false_thorn: 1 }, flag: "false_thorn" },
      { text: "Đập vỡ nó.", reply: "Chiếc gai vỡ vụn. Brakka thở dài, rồi cười. \"Ừ. Có những thứ không nên bắt chước.\"", flag: "broke_false_thorn" },
    ],
  },
  7: {
    title: "Kẻ Không Có Mặt",
    scenes: [
      "Một con sóng khổng lồ từ biển mây đang đổ ụp xuống làng người cá bay. Những người cá hét lên, ôm lấy nhau.\n\nRồi một bóng người xuất hiện trên đỉnh sóng. Nó mặc áo choàng xám như tro, và nơi lẽ ra là khuôn mặt chỉ có một khoảng trống nhẵn nhụi như vỏ trứng.",
      "Nó đặt một bàn tay lên con sóng. Con sóng dừng lại. Không vỡ, không rút — chỉ dừng. Những người cá dưới chân sóng cũng dừng, miệng còn há ra giữa tiếng hét.\n\nKẻ không mặt quay về phía bạn. Nó nghiêng đầu, như một con chim nhìn thấy thứ gì lạ. Những chiếc gai trong túi bạn lạnh buốt.\n\nRồi nó biến mất như một vết mực bị lau đi.",
    ],
    choices: [
      { text: "Ghi nhớ hình dạng của nó.", reply: "Bạn vẽ lại hình dáng nó vào mặt sau tấm bản đồ sao của Hana. Chiếc áo choàng xám. Khuôn mặt trống. Một bàn tay đặt nhẹ như vuốt ve.", flag: "saw_presser" },
      { text: "Chạy tới chỗ những người cá.", reply: "Bạn chạm vào một đứa trẻ người cá. Làn da nó ấm, tim nó vẫn đập — nhưng chậm, chậm tới mức mỗi nhịp cách nhau cả phút. Nó vẫn đang sống. Chỉ là không được phép sống tiếp.", flag: "saw_presser" },
    ],
  },
  8: {
    title: "Chiếc Chuông Kêu",
    scenes: [
      "Giữa Chùa Không Chuông, một chiếc chuông đồng treo lặng lẽ. Bạn chạm tay vào nó — và lần đầu tiên sau hàng trăm năm, nó ngân lên.\n\nKhông phải tiếng chuông. Là một giọng nói, nhỏ và run, như từ rất xa vọng lại.",
      "\"...Cậu có nghe thấy tớ không? Tớ là... tớ không biết tớ là ai ở đây. Ở trên kia tớ quên nhiều thứ lắm.\"\n\nGiọng nói giống hệt Mầm. Nhưng Mầm đang ở Thánh Địa.\n\n\"Nghe này, tớ không có nhiều thời gian. Đừng để Trái Tim nghe thấy cậu gọi tên tớ. Và đừng... đừng hứa gì với nó, dù nó hứa cho cậu điều gì.\"\n\nChiếc chuông im bặt.",
    ],
    choices: [
      { text: "\"Trái Tim là gì?\"", reply: "Không có tiếng trả lời. Chỉ có một chiếc lá trúc rơi xuống vai bạn — chiếc lá đầu tiên rơi ở thung lũng này sau hàng trăm năm.", flag: "heard_bell" },
      { text: "Im lặng, ghi nhớ.", reply: "Bạn đặt tay lên chiếc chuông thêm lần nữa. Nó lạnh. Nhưng ở đâu đó rất sâu bên dưới Vực Sâu, bạn có cảm giác có thứ gì đó vừa quay đầu lại nhìn.", flag: "heard_bell" },
    ],
  },
  9: {
    title: "Bầu Trời Ở Dưới Chân",
    scenes: [
      "Bạn nhìn xuống mặt gương muối. Bầu trời phản chiếu không có ba mặt trăng. Nó có một mặt trăng, bị mây che nửa. Có những toà nhà cao, những biển hiệu sáng đèn, một cây cầu vượt ướt mưa.\n\nBạn nhận ra góc phố ấy. Bạn đã đi qua nó mỗi ngày.",
      "Hình phản chiếu của bạn trong gương không cử động theo bạn. Nó đứng im, mặc bộ quần áo bạn mặc vào đêm hôm đó, tay cầm chiếc ô bị gió lật.\n\nDưới lớp muối, một trang giấy bị kẹt. Nét chữ nghiêng nghiêng quen thuộc:\n\n\"Thế giới thứ chín mươi tám khóc khi ta ép nó. Ta tự nhủ rằng rồi nó sẽ cảm ơn ta. Không có gì phải chết nữa. Không có gì phải kết thúc nữa.\"",
    ],
    give: { garden_page: 1 },
  },
  10: {
    title: "Một Giây Dài",
    scenes: [
      "Trên Quảng Trường Kim Giờ, một bé gái đang chạy, hai chân không chạm đất, tóc bay về phía sau. Cách đó mười bước, một người đàn ông quỳ gối dang tay, nước mắt lơ lửng trên má.\n\nTrên tháp đồng hồ phía trên họ cắm một chiếc gai đen nhỏ — nhỏ hơn gai của Boss Canh Cửa, như một nhánh con.",
      "Bạn trèo lên. Chiếc gai lung lay khi bạn chạm vào. Chỉ cần kéo nhẹ.\n\nNhưng bạn nhìn thấy những con phố xung quanh tháp — nơi có ai đó đã rút những chiếc gai nhỏ khác. Ở đó không có người. Chỉ có bụi, và những chiếc đồng hồ đã chạy nốt giây cuối cùng rồi gục xuống thành gỉ sét.",
    ],
    choices: [
      { text: "Rút chiếc gai ra.", reply: "Kim giây nhích. Bé gái chạm đất, lao vào vòng tay cha. Họ ôm nhau — một giây trọn vẹn — rồi cả hai tan thành bụi vàng, nhẹ như phấn hoa, vẫn trong tư thế ôm nhau. Gió cuốn họ đi.\n\nBạn đứng đó rất lâu.", flag: "released_10", give: { sig_f10: 2 } },
      { text: "Để yên cho họ.", reply: "Bạn buông tay. Người cha vẫn quỳ đó, bé gái vẫn đang chạy. Có lẽ một giây không bao giờ kết thúc vẫn tốt hơn là không có giây nào. Có lẽ.", flag: "kept_10" },
    ],
  },
});
