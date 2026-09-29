/**
 * Text pools for procedurally generated NPCs. Lines are templates:
 * {p} player, {me} npc name, {town} settlement, {floor} floor number, {fname} floor name, {region} a region,
 * {boss} the floor's gatekeeper boss, {job} npc job, {race} npc race, {item} an item, {days} days, {season}, {weather}.
 */

export type Persona = "cheerful" | "grumpy" | "shy" | "proud" | "greedy" | "kind" | "mysterious" | "brave";
export type Job =
  | "merchant" | "farmer" | "guard" | "hunter" | "scholar" | "priest" | "adventurer" | "blacksmith"
  | "innkeeper" | "child" | "elder" | "bard" | "mercenary" | "herbalist" | "fisher";

export const PERSONAS: Record<Persona, { name: string; icon: string; recruitAff: number; joke: number; rude: number; flatter: number }> = {
  cheerful: { name: "Vui vẻ", icon: "😄", recruitAff: 25, joke: 4, rude: -6, flatter: 2 },
  grumpy: { name: "Cục cằn", icon: "😒", recruitAff: 45, joke: -2, rude: 1, flatter: -1 },
  shy: { name: "Nhút nhát", icon: "😳", recruitAff: 50, joke: 1, rude: -10, flatter: 3 },
  proud: { name: "Kiêu hãnh", icon: "😤", recruitAff: 55, joke: -1, rude: -12, flatter: 5 },
  greedy: { name: "Hám lợi", icon: "🤑", recruitAff: 20, joke: 0, rude: -3, flatter: 1 },
  kind: { name: "Hiền hậu", icon: "😊", recruitAff: 30, joke: 2, rude: -5, flatter: 1 },
  mysterious: { name: "Bí ẩn", icon: "🌫️", recruitAff: 60, joke: -1, rude: -4, flatter: -2 },
  brave: { name: "Dũng cảm", icon: "🔥", recruitAff: 35, joke: 2, rude: -2, flatter: 1 },
};

export const JOBS: Record<Job, { name: string; icon: string; classes: string[]; recruit: boolean }> = {
  merchant: { name: "Thương nhân", icon: "💰", classes: ["rogue"], recruit: false },
  farmer: { name: "Nông dân", icon: "🌾", classes: ["guardian", "warrior"], recruit: false },
  guard: { name: "Lính gác", icon: "🛡️", classes: ["guardian", "warrior"], recruit: true },
  hunter: { name: "Thợ săn", icon: "🏹", classes: ["ranger"], recruit: true },
  scholar: { name: "Học giả", icon: "📜", classes: ["mage"], recruit: true },
  priest: { name: "Tu sĩ", icon: "🙏", classes: ["cleric"], recruit: true },
  adventurer: { name: "Nhà thám hiểm", icon: "🗺️", classes: ["warrior", "rogue", "ranger", "mage"], recruit: true },
  blacksmith: { name: "Thợ rèn", icon: "⚒️", classes: ["warrior", "guardian"], recruit: false },
  innkeeper: { name: "Chủ quán trọ", icon: "🍺", classes: ["cleric"], recruit: false },
  child: { name: "Đứa trẻ", icon: "🧒", classes: ["rogue"], recruit: false },
  elder: { name: "Trưởng lão", icon: "👴", classes: ["mage", "witch"], recruit: false },
  bard: { name: "Thi sĩ", icon: "🎻", classes: ["cleric", "mage"], recruit: true },
  mercenary: { name: "Lính đánh thuê", icon: "⚔️", classes: ["warrior", "rogue", "guardian"], recruit: true },
  herbalist: { name: "Thầy thuốc", icon: "🌿", classes: ["cleric", "witch"], recruit: true },
  fisher: { name: "Ngư dân", icon: "🎣", classes: ["ranger", "guardian"], recruit: false },
};

export const RACES = ["Người", "Tiên Rừng", "Người Lùn", "Tộc Nấm", "Người Thú", "Người Cá", "Bán Tinh Linh", "Người Chuyển Sinh", "Tộc Thằn Lằn", "Người Bóng"];

/** Name syllables per culture (keyed by biome). */
export const NAME_PARTS: Record<string, { a: string[]; b: string[] }> = {
  forest: { a: ["Ly", "El", "Fen", "Tha", "Ori", "Sil", "Ae", "Bri", "Nae", "Wil"], b: ["ra", "wen", "dor", "lin", "mir", "ith", "ael", "nor", "wyn", "sa"] },
  desert: { a: ["Za", "Ka", "Sa", "Ha", "Ra", "Ja", "Ma", "Na", "Fa", "Da"], b: ["hir", "mira", "rim", "dar", "lia", "ssan", "fir", "mun", "ziz", "ya"] },
  swamp: { a: ["Mor", "Bel", "Gri", "Wal", "Ose", "Tur", "Mo", "Ha", "Nel", "Fro"], b: ["wen", "dra", "ble", "mud", "gan", "sk", "rin", "ssa", "go", "lok"] },
  tundra: { a: ["Bjo", "Sig", "Ul", "Ing", "Tor", "Fre", "Ast", "Hal", "Kar", "Sve"], b: ["rn", "rid", "va", "ga", "stein", "ya", "ra", "dis", "ke", "n"] },
  fungal: { a: ["Spo", "Myc", "Pip", "Mo", "Tru", "Chan", "Por", "Mo", "Fu", "Gil"], b: ["rella", "o", "kin", "rel", "ffle", "ter", "cini", "bo", "zz", "ly"] },
  volcano: { a: ["Ig", "Pyr", "Bra", "Cin", "Vul", "Ash", "Em", "Scor", "Fla", "Ro"], b: ["nis", "rah", "nd", "der", "ka", "a", "ber", "ch", "ra", "g"] },
  reef: { a: ["Mar", "Co", "Ne", "Thal", "Pe", "Ma", "Au", "Lo", "Ar", "Cy"], b: ["ina", "ral", "rea", "assa", "arl", "ris", "rel", "ra", "iel", "an"] },
  bamboo: { a: ["Kai", "Ren", "Hi", "Yu", "Ake", "Shi", "Ta", "Mi", "Sou", "Ha"], b: ["to", "ji", "na", "ki", "mi", "ro", "ka", "yu", "ra", "ru"] },
  crystal: { a: ["Lu", "Pri", "Qua", "Oni", "Cel", "Ser", "Aza", "Vel", "Iri", "Opa"], b: ["mi", "sma", "rtz", "x", "este", "a", "ria", "ra", "s", "line"] },
  autumn: { a: ["Mapl", "Au", "Rus", "Hen", "Ol", "Ha", "Ce", "Wy", "Ro", "Ha"], b: ["e", "ra", "set", "na", "ive", "zel", "dar", "ndal", "wan", "rvey"] },
  ruins: { a: ["Val", "Cas", "Aur", "Oct", "Sev", "Mar", "Cor", "Ter", "Lu", "Fla"], b: ["erius", "sius", "elia", "avia", "erus", "cus", "nelia", "tius", "cia", "via"] },
  sakura: { a: ["Sa", "Ha", "Yu", "Mo", "Chi", "Ai", "Ka", "Ri", "Tsu", "Mi"], b: ["kura", "ruka", "ki", "mo", "yo", "ko", "ede", "n", "baki", "zuki"] },
  bonewaste: { a: ["Mor", "Ske", "Os", "Cra", "Ne", "Gha", "Vor", "Dre", "Mal", "Sil"], b: ["tis", "lla", "sian", "nia", "cra", "st", "x", "ad", "kor", "ence"] },
  jungle: { a: ["Tla", "Itz", "Xo", "Ma", "Ya", "Qui", "Ne", "Ch", "Te", "Ol"], b: ["loc", "el", "chi", "ya", "otl", "tzal", "zca", "ac", "cu", "in"] },
  glacier: { a: ["Hri", "Ym", "Sno", "Ice", "Skj", "Fro", "Gla", "Kry", "Nif", "Rim"], b: ["m", "ir", "rri", "lyn", "ald", "sta", "ce", "o", "l", "e"] },
};

export const EPITHETS = [
  "Tay Sắt", "Mắt Ưng", "Chân Nhanh", "Lá Bạc", "Mũ Đỏ", "Râu Dài", "Nửa Tai", "Tiếng Chuông", "Gió Bắc", "Sương Mai",
  "Đá Xám", "Đuốc Sáng", "Ba Sẹo", "Bóng Đêm", "Hoa Muộn", "Nụ Cười", "Cát Vàng", "Nước Lặng", "Than Hồng", "Cánh Quạ",
  "Không Ngủ", "Lưỡi Bạc", "Rễ Sâu", "Móng Vuốt", "Sao Băng", "Vỏ Sò", "Lông Vũ", "Tro Tàn", "Hổ Phách", "Mưa Phùn",
];

export const SETTLEMENT_PREFIX: Record<"village" | "town" | "city", string[]> = {
  village: ["Làng", "Xóm", "Bản", "Trạm Nghỉ", "Thôn"],
  town: ["Thị Trấn", "Trấn", "Bến", "Pháo Đài", "Chợ Phiên"],
  city: ["Thành", "Đô Thành", "Cảng Thành", "Thánh Thành", "Kinh Thành"],
};

export const SETTLEMENT_WORDS: Record<string, string[]> = {
  forest: ["Lá Rơi", "Rễ Cổ", "Đom Đóm", "Sương Xanh", "Cây Mẹ", "Hạt Dẻ"],
  desert: ["Ốc Đảo", "Gió Nóng", "Cát Hát", "Hổ Phách", "Lạc Đà", "Mặt Trời Kép"],
  swamp: ["Đèn Ma", "Nhà Sàn", "Ếch Kêu", "Nước Đen", "Cây Đước", "Sương Độc"],
  tundra: ["Tuyết Trắng", "Lò Sưởi", "Gấu Băng", "Đèo Rét", "Thông Bạc", "Rượu Mật"],
  fungal: ["Mũ Nấm", "Bào Tử", "Phát Quang", "Sợi Tơ", "Mộng Tím", "Ô Lớn"],
  volcano: ["Than Hồng", "Lò Rèn", "Tro Bay", "Đá Đen", "Suối Nóng", "Lưu Huỳnh"],
  reef: ["San Hô", "Ngọc Trai", "Vỏ Sò", "Thủy Triều", "Cá Voi", "Hải Đăng"],
  bamboo: ["Trúc Xanh", "Chuông Gió", "Mây Trôi", "Suối Đá", "Đèn Lồng", "Trà Sớm"],
  crystal: ["Lăng Kính", "Ánh Sao", "Pha Lê", "Mạch Sáng", "Tiếng Ngân", "Gương Trời"],
  autumn: ["Lá Phong", "Cối Xay", "Táo Đỏ", "Mùa Gặt", "Khói Chiều", "Rượu Táo"],
  ruins: ["Cổng Cũ", "Tượng Vỡ", "Tháp Nghiêng", "Thư Viện Đổ", "Đế Chế", "Bia Đá"],
  sakura: ["Hoa Rơi", "Cầu Đỏ", "Cá Chép", "Đền Thiêng", "Trà Hồng", "Trăng Xuân"],
  bonewaste: ["Xương Trắng", "Tháp Sọ", "Gió Than", "Đèn Hồn", "Vực Lặng", "Mộ Rồng"],
  jungle: ["Dây Leo", "Thác Lớn", "Vẹt Đỏ", "Đền Rêu", "Nhà Cây", "Hoa Khổng Lồ"],
  glacier: ["Băng Vĩnh Cửu", "Gương Băng", "Hang Xanh", "Cột Băng", "Tuyết Lặng", "Đỉnh Sao"],
};

/** Greetings by persona and affinity tier (0 stranger, 1 acquaintance, 2 friend, 3 close). */
export const GREET: Record<Persona, string[][]> = {
  cheerful: [
    ["Ồ, người lạ! Chào mừng tới {town}! Tôi là {me}, cứ hỏi gì cũng được nha!", "Oa, nhìn bộ dạng này chắc cậu vừa từ ngoài hoang dã về hả? Vào đây, vào đây!", "Một khuôn mặt mới! Hôm nay đúng là ngày may mắn của {town}!"],
    ["{p}! Lại gặp cậu rồi! Hôm nay có chuyện gì vui kể tôi nghe không?", "Ê {p}! Tôi vừa nghĩ tới cậu xong thì cậu xuất hiện luôn. Hay ghê!", "A, người quen! Ngồi xuống đây một lát đi."],
    ["{p}!! Bạn thân của tôi! Nhớ cậu muốn chết!", "Mỗi lần cậu tới là {town} như sáng bừng lên ấy, thật đó!", "Cậu tới đúng lúc lắm, tôi đang buồn chán muốn xỉu!"],
    ["{p}... cậu biết không, từ khi quen cậu, ngày nào tôi cũng thấy đáng sống hơn.", "Chỉ cần thấy cậu bình an trở về là tôi vui cả tuần rồi.", "Người tôi quý nhất Vực Sâu tới rồi kìa!"],
  ],
  grumpy: [
    ["Hửm? Nhìn cái gì. Có việc thì nói, không thì đi.", "Lại một kẻ ngoại lai. Đừng có giẫm lên luống rau của tôi.", "Tôi là {me}. Thế thôi. Còn gì nữa không?"],
    ["Lại là cậu. ...Cũng được, cậu không phiền bằng mấy đứa khác.", "{p} à. Hôm nay khỏi cằn nhằn, tôi mệt rồi.", "Hừ. Còn sống à. Tốt."],
    ["...Ngồi đi. Đừng nói với ai là tôi mời đấy.", "Cậu là một trong số ít người ở đây tôi không muốn đá ra khỏi cửa.", "Hừm, {p}. Tôi có để dành cho cậu chút trà. Đừng hiểu lầm."],
    ["Nếu có ai dám động vào cậu, cứ báo tôi. Tôi sẽ xử lý.", "Cậu là... bạn. Được chưa? Đừng bắt tôi nói lại.", "Già rồi mới biết có người để lo lắng cũng không tệ lắm."],
  ],
  shy: [
    ["À... ừm... xin chào... tôi là {me}...", "C-cậu cần gì ạ? Tôi... tôi không làm gì sai đâu...", "*lùi lại một bước* ...Chào."],
    ["Ơ, {p}... chào cậu. Hôm nay trời... đẹp nhỉ?", "Cậu... lại tới à? Tôi... không phiền đâu.", "Tôi... có nhớ tên cậu đó. {p}, phải không?"],
    ["{p}! À... xin lỗi, tôi lỡ gọi to quá...", "Nói chuyện với cậu thì tôi... không còn run nữa.", "Tôi có làm cái này... ừm... thôi, lần sau đưa."],
    ["Ở cạnh cậu... tôi thấy mình dũng cảm hơn một chút.", "Cậu là người đầu tiên... thật sự nghe tôi nói.", "Nếu cậu đi xa... nhớ quay về nhé. Tôi sẽ đợi."],
  ],
  proud: [
    ["Ngươi đang đứng trước {me}, {job} bậc nhất {town}. Hãy cư xử cho phải phép.", "Một kẻ phiêu lưu à? Ta đã thấy cả trăm kẻ như ngươi. Chẳng mấy ai sống sót.", "Hừm. Ít nhất ngươi biết cúi đầu chào."],
    ["{p}. Ngươi vẫn còn sống. Có lẽ ngươi không tầm thường như ta nghĩ.", "À, kẻ phiêu lưu ấy. Ta nhớ ngươi.", "Ngươi tới xin lời khuyên của ta à? Khôn ngoan đấy."],
    ["{p}, ngươi xứng đáng để ta gọi bằng tên.", "Ta hiếm khi thừa nhận ai. Nhưng ngươi... được.", "Ngồi đi. Hôm nay ta sẽ chia sẻ vài điều."],
    ["Nếu có kẻ ngang hàng với ta ở Vực Sâu này, đó là ngươi, {p}.", "Ta tự hào khi được đứng cạnh ngươi.", "Đồng minh của ta. Bạn của ta. ...Đừng cười."],
  ],
  greedy: [
    ["Khách hàng! À không, bạn mới! Tôi là {me}. Cậu có... vàng chứ?", "Chào chào! Cần gì cũng có, miễn là giá cả phải chăng... cho tôi.", "Túi cậu nghe leng keng dễ thương ghê. Nói chuyện chút không?"],
    ["{p}! Vị khách quý giá nhất... tuần này!", "Lại gặp nhau rồi. Hôm nay tôi có mấy tin đồn đáng giá lắm... nếu cậu quan tâm.", "Ha, {p}! Nhìn cậu là tôi thấy mùi làm ăn."],
    ["Với cậu thì tôi giảm giá. Thật đấy! ...Một chút.", "{p}, bạn làm ăn tốt nhất của tôi!", "Tôi tin cậu hơn tin cái két sắt của mình. Đó là lời khen lớn nhất đó."],
    ["Có những thứ không mua được bằng vàng. Tôi ghét phải thừa nhận... nhưng cậu là một trong số đó.", "Nếu cậu gặp khó khăn, két của tôi mở cho cậu. Chỉ cậu thôi.", "{p}, cậu làm tôi thành người tốt hơn. Kinh khủng thật."],
  ],
  kind: [
    ["Ôi, cháu trông mệt quá. Ngồi nghỉ đi, tôi là {me}.", "Chào mừng tới {town}. Ở đây ai cũng là khách quý.", "Cậu đói không? Tôi còn ít bánh mới nướng."],
    ["{p} tới rồi à. Ăn gì chưa đấy?", "Thấy cháu khỏe mạnh là tôi mừng rồi.", "Hôm nay có chuyện gì buồn không? Kể tôi nghe."],
    ["{p}, cháu cứ coi đây như nhà mình.", "Tôi đã cầu nguyện cho cháu mỗi tối đấy.", "Lại đây, để tôi xem vết thương nào."],
    ["Cháu như con ruột của tôi vậy, {p}.", "Dù cháu đi tới tầng nào, nơi đây vẫn luôn chờ cháu.", "Có cháu ở đây, căn nhà này ấm hẳn lên."],
  ],
  mysterious: [
    ["...Ngươi có mùi của thế giới khác. Thú vị.", "Ta đã thấy ngươi trong giấc mơ, trước khi ngươi đến. Ta là {me}.", "Đừng hỏi ta đến từ đâu. Hãy hỏi ngươi sẽ đi về đâu."],
    ["Sợi chỉ số phận của ngươi lại dẫn tới đây, {p}.", "Ngươi quay lại. Như ta đã đoán.", "Gió hôm nay mang theo tên ngươi."],
    ["{p}. Ta sẽ kể ngươi nghe điều mà chưa ai được nghe.", "Có những cánh cửa chỉ mở cho người ta tin tưởng.", "Ngươi bắt đầu nhìn thấy những điều người khác không thấy."],
    ["Ta đã đi qua trăm kiếp. Hiếm khi gặp một linh hồn như ngươi.", "Nếu thế giới này sụp đổ, ta sẽ đứng về phía ngươi.", "Tên thật của ta... ngươi là người thứ hai biết."],
  ],
  brave: [
    ["Ha! Một chiến binh! Ta là {me}. Tay ngươi có vết chai đấy, tốt!", "Ngươi xuống từ tầng trên à? Đường đi thế nào, có quái mạnh không?", "Chào! Nếu cần người đánh nhau thì cứ gọi ta."],
    ["{p}! Lần trước ngươi hạ được bao nhiêu con?", "Gặp lại rồi, chiến hữu!", "Tay ngứa quá, đi săn quái không {p}?"],
    ["{p}, ta muốn một ngày được chiến đấu bên cạnh ngươi.", "Nghe kể về chiến công của ngươi mà ta nóng cả máu!", "Chiến hữu! Uống một chén không?"],
    ["Sau lưng ngươi có ta. Luôn luôn.", "Nếu phải chết, ta muốn chết khi bảo vệ ngươi.", "Anh em một nhà, {p}!"],
  ],
};

/** Small talk by job. */
export const JOB_TALK: Record<Job, string[]> = {
  merchant: [
    "Giá gỗ quý đang lên đấy. Ai cũng muốn xây nhà mới sau mùa quái vật.",
    "Buôn bán ở Vực Sâu có một luật: đừng bao giờ bán chịu cho kẻ sắp xuống tầng dưới.",
    "Tôi từng đổi một bao muối lấy một thanh kiếm phép. Tên đó không biết giá trị thật của nó!",
    "Hàng từ tầng trên luôn rẻ hơn. Hàng từ tầng dưới thì... người mang lên thường không còn sống để bán.",
    "Nếu cậu có nông sản tươi, mang tới đây. Dân {town} thèm rau xanh lắm.",
  ],
  farmer: [
    "Đất ở đây lạ lắm. Cây mọc theo mùa, nhưng mùa thì... do Vực Sâu quyết định.",
    "Tưới đủ nước là cây ngoan. Bón phân là cây ngoan gấp đôi.",
    "Có lần tôi trồng hai giống cạnh nhau, và một mầm lạ mọc ra ở giữa. Giống lai đấy!",
    "Mùa đông thì chỉ có nhà kính mới cứu được luống rau.",
    "Gà nhà tôi đẻ trứng hai lòng đỏ, chắc là nhờ ngô vàng.",
  ],
  guard: [
    "Đêm qua có tiếng hú ở phía {region}. Tôi không ngủ được.",
    "Tường thì chắc, nhưng lòng người mới là thứ giữ {town} đứng vững.",
    "Tôi canh cổng này mười năm rồi. Chưa để lọt con quái nào. Chà... gần như chưa.",
    "Nếu cậu định tới {region}, nhớ mang theo thuốc giải độc.",
    "Cấp trên bảo tôi cảnh giác với người lạ. Nhưng cậu trông không giống kẻ xấu.",
  ],
  hunter: [
    "Dấu chân lớn cỡ này... một con thú dữ đang lảng vảng gần {region}.",
    "Da và nanh bán được giá, nhưng đừng giết nhiều hơn mức cần.",
    "Tôi săn ở tầng này đủ lâu để biết: quái yếu thì đi theo đàn, quái mạnh thì đi một mình.",
    "Mùi máu mang theo gió. Luôn đứng xuôi gió khi phục kích.",
    "Có ngày tôi sẽ xuống săn ở tầng sâu hơn. Khi nào đủ gan.",
  ],
  scholar: [
    "Vực Sâu có đúng 100 tầng? Hay 100 chỉ là con số chúng ta đếm được?",
    "Tôi đang viết một cuốn sách về các phản ứng nguyên tố. Nước và sét là cặp đôi hoàn hảo.",
    "Những người chuyển sinh như cậu... xuất hiện ngày càng nhiều. Hẳn phải có lý do.",
    "Mỗi tầng có một Boss Canh Cửa. Tôi tin chúng không phải quái thú, mà là người gác ngục.",
    "Đọc sách không làm cậu mạnh lên. Nhưng giúp cậu biết nên sợ cái gì.",
  ],
  priest: [
    "Mầm Thánh là hy vọng cuối cùng của Vực Sâu. Hãy chăm sóc nó.",
    "Ta cầu nguyện cho những linh hồn chưa được siêu thoát ở {region}.",
    "Ánh sáng không xua được bóng tối. Nó chỉ nhắc chúng ta rằng bóng tối có giới hạn.",
    "Nếu cậu mệt mỏi, hãy nghỉ. Thánh thần không bắt ai phải gục ngã.",
    "Ta từng thấy một kẻ ác quay đầu. Nên ta tin vào tất cả mọi người.",
  ],
  adventurer: [
    "Tôi từng xuống tới tầng {deeper}. Ở đó... thôi, tôi không muốn nhớ lại.",
    "Luôn mang theo một cuộn phép dịch chuyển. Luôn luôn.",
    "Bí quyết sống sót: có một đội tốt. Bốn người là con số hoàn hảo.",
    "Đám rương báu ở {region} thường có bẫy. Cẩn thận đấy.",
    "Có tin đồn về một kho báu dưới chân {boss}. Ai dám tới lấy chứ?",
  ],
  blacksmith: [
    "Kim loại tầng càng sâu càng cứng. Mithril, Thần Kim... ước gì tôi được rèn một lần.",
    "Vũ khí tốt phải hợp tay. Đừng chỉ nhìn chỉ số.",
    "Thỏi thép này tôi gõ ba ngày ba đêm. Cậu nghe tiếng ngân không?",
    "Lò rèn cần than tốt. Than từ gỗ quý thì lửa xanh cơ.",
    "Giáp nặng thì chậm, giáp nhẹ thì chết. Chọn đi.",
  ],
  innkeeper: [
    "Phòng trọ sạch sẽ, giường êm, cháo nóng. Cậu còn muốn gì hơn?",
    "Khách trọ đêm qua kể về một con rồng ở tầng dưới. Chắc say thôi.",
    "Quán tôi nghe được mọi tin đồn của {town}. Mua một chén là biết hết.",
    "Nghỉ một đêm là hồi sức. Cậu trông như cần ba đêm.",
    "Có một nhóm lính đánh thuê hay ngồi góc kia. Họ đang tìm chủ thuê đấy.",
  ],
  child: [
    "Anh/chị là người chuyển sinh hả? Thế giới cũ có kẹo không?",
    "Mẹ bảo không được ra khỏi {town}. Nhưng em thấy một con bướm phát sáng ở ngoài kia!",
    "Lớn lên em sẽ đánh bại Boss Canh Cửa! Thật đó!",
    "Em có một viên đá đẹp lắm. Anh/chị muốn xem không?",
    "Ông em bảo ngày xưa ở đây có mặt trời thật. Mặt trời là gì ạ?",
  ],
  elder: [
    "Hồi ta còn trẻ, {town} chỉ có ba căn nhà. Giờ nhìn xem.",
    "Ta đã thấy nhiều người chuyển sinh đến rồi đi. Ít ai đi được xa.",
    "Truyền thuyết kể rằng ở tầng 100 có một cánh cửa dẫn ra ngoài.",
    "Đừng vội vàng. Vực Sâu đã ở đây hàng nghìn năm, nó không chạy đi đâu cả.",
    "Mỗi Boss Canh Cửa từng là một anh hùng. Đó là lời nguyền của nơi này.",
  ],
  bard: [
    "♪ Ở tầng {floor} có một người lữ khách, tay cầm kiếm, lòng mang một ước mơ... ♪",
    "Tôi đang sáng tác bài ca về cậu. Cần thêm vài chiến công nữa.",
    "Âm nhạc có thể làm quái vật ngủ say. Không phải con nào cũng vậy thôi.",
    "Có một bài ca cổ nói về {fname}. Nghe buồn lắm.",
    "Khán giả ở {town} khó tính lắm, nhưng họ thích chuyện anh hùng.",
  ],
  mercenary: [
    "Tiền đâu thì kiếm đó. Nhưng tôi không đâm sau lưng chủ thuê.",
    "Tôi từng hộ tống đoàn buôn qua {region}. Mất một nửa người.",
    "Nếu cậu cần thêm tay kiếm, giá cả có thể thương lượng.",
    "Đánh nhau với quái còn dễ hơn đánh nhau với con người.",
    "Vết sẹo này là từ một con Boss Canh Cửa. Tôi chạy thoát. Không xấu hổ gì cả.",
  ],
  herbalist: [
    "Thảo dược tầng này có tính {weather}. Ý tôi là... hơi thất thường.",
    "Lá bạc hà gió trộn với mật ong là thuốc ho tuyệt nhất.",
    "Đừng bao giờ ăn nấm phát sáng màu tím. Tin tôi đi.",
    "Tôi đang tìm một loài hoa chỉ nở vào ngày giông bão.",
    "Thuốc hồi máu thật ra chỉ là nước thảo mộc cô đặc. Bí quyết nằm ở tình yêu. Và phân bón.",
  ],
  fisher: [
    "Cá ở đây cắn câu theo mùa. Mùa thu có cá đèn lồng đẹp lắm.",
    "Ngày giông bão là ngày câu được lươn sấm. Nguy hiểm nhưng đáng giá.",
    "Mặt nước lặng thế thôi, dưới đó có cả một thế giới.",
    "Tôi câu được một chiếc giày một lần. Của ai thì không biết.",
    "Cậu có muốn nghe chuyện con cá lớn nhất tôi từng để sổng không?",
  ],
};

/** Lines about the world, floor, season and weather. */
export const WORLD_TALK: string[] = [
  "Mùa {season} ở tầng {floor} lúc nào cũng dài hơn bình thường.",
  "Trời hôm nay {weather}. Dân {town} lại có cớ ở nhà rồi.",
  "Người ta bảo {fname} là tầng dễ sống nhất. Người ta nói dối.",
  "Cậu đã tới {region} chưa? Phong cảnh ở đó đẹp tới nao lòng.",
  "Có một Boss Canh Cửa tên {boss} chặn đường xuống tầng dưới. Nghe nói nó chưa từng thua.",
  "Ánh sáng ở Vực Sâu không đến từ mặt trời. Không ai biết nó đến từ đâu.",
  "Mỗi khi có người chuyển sinh xuất hiện, mầm cây ở đền lại nảy thêm một lá.",
  "Hàng hóa từ các tầng khác đến {town} qua những cánh cổng dịch chuyển cổ.",
  "Tôi nghe nói có người đã xây cả một thành phố trên Thánh Địa của họ. Thật khó tin.",
  "Ở tầng sâu hơn, quái vật biết nói. Và chúng nói rất lịch sự. Đáng sợ hơn nhiều.",
  "Năm ngoái có một cơn bão cát kéo dài bốn mươi ngày. Không, đó là tầng khác. Tôi lẫn lộn hết rồi.",
  "Người già bảo rằng Vực Sâu đang thở. Mỗi hơi thở là một mùa.",
  "Có kẻ đồn rằng ai hạ đủ 100 Boss Canh Cửa sẽ được ước một điều.",
  "Các tầng không nối với nhau bằng đất, mà bằng ký ức. Tôi đọc được trong một cuốn sách cổ.",
  "Làng bên cạnh vừa có đám cưới. Cả tầng được một bữa no.",
];

/** Memory-driven lines. Key is a trigger; the chooser checks conditions. */
export const MEMORY_TALK: Record<string, string[]> = {
  longAbsence: ["{days} ngày rồi đấy, {p}. Tôi còn tưởng cậu bỏ mạng ở đâu rồi.", "Lâu quá không thấy cậu! {days} ngày liền! Cậu đi đâu vậy?", "Cậu biến mất {days} ngày. Lần sau đi xa thì báo một tiếng."],
  bossBeaten: ["Tin lớn! Có người nói cậu đã hạ {boss}! Là thật hả?", "Từ khi {boss} ngã xuống, dân {town} ngủ ngon hơn hẳn. Cảm ơn cậu.", "Cậu đánh bại Boss Canh Cửa của tầng này... Tôi đã nhìn nhầm cậu rồi."],
  deepDiver: ["Nghe nói cậu đã tới tầng {deep}. Sâu hơn bất cứ ai ở {town} từng dám.", "Tầng {deep}?! Cậu điên thật rồi. Điên một cách đáng nể.", "Người ta bắt đầu kể chuyện về cậu - kẻ đã xuống tới tầng {deep}."],
  lastGiftLoved: ["Tôi vẫn còn giữ {item} cậu tặng hôm trước. Quý lắm!", "Món {item} lần trước... cậu biết tôi thích gì thật đấy.", "Tôi kể với cả {town} về {item} cậu tặng rồi đó!"],
  lastGiftHated: ["Còn vụ {item} lần trước... tôi vẫn chưa quên đâu.", "Lần này đừng tặng tôi {item} nữa nhé. Làm ơn.", "{item}? Thật á? Tôi vẫn đang cố hiểu cậu nghĩ gì khi tặng nó."],
  wasRude: ["Tôi vẫn nhớ cậu đã nói gì lần trước. Cậu chưa xin lỗi đâu.", "Hôm nay cậu định ăn nói tử tế chứ?", "Lần trước cậu làm tôi buồn đấy, biết không."],
  joked: ["Câu đùa hôm trước của cậu làm tôi cười cả tối!", "Hôm nay có chuyện gì buồn cười nữa không?", "Tôi kể lại chuyện cười của cậu cho cả quán, ai cũng cười!"],
  questDone: ["Nhờ cậu giúp lần trước mà mọi chuyện ổn thỏa cả. Tôi nợ cậu.", "Tôi vẫn chưa cảm ơn cậu đàng hoàng vì chuyện hôm trước.", "Chuyện cậu giúp tôi, cả {town} đều biết rồi."],
  friendRecruited: ["Cậu đưa {friend} đi cùng rồi à? Chăm sóc họ giùm tôi nhé.", "{friend} gửi thư về, kể về những chuyến đi với cậu. Ghen tị ghê.", "Từ khi {friend} theo cậu, {town} vắng hẳn."],
  rainyDay: ["Mưa thế này mà vẫn tới thăm tôi, cảm động quá.", "Trời mưa, ngồi đây uống trà với tôi đi."],
  playerReincarnated: ["Cậu cũng là người chuyển sinh à? Tôi cũng vậy! Ở thế giới cũ tôi là... thôi, không quan trọng.", "Người chuyển sinh à... Cậu có nhớ mình chết thế nào không? Tôi thì nhớ rõ lắm."],
  morningMood: ["Hôm nay tôi thấy tâm trạng tốt kỳ lạ.", "Sáng nay tôi dậy muộn, bị mắng một trận.", "Hôm nay tôi hơi mệt, nói chuyện ngắn thôi nhé.", "Tôi mơ thấy một giấc mơ kỳ lạ đêm qua."],
};

/** Backstory chapters, unlocked by affinity. Each chapter picks one line from the pool. */
export const BIO: string[][] = [
  [
    "Tôi sinh ra ở {town}, chưa từng rời khỏi tầng {floor}.",
    "Tôi đến đây từ tầng trên, khi làng cũ bị quái vật san phẳng.",
    "Tôi là người chuyển sinh. Mở mắt ra đã thấy mình nằm giữa {region}.",
    "Cha mẹ tôi là thương nhân. Họ đi buôn một chuyến rồi không bao giờ về.",
    "Tôi được một {race} nhận nuôi từ khi còn đỏ hỏn.",
    "Tôi từng là lính của một vương quốc đã sụp đổ ở tầng dưới.",
  ],
  [
    "Điều tôi sợ nhất là bị lãng quên. Nên tôi cố làm việc tốt nhất có thể.",
    "Tôi có một người em gái. Cô ấy mất tích ở {region} ba năm trước.",
    "Tôi từng mắc một sai lầm khiến cả đội thám hiểm bỏ mạng. Tôi là người duy nhất sống sót.",
    "Tôi mơ được một lần nhìn thấy bầu trời thật.",
    "Tôi đang để dành tiền để mua một mảnh đất trên Thánh Địa của ai đó.",
    "Tôi đã hứa với một người bạn sẽ xuống tới tầng 10. Tôi vẫn chưa làm được.",
  ],
  [
    "Có một bí mật: tôi có thể nghe thấy tiếng Vực Sâu thì thầm vào đêm trăng.",
    "Thật ra tên tôi không phải {me}. Tên thật của tôi bị một lời nguyền lấy mất.",
    "Tôi từng gặp {boss} khi nó còn là người. Nó đã từng... tử tế.",
    "Tôi mang trong người một mảnh tinh thể của Boss Canh Cửa. Nó làm tôi sống lâu hơn bình thường.",
    "Tôi đã từng phản bội một người rất quan trọng. Tôi vẫn đang tìm cách chuộc lỗi.",
    "Tôi biết đường tắt tới tầng dưới. Nhưng tôi thề không bao giờ đi con đường đó lần nữa.",
  ],
  [
    "Tôi đã quyết định rồi: dù cậu đi đâu, tôi cũng sẽ tin cậu.",
    "Cậu là người đầu tiên tôi kể hết mọi chuyện. Nhẹ lòng thật.",
    "Nếu một ngày cậu thoát khỏi Vực Sâu, hãy mang theo ký ức về tôi nhé.",
    "Tôi từng nghĩ mình sẽ chết một mình ở đây. Giờ thì không nữa.",
    "Tôi muốn nhìn thấy cậu đứng trước cánh cửa tầng 100.",
  ],
];

export const REPLY_TOPICS = {
  joke: ["Kể một câu chuyện cười về thế giới cũ", "Trêu chọc một chút", "Làm mặt hề"],
  flatter: ["Khen ngợi họ", "Khen {town} thật đẹp", "Nói rằng họ rất tài giỏi"],
  rude: ["Cộc lốc bảo họ nói nhanh lên", "Chê bai {town}", "Phớt lờ và ngáp dài"],
};

export const REACT: Record<"joke" | "flatter" | "rude", { good: string[]; bad: string[] }> = {
  joke: { good: ["Ha ha ha! Cậu đúng là lạ đời!", "Phụt... được rồi, câu đó hay thật.", "Hì hì, thế giới cũ của cậu vui ghê."], bad: ["...Không vui.", "Cậu nghĩ thế là buồn cười à?", "Tôi không có thời gian cho trò đùa."] },
  flatter: { good: ["Ôi, cậu làm tôi ngại quá!", "Hừm, ít nhất cậu có mắt nhìn.", "Cảm ơn nhé, lâu lắm rồi mới có người nói vậy."], bad: ["Nịnh bợ không có tác dụng với tôi đâu.", "Cậu muốn gì thì nói thẳng ra.", "Lời hay ý đẹp thì rẻ lắm."] },
  rude: { good: ["Ha! Thẳng thắn đấy, tôi thích.", "Được, vào việc luôn."], bad: ["Cậu nói gì cơ?!", "Tôi sẽ nhớ thái độ này.", "Đi đi. Tôi không muốn nói chuyện nữa."] },
};

export const GIFT_REACT: Record<"love" | "like" | "neutral" | "hate", string[]> = {
  love: ["Trời ơi, {item}! Sao cậu biết tôi thích cái này nhất?!", "Đây... đây là {item}! Tôi sẽ giữ nó cả đời!", "{item}!! Cảm ơn cậu, thật lòng đấy!"],
  like: ["Ồ, {item}. Tôi thích lắm, cảm ơn nhé.", "Món quà dễ thương ghê. Cảm ơn cậu.", "{item} à? Đúng thứ tôi đang cần."],
  neutral: ["À... {item}. Cảm ơn.", "Cảm ơn nhé. Tôi sẽ tìm chỗ dùng nó.", "Ừm, được rồi. Ý tốt là chính."],
  hate: ["...{item}? Cậu đang đùa tôi à?", "Ghê quá, mang {item} ra xa tôi!", "Tôi ghét {item}. Cậu không biết à?"],
};

export const RECRUIT_TALK: Record<Persona, { yes: string[]; no: string[] }> = {
  cheerful: { yes: ["Đi cùng cậu á? Đương nhiên rồi! Chuyến phiêu lưu lớn đây!"], no: ["Ơ... tôi thích cậu, nhưng mình quen chưa đủ lâu. Nói chuyện thêm nhé!"] },
  grumpy: { yes: ["Hừ. Được thôi. Ai đó phải trông chừng cậu."], no: ["Tôi không đi đâu với người mới quen. Biến."] },
  shy: { yes: ["Tôi... tôi sẽ cố gắng hết sức! Đừng bỏ tôi lại nhé!"], no: ["X-xin lỗi... tôi chưa đủ can đảm... với người lạ..."] },
  proud: { yes: ["Ngươi đã chứng minh giá trị. Ta sẽ đồng hành cùng ngươi."], no: ["Ta không phục vụ kẻ ta chưa công nhận."] },
  greedy: { yes: ["Với tiền công hậu hĩnh vậy thì... chủ nhân ơi, đi đâu ạ?"], no: ["Tình cảm thì tốt đấy, nhưng tôi cần thứ leng keng hơn."] },
  kind: { yes: ["Nếu cháu cần, tôi sẽ đi. Ai đó phải chăm sóc cháu chứ."], no: ["Tôi còn nhiều người ở đây cần giúp đỡ. Có lẽ để sau nhé."] },
  mysterious: { yes: ["Sợi chỉ số phận của chúng ta đã quấn vào nhau. Ta đi."], no: ["Chưa phải lúc. Ngươi sẽ biết khi nào là lúc."] },
  brave: { yes: ["Ha ha! Cuối cùng cũng có người rủ! Đi thôi chiến hữu!"], no: ["Ta chỉ đi theo người ta tin tưởng. Hãy chiến đấu cùng ta thêm đã."] },
};

export const QUEST_TALK = {
  offer: {
    fetch: ["Cậu giúp tôi kiếm {n} {item} được không? Tôi sẽ trả công xứng đáng.", "Tôi đang cần gấp {n} {item}. Cậu có thể mang tới không?"],
    crop: ["Dân {town} đói rau quá. Cậu mang giúp {n} {item} từ nông trại của cậu được không?", "Tôi thèm {item} tươi. {n} cái thôi! Nông trại của cậu có trồng không?"],
    hunt: ["Quái vật quanh đây nhiều quá. Cậu hạ giúp {n} bầy được không?", "Tôi muốn đi hái thuốc nhưng quái vật chặn đường. Dọn giúp {n} bầy nhé?"],
    boss: ["Chừng nào {boss} còn sống, {town} còn chưa yên. Cậu có dám không?", "Hạ {boss} đi, và tôi sẽ trao cho cậu thứ quý nhất của tôi."],
  },
  progress: ["Việc tôi nhờ tới đâu rồi?", "Đừng quên lời hứa nhé.", "Tôi vẫn đang chờ đây."],
  done: ["Cậu làm được thật! Đây là phần thưởng của cậu.", "Tuyệt vời! Tôi biết mình không nhờ nhầm người.", "Cảm ơn, cảm ơn! Cậu cứu tôi một bàn thua trông thấy."],
};
