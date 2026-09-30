/**
 * Dialogue for residents of the sanctuary (recruited companions living in the safe zone).
 * Placeholders: {p} player, {me} resident, {I}/{you} persona pronouns (tôi/cậu, ta/ngươi…),
 * {home} hometown, {job} job, {friend} a resident they like, {rival} one they don't, {other} any
 * resident, {partner} the player's partner, {item}, {place}, {topic}, {deep} deepest floor.
 */
import type { Persona } from "./npcText";

// ------------------------------------------------------------ pronouns
export const PRONOUNS: Record<Persona, { I: string; you: string }> = {
  cheerful: { I: "tớ", you: "cậu" },
  grumpy: { I: "tôi", you: "cậu" },
  shy: { I: "tớ", you: "cậu" },
  proud: { I: "ta", you: "ngươi" },
  greedy: { I: "tôi", you: "cậu" },
  kind: { I: "tôi", you: "cậu" },
  mysterious: { I: "ta", you: "ngươi" },
  brave: { I: "ta", you: "ngươi" },
};

// ------------------------------------------------------------ topics
export type Topic =
  | "food" | "battle" | "magic" | "music" | "nature" | "history" | "fashion" | "stars"
  | "animals" | "fishing" | "crafting" | "gossip" | "adventure" | "farming" | "books" | "money";

export const TOPICS: Record<Topic, { name: string; icon: string; ask: string[] }> = {
  food: { name: "Ẩm thực", icon: "🍲", ask: ["Món ăn ngon nhất {you} từng ăn là gì?", "Hôm nay tôi thử nấu một món mới, suýt cháy cả bếp.", "Ở {home} người ta hay ăn gì vào ngày lễ?"] },
  battle: { name: "Chiến đấu", icon: "⚔️", ask: ["{You} học đánh nhau từ ai vậy?", "Hôm qua tôi suýt bị một con quái hạ gục đấy.", "Theo {you}, vũ khí nào mạnh nhất?"] },
  magic: { name: "Phép thuật", icon: "✨", ask: ["{You} có tin phép thuật đến từ trái tim không?", "Tôi vừa học được một câu thần chú mới.", "Nếu được chọn một phép thuật, {you} chọn gì?"] },
  music: { name: "Âm nhạc", icon: "🎵", ask: ["{You} có biết bài hát nào của {home} không?", "Tối qua tôi nghe ai đó thổi sáo, hay lắm.", "Nhạc cụ nào hợp với {you} nhất nhỉ?"] },
  nature: { name: "Thiên nhiên", icon: "🌿", ask: ["Cây cối ở Thánh Địa dạo này xanh hẳn ra nhỉ?", "{You} thích mùa nào nhất?", "Tôi vừa thấy một bông hoa lạ mọc cạnh giếng."] },
  history: { name: "Lịch sử & truyền thuyết", icon: "📜", ask: ["{You} có biết truyền thuyết nào về Vực Sâu không?", "Hôm nay tôi thấy một tấm bia cổ ở tầng dưới.", "Ngày xưa {home} trông thế nào?"] },
  fashion: { name: "Thời trang", icon: "👗", ask: ["Bộ đồ hôm nay của {you} hợp ghê.", "{You} nghĩ tôi có nên đổi kiểu tóc không?", "Ở {home} người ta mặc gì vào ngày hội?"] },
  stars: { name: "Bầu trời sao", icon: "🌌", ask: ["Đêm qua {you} có ngắm sao không?", "Bầu trời Vực Sâu có sao thật không nhỉ?", "Nếu đặt tên cho một ngôi sao, {you} đặt là gì?"] },
  animals: { name: "Động vật", icon: "🐾", ask: ["{You} có thích mấy con gà ở chuồng không?", "Tôi thấy một con mèo hoang lảng vảng gần kho.", "Nếu được nuôi một con thú, {you} chọn con gì?"] },
  fishing: { name: "Câu cá", icon: "🎣", ask: ["{You} có biết câu cá không?", "Hôm qua tôi câu được một con to bằng cánh tay!", "Chỗ nào câu cá ngon nhất ở đây nhỉ?"] },
  crafting: { name: "Rèn đúc & chế tác", icon: "⚒️", ask: ["{You} có thấy thanh kiếm mới của tôi không?", "Lò rèn hôm nay kêu to quá.", "Nếu tự tay làm một món đồ, {you} sẽ làm gì?"] },
  gossip: { name: "Chuyện thiên hạ", icon: "🗣️", ask: ["Dạo này Thánh Địa có tin gì mới không?", "{You} có nghe chuyện của {other} chưa?", "Nghe nói có người sắp tỏ tình đấy..."] },
  adventure: { name: "Phiêu lưu", icon: "🗺️", ask: ["Chỗ xa nhất {you} từng đi là đâu?", "Tôi vừa về từ tầng {deep}, mệt nhoài.", "Nếu không có Vực Sâu, {you} muốn đi đâu?"] },
  farming: { name: "Trồng trọt", icon: "🌱", ask: ["Ruộng dạo này lên xanh ghê.", "{You} thích trồng cây gì nhất?", "Mùa này nên gieo hạt gì nhỉ?"] },
  books: { name: "Sách vở", icon: "📚", ask: ["{You} đang đọc cuốn gì vậy?", "Thư viện vừa có thêm mấy cuốn sách cũ.", "Cuốn sách đầu tiên {you} từng đọc là gì?"] },
  money: { name: "Tiền bạc & làm ăn", icon: "💰", ask: ["Giá quặng sắt dạo này tăng quá.", "{You} có muốn mở một cửa hàng không?", "Nếu có một trăm nghìn vàng, {you} làm gì?"] },
};
export const TOPIC_LIST = Object.keys(TOPICS) as Topic[];

/** What the resident says when the topic comes up. love / like / neutral / dislike. */
export const TOPIC_TALK: Record<Topic, { love: string[]; like: string[]; neutral: string[]; dislike: string[] }> = {
  food: {
    love: ["Món ngon nhất á? Canh cá chua ở {home}, mẹ {I} nấu. Chỉ nghĩ thôi đã chảy nước miếng!", "Ăn là niềm vui lớn nhất đời! Hôm nào {I} nấu cho {you} một nồi hầm, thề là {you} sẽ khóc.", "{I} có một cuốn sổ ghi hết công thức từ mọi tầng đã đi qua. Muốn xem không?", "Bánh mì mới ra lò, bơ tan chảy, thêm chút mật ong... thôi đừng nói nữa, {I} đói rồi.", "Người ta nói muốn hiểu một vùng đất thì phải ăn món của họ. {I} tin điều đó lắm."],
    like: ["Đồ ăn ở bếp Thánh Địa dạo này ngon hơn hẳn.", "{I} không kén ăn, nhưng món nướng thì không từ chối được.", "Nghe {you} nói mà {I} thấy đói ghê."],
    neutral: ["Ăn gì cũng được, miễn no là được.", "{I} không rành chuyện bếp núc lắm.", "Ừ, đồ ăn thì... cũng là đồ ăn."],
    dislike: ["Chuyện ăn uống à... {I} chẳng hứng thú mấy.", "Nói chuyện khác đi. {I} vừa ăn phải thứ gì đó kỳ quặc.", "{I} ăn chỉ để sống thôi, không cần bàn nhiều."],
  },
  battle: {
    love: ["Tiếng kim loại chạm nhau là bản nhạc hay nhất! Hôm nào đấu tập với {I} nhé!", "{I} học kiếm từ năm tám tuổi. Vết sẹo trên tay này là bài học đầu tiên.", "Mỗi trận đánh là một câu chuyện. Và {I} muốn là người kể chuyện cuối cùng.", "Bí quyết à? Đừng bao giờ nhìn vào vũ khí của đối thủ. Nhìn vào vai họ.", "Hôm qua {I} thấy {you} ra đòn. Nhanh lắm! Nhưng vẫn còn hở sườn đấy."],
    like: ["Đánh nhau thì không thích, nhưng biết tự vệ là cần.", "{I} có luyện chút ít. Đủ để không bị quái vật ăn thịt.", "Kể {I} nghe trận đánh gần nhất của {you} đi."],
    neutral: ["Đánh đấm à... việc cần làm thì làm thôi.", "{I} không có nhiều ý kiến về chuyện đó.", "Ừm, miễn là ai cũng về nhà an toàn."],
    dislike: ["{I} ghét máu. Nói chuyện khác được không?", "Đánh nhau mãi thì được gì chứ...", "Mỗi lần nghe về trận chiến là {I} lại nhớ tới những người đã mất."],
  },
  magic: {
    love: ["Phép thuật là ngôn ngữ của thế giới! Mỗi câu thần chú là một bài thơ.", "{I} từng thức ba đêm liền chỉ để làm một ngọn lửa bay lơ lửng. Đáng lắm!", "{You} có biết phép băng và phép sét kết hợp sẽ ra gì không? Để {I} giải thích...", "Ma lực ở Vực Sâu đặc hơn ở ngoài kia. Như không khí trước cơn mưa.", "{I} tin rằng ai cũng có phép thuật, chỉ là chưa tìm được cánh cửa thôi."],
    like: ["{I} biết vài phép vặt, như hâm nóng trà chẳng hạn.", "Phép thuật đẹp thật, dù {I} không giỏi lắm.", "Nhìn pháp sư thi triển phép, {I} thấy như xem pháo hoa."],
    neutral: ["Phép thuật hả... người biết thì biết thôi.", "{I} tin vào đôi tay mình hơn.", "Cũng hay, nhưng {I} không hiểu mấy."],
    dislike: ["Phép thuật làm {I} rợn người. Nó... không tự nhiên.", "Lần cuối {I} dính vào phép thuật, tóc {I} xanh lè cả tuần.", "Đừng nhắc tới phép thuật. {I} có chuyện không vui với nó."],
  },
  music: {
    love: ["Âm nhạc là thứ duy nhất Vực Sâu không lấy đi được của chúng ta!", "{I} có thể hát cho {you} nghe bài ru của {home}. Nhưng chỉ khi không ai khác nghe thôi.", "Mỗi tầng có một nhịp điệu riêng. Tầng rừng thì lá xào xạc, tầng sa mạc thì cát hát.", "Nếu buồn, cứ gõ nhịp. Tim sẽ theo nhịp mà vui lên.", "Tối nay tụ họp bên lửa trại hát đi! {I} mang đàn."],
    like: ["{I} thích nghe người khác hát, còn tự hát thì thôi.", "Một chút nhạc khi làm việc thì tuyệt.", "Tiếng sáo tối qua là của ai vậy nhỉ? Hay ghê."],
    neutral: ["Nhạc à... cũng được.", "{I} không có tai nghe nhạc lắm.", "Ồn ào hay êm dịu thì {I} cũng không để ý."],
    dislike: ["Đừng hát gần {I}. Làm ơn.", "Âm nhạc làm {I} nhớ nhà. Mà nhớ nhà thì đau.", "Ồn quá. {I} thích yên tĩnh hơn."],
  },
  nature: {
    love: ["{You} có để ý không, cây sồi cạnh giếng mới ra lá non. {I} ngắm nó mỗi sáng.", "Đất có mùi riêng sau cơn mưa. {I} có thể ngửi ra mùa nào sắp tới.", "Ở {home}, {I} từng ngủ dưới gốc cây cổ thụ. Nó kể chuyện cho {I} nghe đấy, thật!", "Mỗi bông hoa dại đều là một kẻ phiêu lưu: nó chọn mọc ở nơi không ai ngờ.", "Thiên nhiên không vội. Nhưng mọi thứ vẫn hoàn thành. {I} muốn sống như vậy."],
    like: ["Trời hôm nay đẹp nhỉ.", "{I} thích đi dạo quanh ruộng vào buổi chiều.", "Cây cối xanh tốt thì lòng người cũng dịu lại."],
    neutral: ["Cây là cây thôi mà.", "Thời tiết à? Ừ, cũng được.", "{I} không để ý mấy chuyện đó."],
    dislike: ["Côn trùng. Bùn. Phấn hoa. Không, cảm ơn.", "{I} là dân thành thị, thiên nhiên hợp với người khác hơn.", "Lần trước {I} bị một cái cây... cắn. Đừng hỏi."],
  },
  history: {
    love: ["Mỗi tầng là một thế giới có lịch sử riêng. {I} muốn đọc hết những trang sử đó!", "Tấm bia ở tầng dưới? Chữ trên đó là cổ ngữ. {I} dịch được một nửa rồi!", "Người xưa ở {home} kể rằng... thôi, để {I} kể từ đầu, câu chuyện dài lắm.", "Lịch sử không phải chuyện đã qua. Nó là cái bóng chúng ta đang đứng trong đó.", "{You} có biết vì sao các thị trấn dưới Vực Sâu đều có một cái giếng không? {I} có giả thuyết đấy."],
    like: ["Truyền thuyết cũ nghe hay thật.", "{I} thích nghe người già kể chuyện xưa.", "Có những câu chuyện càng cũ càng đáng nhớ."],
    neutral: ["Chuyện cũ thì để người cũ nhớ.", "{I} sống cho hôm nay thôi.", "Ừm, nghe cũng thú vị... chắc vậy."],
    dislike: ["Quá khứ nên để yên. Đào lên chẳng được gì tốt.", "Học lịch sử làm {I} buồn ngủ.", "Nhắc tới chuyện xưa làm {I} nhớ những điều không muốn nhớ."],
  },
  fashion: {
    love: ["Ô! {You} để ý tới quần áo à? Cuối cùng cũng có người hiểu {I}!", "Thắt lưng này {I} tự may đấy. Da thằn lằn tầng sa mạc, bền mà đẹp.", "Đồ đẹp không cần đắt. Chỉ cần hợp với người mặc thôi.", "{I} đang thiết kế một chiếc áo choàng mới. Màu của bình minh, {you} thấy sao?", "Mặc đẹp là tôn trọng bản thân. Và tôn trọng người nhìn mình nữa!"],
    like: ["Bộ đồ này {I} thích lắm.", "{You} hợp màu này đó.", "Quần áo sạch sẽ là đủ rồi, đẹp thì càng tốt."],
    neutral: ["{I} mặc gì cũng được.", "Áo quần chỉ để che nắng che mưa thôi.", "Ừ, {I} không rành thời trang."],
    dislike: ["Chải chuốt mất thời gian lắm.", "{I} chỉ có ba bộ đồ, và {I} hạnh phúc.", "Chuyện ăn mặc để người khác lo đi."],
  },
  stars: {
    love: ["Bầu trời ở đây không có sao thật, nhưng những đốm sáng kia vẫn đẹp mà, phải không?", "{I} đã vẽ bản đồ những đốm sáng trên trần Vực Sâu. Chúng dịch chuyển mỗi mùa!", "Hồi nhỏ, {I} tin mỗi ngôi sao là một người đã ra đi đang nhìn xuống.", "Đêm nào trời trong, {I} nằm trên mái nhà ngắm tới sáng.", "Nếu có một ngôi sao mang tên {you}, {I} nghĩ nó sẽ sáng lắm."],
    like: ["Ngắm trời đêm làm lòng người lắng lại.", "{I} thích những đêm yên tĩnh.", "Có lần {I} thấy một vệt sáng lướt qua. Đã ước một điều đấy."],
    neutral: ["Trời tối thì đi ngủ thôi.", "Sao à... ừ, đẹp.", "{I} không để ý bầu trời lắm."],
    dislike: ["Đêm tối làm {I} bất an.", "Ngẩng đầu nhìn trời mãi thì vấp ngã đấy.", "Bóng tối trên kia... {I} không thích nhìn nó."],
  },
  animals: {
    love: ["Mấy con gà trong chuồng có tên hết rồi đấy, {I} đặt! Con mào đỏ là Tướng Quân.", "Con mèo hoang gần kho tin {I} rồi. Hôm qua nó để {I} vuốt ve ba giây!", "Động vật không nói dối. Nên {I} tin chúng hơn người.", "Ở {home}, {I} từng nuôi một con cáo nhỏ. Nó thông minh hơn khối người.", "{You} có muốn đi cho bò ăn cùng {I} không? Chúng thích được gãi tai."],
    like: ["{I} thích nhìn thú vật chạy nhảy.", "Con chó nào ở đây cũng dễ thương.", "Sữa sáng nay ngon lắm, nhờ mấy con bò đấy."],
    neutral: ["Thú vật thì cũng... có ích.", "{I} không ghét, không thích.", "Miễn là chúng không cắn {I}."],
    dislike: ["{I} bị dị ứng lông thú. Hắt xì liên tục.", "Chúng nhìn {I} như muốn ăn thịt vậy.", "Lần cuối {I} lại gần một con dê... thôi, đừng nhắc."],
  },
  fishing: {
    love: ["Câu cá là thiền đấy! Ngồi chờ, thở đều, rồi BỤP! Cả thế giới dồn vào cần câu.", "Hôm qua {I} câu được con cá chép vảy vàng. Thả đi rồi, nó đẹp quá không nỡ.", "Mồi ngon nhất là giun đất sau mưa. Bí kíp gia truyền của {I} đấy.", "Hồ cá ở Thánh Địa có một con cá rất khôn. {I} với nó đấu trí cả tháng nay rồi.", "Có hôm nào rảnh, đi câu với {I} nhé. Không cần nói gì cũng được."],
    like: ["Câu cá thư giãn thật.", "{I} không giỏi câu nhưng thích ngồi bên nước.", "Cá nướng tối qua ngon lắm."],
    neutral: ["Chờ cá cắn câu lâu quá.", "{I} chưa câu bao giờ.", "Cá thì mua ở chợ cho nhanh."],
    dislike: ["Ngồi im một chỗ hàng giờ? Không, cảm ơn.", "Mùi cá tanh lắm.", "{I} không biết bơi, nên tránh xa nước."],
  },
  crafting: {
    love: ["Đưa đây xem! ...Đường rèn đẹp đấy, nhưng góc lưỡi hơi lệch. Để {I} chỉ cho.", "Nghe lò rèn kêu là {I} thấy yên lòng. Như tiếng tim đập của Thánh Địa.", "{I} đang làm một cái hộp nhạc nhỏ. Còn thiếu mỗi cái lò xo thôi.", "Đồ tự tay làm có linh hồn. Đồ mua thì không.", "Nếu {you} mang cho {I} ít thỏi kim loại tốt, {I} làm cho {you} một món bất ngờ."],
    like: ["{I} thích xem người khác rèn.", "Đồ thủ công lúc nào cũng có cái duyên.", "{I} tự sửa được giày của mình đấy."],
    neutral: ["Đồ dùng được là được.", "{I} không khéo tay lắm.", "Việc đó để thợ làm."],
    dislike: ["Tiếng búa làm {I} đau đầu.", "Lần trước {I} đập trúng ngón tay cái. Hết ham.", "Bụi bặm, khói lửa... không hợp với {I}."],
  },
  gossip: {
    love: ["Chuyện nóng đây! {other} dạo này hay đứng một mình ngẩn ngơ... chắc là đang tương tư ai đó!", "Nghe nói {friend} vừa làm vỡ cái bình của Mầm. Mầm không giận, nhưng lá rũ xuống cả buổi.", "{I} biết hết mọi chuyện ở Thánh Địa này. Hỏi đi, hỏi gì cũng được!", "Suỵt, đừng nói với ai nhé... {rival} vẫn chưa trả tiền rượu tháng trước.", "{You} có để ý {other} dạo này ăn mặc chỉn chu hơn không? Có chuyện đấy!"],
    like: ["{I} có nghe loáng thoáng vài chuyện.", "Nói nhỏ thôi, người ta nghe thấy đấy.", "Chuyện của người khác thì cũng thú vị thật."],
    neutral: ["{I} không để ý chuyện người khác.", "Ai làm gì thì kệ họ.", "Có chuyện gì à? {I} không biết."],
    dislike: ["Nói sau lưng người khác không hay đâu.", "{I} không thích buôn chuyện.", "Nếu có chuyện gì, hãy hỏi thẳng người đó."],
  },
  adventure: {
    love: ["Chỗ xa nhất á? Chưa đâu! Chỗ xa nhất là chỗ {I} sẽ tới ngày mai!", "Mỗi lần cầu thang xuống tầng mới mở ra, tim {I} đập như trống trận!", "Bản đồ của {I} đây, đánh dấu hết những chỗ muốn tới. Còn trống cả trang.", "Nghe nói {you} xuống tới tầng {deep}. Kể đi, dưới đó trông thế nào?", "Nguy hiểm à? Đó là gia vị của cuộc đời!"],
    like: ["Đi xa cũng thú vị, nhưng {I} vẫn thích về nhà.", "Kể {I} nghe chuyến đi gần nhất đi.", "Mỗi tầng một vẻ, đúng là lạ lùng."],
    neutral: ["Đi đâu thì cũng về đây thôi.", "{I} thích ở một chỗ hơn.", "Ừ, phiêu lưu... cũng được."],
    dislike: ["{I} đã đi đủ xa cho cả một đời rồi.", "Phiêu lưu là cách nói hoa mỹ của chuyện suýt chết.", "Thánh Địa là đủ rồi. {I} không muốn xuống nữa."],
  },
  farming: {
    love: ["Mầm cà chua {I} gieo tuần trước đã nhú lên rồi! Nhỏ xíu mà kiêu hãnh ghê.", "Đất tốt là đất biết thở. Bóp thử một nắm xem, nó phải tơi như bánh.", "Mùa gặt là mùa {I} yêu nhất. Mệt nhưng lòng thì no.", "{You} có biết tưới cây vào sáng sớm thì lá không bị cháy không?", "Nếu {I} có một ước mơ nhỏ, đó là cả Vực Sâu đều xanh như ruộng nhà mình."],
    like: ["Ruộng dạo này đẹp ghê.", "{I} phụ nhổ cỏ vài hôm, thấy vui vui.", "Rau tự trồng ăn ngọt hơn hẳn."],
    neutral: ["Trồng trọt thì có người lo rồi.", "{I} không rành cây cối lắm.", "Miễn có cái ăn là được."],
    dislike: ["Đau lưng lắm. {I} làm một lần là đủ.", "Bùn đất dính đầy móng tay. Ghê.", "Việc nông để người khác làm đi."],
  },
  books: {
    love: ["{I} đang đọc một cuốn về các loài nấm phát sáng. Chương bảy làm {I} nổi da gà!", "Một cuốn sách hay giống một người bạn tốt: gặp lại lúc nào cũng thấy điều mới.", "Thư viện Thánh Địa có một cuốn không ghi tên tác giả. {I} nghĩ nó đang theo dõi {I}.", "Nếu {you} chưa biết đọc gì, {I} có cả danh sách! Dài ba trang.", "Mùi giấy cũ là mùi {I} thích nhất trên đời."],
    like: ["{I} đọc vài trang trước khi ngủ.", "Sách hay thì {I} cũng mê.", "Có cuốn nào hay giới thiệu {I} với."],
    neutral: ["{I} không đọc nhiều.", "Chữ nghĩa làm {I} buồn ngủ.", "Sách à... để lúc rảnh."],
    dislike: ["Sách vở là của mấy người ngồi một chỗ.", "{I} học qua tay, không qua chữ.", "Đọc mãi đau mắt lắm."],
  },
  money: {
    love: ["Tiền không mua được hạnh phúc, nhưng mua được bánh ngọt. Mà bánh ngọt là hạnh phúc!", "Giá quặng lên xuống như thủy triều. Ai nắm được nhịp là giàu.", "{I} đã tính rồi: nếu Thánh Địa mở thêm một chợ, lợi nhuận tăng ba phần!", "Một đồng vàng tiết kiệm là một đồng vàng kiếm được. Câu này {I} xăm trong tim.", "{You} có muốn hợp tác làm ăn với {I} không? Chia bảy ba. {I} bảy."],
    like: ["Có chút tiền trong túi thì yên tâm hơn.", "Làm ăn cũng thú vị ra phết.", "{I} đang để dành mua một thứ."],
    neutral: ["Tiền đủ tiêu là được.", "{I} không giỏi tính toán.", "Vàng bạc thì ai chẳng cần."],
    dislike: ["Nói chuyện tiền bạc làm mất vui.", "Tiền là thứ làm người ta quên mất nhau.", "{I} ghét cái cách vàng làm người ta thay đổi."],
  },
};

// ------------------------------------------------------------ persona colour
/** Short interjections that give the same line a persona's voice. */
export const FLAVOR: Record<Persona, { up: string[]; down: string[] }> = {
  cheerful: { up: ["Ôi! ", "Á à, ", "Hí hí, ", "Trời ơi, "], down: ["Ơ... ", "Hừm, ", "Ờ thì... "] },
  grumpy: { up: ["Hừm. Cái này thì được. ", "...Ừ. ", "Hừ, "], down: ["Chán ngắt. ", "Hừ. ", "Lại nữa à. "] },
  shy: { up: ["À... ừm... ", "Ơ, ", "Thật ra thì... "], down: ["Ừm... xin lỗi... ", "À... ", "Tớ... "] },
  proud: { up: ["Dĩ nhiên rồi. ", "Hừ, câu hỏi hay. ", "Ngươi hỏi đúng người đấy. "], down: ["Chủ đề tầm thường. ", "Hừ. ", "Ta không phí lời. "] },
  greedy: { up: ["Nói tới đó là tôi tỉnh cả người! ", "Hà, ", "Nghe có lời đấy! "], down: ["Chuyện đó thì kiếm được mấy đồng? ", "Chậc, ", "Hừm... "] },
  kind: { up: ["Ồ, ", "Hay quá, ", "Để tôi kể nhé, "], down: ["Ừ... ", "Ồ, ", "Chà... "] },
  mysterious: { up: ["...Thú vị. ", "Hừm... ", "Ngươi hỏi điều đó à. "], down: ["... ", "Hừm. ", "Không quan trọng. "] },
  brave: { up: ["Ha! ", "Tuyệt! ", "Hay lắm! "], down: ["Chậc. ", "Hừ, ", "Thôi đi. "] },
};

/** A resident's verbal tic, appended now and then. */
export const TICS = [
  "Nhỉ?", "Thật đấy!", "Hì.", "Nói vậy thôi.", "Đừng cười nhé.", "...Ừ.", "Hiểu chứ?", "Phải không nào?",
  "Hà hà.", "Tin {I} đi.", "Chắc chắn luôn.", "Thế đấy.", "Ờ, đại loại vậy.", "Đúng không?", "Hừm hừm.", "Nhớ đấy!",
];

// ------------------------------------------------------------ greetings (resident tier by friendship hearts)
/** by persona: [0-1♥, 2-3♥, 4-6♥, 7-10♥] */
export const RES_GREET: Record<Persona, string[][]> = {
  cheerful: [
    ["Chào {p}! Thánh Địa rộng ghê, {I} vẫn còn lạc đường hoài!", "Ê {p}! Hôm nay {you} tính làm gì?", "A, chủ nhân Thánh Địa đây rồi!"],
    ["{p}! Đúng lúc {I} đang chán!", "Hôm nay trời đẹp mà gặp {you} nữa, tuyệt!", "Ê, lại đây, {I} có chuyện kể!"],
    ["{p}!! {I} đợi {you} cả sáng đấy!", "Ngày nào gặp {you} là ngày đó vui!", "Cuối cùng {you} cũng tới! {I} để dành chuyện hay cho {you} đó."],
    ["Mỗi sáng thức dậy, {I} lại mong được gặp {you}.", "{p}... {you} là điều tuyệt nhất từng xảy ra với {I} ở Vực Sâu này.", "Chỉ cần thấy {you} cười là {I} vui cả ngày!"],
  ],
  grumpy: [
    ["Hử. Là {you}. Có việc gì?", "Thánh Địa ồn ào quá. ...Chào.", "Đừng đứng chắn đường."],
    ["Lại là {you}. Được rồi, nói đi.", "{p}. Hôm nay đỡ mệt hơn hôm qua.", "Hừ, {you} tới đúng lúc {I} vừa pha trà."],
    ["...Ngồi xuống đi. Trà còn nóng.", "{p}. {I} không nói ra đâu, nhưng thấy {you} là được rồi.", "Hôm nay {you} không bị thương chứ? Hỏi vậy thôi."],
    ["Nếu {you} biến mất, Thánh Địa này sẽ chán lắm. ...Thế thôi.", "{p}. {I} đã quen có {you} bên cạnh rồi. Phiền thật.", "Ai làm {you} buồn thì bảo {I}."],
  ],
  shy: [
    ["À... chào {p}...", "Ơ, {you}... {I} không làm phiền chứ?", "*vẫy tay rất nhỏ*"],
    ["{p}... chào buổi sáng...", "{I}... có nghĩ về câu chuyện hôm qua của {you}...", "Ừm... gặp {you} {I} thấy đỡ run hơn."],
    ["{p}! À... {I} lỡ gọi to quá...", "{I} có để dành cho {you} một chỗ ngồi nè...", "Nói chuyện với {you} là {I} quên cả ngại."],
    ["Ở cạnh {you}... {I} thấy mình can đảm hơn.", "{p}... nếu {you} đi xa, nhớ về nhé. {I} sẽ đợi.", "{You} là người đầu tiên thật sự lắng nghe {I}."],
  ],
  proud: [
    ["Chủ nhân Thánh Địa. Ta chào ngươi.", "{p}. Ngươi cần lời khuyên của ta à?", "Hừm, ngươi dậy sớm đấy."],
    ["{p}. Thánh Địa của ngươi... tạm được.", "Ngươi tìm ta? Khôn ngoan.", "Hôm nay ta có tâm trạng trò chuyện. Ngươi may mắn đấy."],
    ["{p}, ngươi xứng đáng để ta dành thời gian.", "Ngồi đi. Ta sẽ không nói hai lần đâu.", "Ta đã nghe về chiến công của ngươi. Không tệ."],
    ["Ngươi là người duy nhất ta coi là ngang hàng, {p}.", "Nếu có ai dám khinh thường ngươi, họ sẽ phải trả lời ta.", "Ta tự hào vì được đứng cạnh ngươi. Đừng cười."],
  ],
  greedy: [
    ["Ông chủ! À không, {p}! Hôm nay có việc gì kiếm được không?", "Chào chào! Túi {you} nghe leng keng dễ thương ghê.", "{p}! Thánh Địa này có tiềm năng làm ăn lắm!"],
    ["{p}! Vị khách... à, người bạn quý nhất tuần này!", "Nghe nói kho đang đầy. Tốt, tốt lắm!", "Hôm nay {I} có tin đồn đáng giá đây."],
    ["Với {you} thì {I} tính giá hữu nghị. Thật đấy.", "{p}, {you} làm {I} tin là có thứ quý hơn vàng. Đáng sợ thật.", "{I} để dành cho {you} món hời nhất."],
    ["Có những thứ không mua được bằng vàng. {You} là một trong số đó.", "Két của {I} mở cho {you}. Chỉ {you} thôi.", "{p}, {you} làm {I} thành người tốt hơn. Khủng khiếp."],
  ],
  kind: [
    ["Chào {p}. Ăn sáng chưa đấy?", "Ồ, {p}. Hôm nay {you} trông mệt quá.", "Chào {you}. Thánh Địa yên bình thật."],
    ["{p}! Lại đây, {I} vừa nướng bánh.", "Hôm nay có chuyện gì buồn không? Kể {I} nghe.", "Thấy {you} khỏe là {I} mừng."],
    ["{p}, {I} đã cầu nguyện cho {you} tối qua.", "Lại đây, để {I} xem {you} có bị thương không.", "Nhà có {you} là ấm hẳn lên."],
    ["{You} như người nhà của {I} vậy.", "Dù {you} đi tới đâu, nơi này vẫn chờ {you}.", "{I} biết ơn vì đã gặp được {you}, {p}."],
  ],
  mysterious: [
    ["...Ngươi đến rồi. Như ta đoán.", "Gió hôm nay mang tên ngươi, {p}.", "Đừng hỏi ta nghĩ gì. Hỏi ngươi cảm thấy gì."],
    ["Sợi chỉ số phận lại dẫn ngươi tới ta.", "{p}. Ngươi mơ gì đêm qua?", "Có những điều chỉ nói được khi trời chạng vạng."],
    ["Ta sẽ kể ngươi nghe một điều chưa ai biết.", "Ngươi bắt đầu nhìn thấy những điều người khác không thấy, {p}.", "Có những cánh cửa chỉ mở cho người ta tin."],
    ["Ta đã đi qua nhiều kiếp. Hiếm khi gặp linh hồn như ngươi.", "Nếu thế giới sụp đổ, ta vẫn đứng về phía ngươi.", "Tên thật của ta... ngươi là người thứ hai biết."],
  ],
  brave: [
    ["Ha! Chủ nhân Thánh Địa! Tay có ngứa không?", "{p}! Hôm nay xuống Vực Sâu không?", "Chào, chiến hữu!"],
    ["{p}! Lần trước hạ được bao nhiêu con?", "Gặp lại rồi! Đấu tập một trận không?", "Ta vừa mài kiếm xong. Sẵn sàng rồi!"],
    ["Chiến hữu! Uống một chén không?", "Nghe kể về chiến công của ngươi mà ta nóng cả máu!", "{p}, ta muốn luôn được chiến đấu cạnh ngươi."],
    ["Sau lưng ngươi có ta. Luôn luôn.", "Nếu phải ngã xuống, ta muốn ngã khi bảo vệ ngươi.", "Anh em một nhà, {p}! Không, còn hơn thế."],
  ],
};

/** Mood of the day, told when asked "how are you". by mood -2..2 */
export const MOOD_TALK: Record<string, string[]> = {
  "-2": ["Hôm nay tệ lắm. {I} không muốn nói nhiều.", "{I} mơ thấy {home} bị cháy. Tỉnh dậy vẫn còn run.", "Đừng hỏi. Thật đấy, đừng hỏi."],
  "-1": ["Hơi mệt một chút. Chắc tại ngủ không ngon.", "Tâm trạng {I} hôm nay như trời đầy mây.", "Có chút chuyện buồn, nhưng không sao đâu."],
  "0": ["Bình thường thôi. Làm việc, ăn, ngủ.", "Cũng ổn. Thánh Địa hôm nay yên ả.", "Không vui không buồn. Kiểu một ngày giữa tuần ấy."],
  "1": ["Khá tốt! {I} vừa làm xong một việc đang dở.", "Vui vui! Sáng nay {friend} kể chuyện cười.", "Hôm nay trời đẹp, lòng {I} cũng nhẹ."],
  "2": ["Tuyệt vời! {I} cảm thấy có thể đấm bay cả một con rồng!", "Hôm nay là ngày đẹp nhất tuần! Đừng hỏi tại sao, {I} cũng không biết!", "{I} đang vui lắm, và {you} làm nó vui hơn nữa."],
};

// ------------------------------------------------------------ deep talk (values)
export type Value = "kind" | "bold" | "honest" | "funny" | "practical" | "romantic" | "loyal" | "free";
export const VALUE_NAMES: Record<Value, string> = {
  kind: "tử tế", bold: "gan dạ", honest: "thẳng thắn", funny: "hài hước", practical: "thực tế", romantic: "lãng mạn", loyal: "chung thủy", free: "tự do",
};

/** A question the resident asks; each answer shows a value. */
export const DEEP_QUESTIONS: { q: string; a: [string, Value][] }[] = [
  { q: "Nếu phải chọn giữa cứu một người lạ và giữ lấy chiến lợi phẩm cả tháng trời, {you} chọn gì?", a: [["Cứu người. Đồ thì kiếm lại được.", "kind"], ["Còn tùy người lạ đó là ai.", "practical"], ["Cứu người, rồi cướp lại chiến lợi phẩm từ tay quái vật!", "bold"]] },
  { q: "{You} có sợ chết không?", a: [["Có chứ. Sợ nhưng vẫn bước tiếp.", "honest"], ["Tôi chết một lần rồi, lần hai chắc quen.", "funny"], ["Tôi sợ những người mình thương phải ở lại một mình hơn.", "loyal"]] },
  { q: "Nếu có thể quay về thế giới cũ ngay bây giờ, {you} có đi không?", a: [["Không. Ở đây có những người tôi không nỡ rời.", "loyal"], ["Có lẽ... tôi vẫn nhớ nhà.", "honest"], ["Thế giới nào cũng được, miễn là tôi được tự do chọn.", "free"]] },
  { q: "{You} nghĩ tình yêu là gì?", a: [["Là khi ở cạnh ai đó, im lặng cũng thấy dễ chịu.", "romantic"], ["Là chọn một người, mỗi ngày, dù có chuyện gì.", "loyal"], ["Là thứ khiến người ta làm chuyện ngốc nghếch. Và tôi thích chuyện ngốc nghếch.", "funny"]] },
  { q: "Có ai đó nói dối {you} để bảo vệ {you}. {You} có tha thứ không?", a: [["Có. Ý tốt quan trọng hơn.", "kind"], ["Tôi thà nghe sự thật đau lòng còn hơn.", "honest"], ["Tha thứ, nhưng sẽ nhớ.", "practical"]] },
  { q: "Điều gì làm {you} thấy mình còn sống nhất?", a: [["Khoảnh khắc trước trận đánh lớn.", "bold"], ["Một bữa ăn ấm với bạn bè.", "kind"], ["Khi nhìn thấy một chân trời mới.", "free"]] },
  { q: "Nếu Thánh Địa chỉ đủ lương thực cho một nửa số người, {you} sẽ làm gì?", a: [["Chia đều, mọi người cùng nhịn một chút.", "kind"], ["Xuống Vực Sâu kiếm thêm, ngay đêm nay.", "bold"], ["Lên kế hoạch trồng trọt lại từ đầu.", "practical"]] },
  { q: "{You} có tin vào định mệnh không?", a: [["Tôi tin mình tự viết định mệnh.", "free"], ["Có. Nếu không, sao ta gặp được nhau?", "romantic"], ["Tôi tin vào kế hoạch dự phòng.", "practical"]] },
  { q: "Kỷ niệm đẹp nhất của {you} là gì?", a: [["Chưa có. Tôi đang đợi nó.", "romantic"], ["Ngày tôi dựng căn nhà đầu tiên ở Thánh Địa.", "practical"], ["Lần tôi ngã sấp mặt trước cả làng. Cười tới giờ.", "funny"]] },
  { q: "Nếu {I} phạm một sai lầm lớn, {you} sẽ làm gì?", a: [["Nói thật với {you}, rồi cùng sửa.", "honest"], ["Đứng về phía {you}, dù thế nào.", "loyal"], ["Pha trò cho {you} bớt căng rồi tính tiếp.", "funny"]] },
  { q: "{You} thích một cuộc sống yên ổn hay một cuộc sống rực rỡ?", a: [["Yên ổn. Có nhà, có ruộng, có người thương.", "loyal"], ["Rực rỡ! Chết già trên giường thì phí lắm.", "bold"], ["Tôi muốn được chọn mỗi ngày.", "free"]] },
  { q: "Có ai từng làm {you} tổn thương chưa?", a: [["Có. Nhưng tôi đã bỏ qua rồi.", "kind"], ["Có, và tôi học được cách tự đứng lên.", "bold"], ["Tôi không muốn nói về chuyện đó... nhưng cảm ơn đã hỏi.", "honest"]] },
  { q: "Nếu được tặng một món quà bất kỳ, {you} muốn gì?", a: [["Một buổi chiều không ai làm phiền.", "free"], ["Một lá thư tay.", "romantic"], ["Một thanh kiếm tốt. Thực tế mà.", "practical"]] },
  { q: "{You} có bao giờ thấy cô đơn ở đây không?", a: [["Có. Nhưng nói chuyện thế này thì đỡ hơn nhiều.", "honest"], ["Không, vì có mọi người.", "loyal"], ["Cô đơn là lúc tôi nghĩ ra trò đùa hay nhất.", "funny"]] },
  { q: "Luật lệ hay trái tim, {you} nghe theo cái nào?", a: [["Trái tim.", "romantic"], ["Luật lệ, vì nó bảo vệ nhiều người hơn.", "practical"], ["Cái nào để tôi tự do hơn.", "free"]] },
  { q: "Nếu một người bạn muốn rời Thánh Địa mãi mãi, {you} có giữ họ lại không?", a: [["Không. Tôi sẽ tiễn họ bằng một bữa tiệc.", "kind"], ["Tôi sẽ nói thật là tôi buồn.", "honest"], ["Tôi sẽ đi cùng họ một đoạn.", "loyal"]] },
  { q: "Một con quái vật đầu hàng và cầu xin tha mạng. {You} làm gì?", a: [["Tha. Ai cũng xứng có cơ hội thứ hai.", "kind"], ["Tha, nhưng theo dõi nó.", "practical"], ["Hỏi nó có biết đường tắt xuống tầng dưới không.", "funny"]] },
  { q: "Điều gì {you} không bao giờ tha thứ?", a: [["Phản bội.", "loyal"], ["Làm hại người yếu thế.", "kind"], ["Bị nhốt lại.", "free"]] },
  { q: "{You} muốn được nhớ đến như thế nào?", a: [["Người đã đi tới tầng cuối cùng.", "bold"], ["Người đã khiến ai đó cười.", "funny"], ["Người đã không bỏ rơi ai.", "loyal"]] },
  { q: "Nếu phải nói một lời nói dối để cứu cả Thánh Địa, {you} có nói không?", a: [["Có, không chút do dự.", "practical"], ["Có, nhưng sau đó tôi sẽ thú nhận.", "honest"], ["Tôi sẽ tìm cách khác. Luôn có cách khác.", "bold"]] },
  { q: "Một ngày mưa, không có việc gì làm. {You} sẽ...", a: [["Ngủ tới trưa, không hối hận.", "free"], ["Nấu một nồi canh cho cả xóm.", "kind"], ["Ngồi bên cửa sổ, viết một bài thơ dở tệ.", "romantic"]] },
];

/** Reactions to an answer, by how much the resident values it. */
export const DEEP_REACT = {
  good: ["...{I} cũng nghĩ vậy. Thật đấy.", "Câu trả lời đó làm {I} quý {you} hơn.", "Hóa ra {you} là người như vậy. {I} thích điều đó.", "{I} sẽ nhớ câu trả lời này.", "Lần đầu có người trả lời giống hệt {I} nghĩ."],
  neutral: ["Hừm, cũng có lý.", "{I} hiểu. Mỗi người mỗi cách.", "Ra vậy. Để {I} ngẫm thêm.", "Câu trả lời thú vị đấy."],
  bad: ["...Ồ. {I} không nghĩ vậy lắm.", "Hừm. {I} thì khác.", "{I} tôn trọng, nhưng không đồng ý.", "Ừ... chắc chúng ta nhìn đời khác nhau."],
};

// ------------------------------------------------------------ flirting
export type FlirtStyle = "sweet" | "playful" | "poetic" | "bold";
export const FLIRT_LINES: Record<FlirtStyle, { name: string; icon: string; lines: string[] }> = {
  sweet: { name: "Ngọt ngào", icon: "🌸", lines: ["Hôm nay trông {me} rạng rỡ lắm.", "Gặp {me} là mệt mỏi bay đi hết.", "Tôi để dành ly trà ngon nhất cho {me} đó.", "Mỗi lần về Thánh Địa, người đầu tiên tôi muốn gặp là {me}."] },
  playful: { name: "Trêu đùa", icon: "😏", lines: ["{me} có biết mình đang cản đường không? Cản đường tim tôi ấy.", "Nghe nói nhìn lâu vào mắt ai đó sẽ bị trúng bùa. Thử không?", "Tôi đánh bại Boss Canh Cửa rồi, nhưng thua {me} mất rồi.", "Thánh Địa có cả trăm người, sao tôi cứ đi lạc tới chỗ {me} vậy nhỉ?"] },
  poetic: { name: "Thơ mộng", icon: "🌙", lines: ["Nếu Vực Sâu có sao thật, chắc chúng đang ghen tị với đôi mắt {me}.", "Tôi đã đi qua bao tầng đất, nhưng chưa nơi nào bình yên như cạnh {me}.", "Có những người như ngọn đèn giữa hầm tối. {me} là một người như thế.", "Mỗi mùa ở đây một khác, chỉ có tôi là vẫn vậy: vẫn nghĩ về {me}."] },
  bold: { name: "Thẳng thắn", icon: "💘", lines: ["Tôi thích {me}. Tôi nghĩ nên nói ra.", "Đi dạo với tôi tối nay nhé? Chỉ hai ta.", "Tôi không giỏi nói hay. Nhưng tôi muốn ở cạnh {me} nhiều hơn.", "{me} có ai trong lòng chưa? Vì tôi muốn ứng tuyển."] },
};

/** Reactions to flirting, by persona: receptive (they like it) / awkward (too early) / cold (not interested). */
export const FLIRT_REACT: Record<Persona, { yes: string[]; early: string[]; no: string[] }> = {
  cheerful: { yes: ["Á! {You} nói gì vậy chứ! *mặt đỏ bừng* ...Nói lại lần nữa đi.", "Hí hí, {I} biết mà! {I} biết {you} để ý {I}!", "Tim {I} vừa nhảy lộn một vòng đấy, {you} chịu trách nhiệm đi!"], early: ["Ơ... ha ha, {you} vui tính ghê! ...Đùa phải không?", "Ối, {I} không biết trả lời sao nữa!"], no: ["Ha ha, {you} đùa hay thật! Mình là bạn tốt nhất mà, đúng không?", "{I} quý {you} lắm... nhưng theo kiểu khác, {you} hiểu mà."] },
  grumpy: { yes: ["...Nói linh tinh. *quay mặt đi, tai đỏ ửng*", "Hừ. Nếu {you} nghiêm túc thì... {I} không phản đối.", "Đồ ngốc. ...Ngồi xuống cạnh {I} đi."], early: ["Đừng nói mấy câu sến súa đó với {I}.", "{You} bị sốt à?"], no: ["Đừng. {I} không có hứng mấy chuyện đó.", "Tìm người khác mà nói mấy câu đó."] },
  shy: { yes: ["*che mặt* ...Thật... thật không? {I}... {I} cũng... ừm...", "{I}... {I} sẽ nhớ câu này cả đời...", "Đ-đừng nhìn {I} như vậy... tim {I} đập nhanh quá..."], early: ["*đỏ mặt, chạy trốn sau cột*", "{I}... {I} không biết phải nói gì..."], no: ["X-xin lỗi... {I} chỉ coi {you} là bạn thôi...", "{I}... chưa sẵn sàng cho chuyện đó. Mãi mãi có lẽ..."] },
  proud: { yes: ["Hừm. Ngươi có mắt nhìn đấy. ...Ta cũng vậy.", "Ta chấp nhận tình cảm của ngươi. Đừng làm ta thất vọng.", "Ngươi là người đầu tiên dám nói vậy với ta. ...Ta thích lòng can đảm đó."], early: ["Ngươi quá tự tin rồi đấy.", "Còn sớm lắm, kẻ phiêu lưu."], no: ["Ta không có thời gian cho những chuyện đó.", "Ngươi nhầm người rồi."] },
  greedy: { yes: ["Tình cảm của {you}? Thứ quý nhất {I} từng được tặng. Không bán đâu!", "{I} đã tính rồi, ở bên {you} lãi to. Về mọi mặt.", "Ối, lời tỏ tình miễn phí! {I} nhận hết!"], early: ["Khen thì khen, nhưng quà đâu?", "Lời ngọt thì rẻ lắm, {you} ạ."], no: ["{I} là người làm ăn, không làm chuyện tình cảm.", "Hợp đồng này {I} không ký đâu."] },
  kind: { yes: ["Ôi... {I} cũng đã mong được nghe câu đó.", "{You} dịu dàng quá. {I} không biết phải đáp lại sao cho xứng.", "Trái tim {I} ấm lên rồi, {p}."], early: ["{You} tốt bụng quá. Nhưng mình nên hiểu nhau thêm, nhé?", "Ồ... {I} bất ngờ quá."], no: ["{I} quý {you} như người nhà. Chỉ vậy thôi, xin lỗi nhé.", "{I} không thể đáp lại theo cách đó. Nhưng {I} luôn ở đây."] },
  mysterious: { yes: ["Ta đã thấy khoảnh khắc này trong giấc mơ. Và ta đã mong nó thành thật.", "...Ngươi dám nói vậy với ta. Được. Ta sẽ không để ngươi hối hận.", "Sợi chỉ của chúng ta... đã thắt nút rồi."], early: ["Chưa phải lúc, {p}.", "Ngươi còn chưa biết ta là ai."], no: ["Trái tim ta đã trao cho một thứ khác từ lâu.", "Đừng. Ở gần ta không tốt cho ngươi đâu."] },
  brave: { yes: ["Ha! Ta cũng định nói vậy! Ngươi nhanh hơn ta một nhịp!", "Được! Từ giờ ta sẽ bảo vệ ngươi bằng cả hai lý do.", "Tim ta chưa bao giờ đập mạnh thế, kể cả trước trận đánh lớn."], early: ["Ha ha! Ngươi đùa vui đấy, chiến hữu.", "Đánh thắng ta một trận rồi nói tiếp."], no: ["Ta coi ngươi là chiến hữu. Chiến hữu thì không vậy.", "Ta không hợp mấy chuyện tình cảm, xin lỗi."] },
};

/** Things a partner says once dating / married. */
export const PARTNER_TALK = {
  dating: ["Hôm nay {I} nghĩ về {you} suốt. Lạ thật, trước đây {I} đâu như vậy.", "Đi cẩn thận nhé. Nhớ là có người đợi {you} ở đây.", "{I} kể với {friend} chuyện của mình rồi. {friend} bảo {I} cười nhiều hơn hẳn.", "Tối nay ngồi cạnh nhau bên lửa trại nhé?", "Cầm tay {I} một chút thôi. Được không?"],
  married: ["Chào buổi sáng, mình. {I} để phần bữa sáng trên bàn rồi đó.", "Có {you} rồi, căn nhà này mới là nhà.", "Hôm nay xuống Vực Sâu hả? Nhớ về ăn tối. {I} nấu món {you} thích.", "Mỗi đêm {I} vẫn đợi tiếng bước chân {you} trở về.", "Ngày cưới hôm đó, {I} vẫn nhớ từng chi tiết.", "{I} yêu {you}. Chỉ muốn nói vậy thôi."],
  jealous: ["{I} nghe nói {you} hay nói chuyện ngọt ngào với {other} lắm...", "{You} vui không, khi nói mấy câu đó với người khác?", "{I} không muốn ghen đâu. Nhưng tim {I} không nghe lời."],
};

// ------------------------------------------------------------ dates
export type DatePlace = "walk" | "stars" | "dinner" | "fishing" | "garden" | "library" | "temple" | "training" | "market" | "hotspring";
export const DATES: Record<DatePlace, { name: string; icon: string; needs: string[]; topic: string; scene: string[] }> = {
  walk: { name: "Đi dạo quanh Thánh Địa", icon: "🚶", needs: [], topic: "nature", scene: ["Hai người thong thả đi dọc bờ ruộng. {me} kể về {home}, còn {p} kể về thế giới cũ.", "Mầm vẫy lá khi hai người đi ngang qua. Gió mang mùi cỏ mới cắt."] },
  stars: { name: "Ngắm sao bên đài phun nước", icon: "🌌", needs: ["fountain", "park", "watchtower", "statue", "observatory", "gazebo"], topic: "stars", scene: ["Hai người nằm trên bãi cỏ cạnh đài phun nước, nhìn lên những đốm sáng trên trần Vực Sâu.", "{me} chỉ vào một đốm sáng nhỏ: \"Cái kia. Từ giờ nó tên là {p}.\""] },
  dinner: { name: "Ăn tối ở Quán Rượu", icon: "🍷", needs: ["tavern", "kitchen", "inn", "bakery"], topic: "food", scene: ["Quán hôm nay đông vui. Hai người chọn góc bàn gần lò sưởi.", "{me} gọi món đặc biệt nhất quán, rồi ăn trộm một miếng từ đĩa của {p}."] },
  fishing: { name: "Câu cá ở hồ", icon: "🎣", needs: ["fishpond", "well", "fisherhut", "lily_pond"], topic: "fishing", scene: ["Hai cần câu, một mặt hồ phẳng lặng. Không ai nói gì mà vẫn thấy dễ chịu.", "Phao chìm xuống cùng lúc cả hai cần! Hai người nhìn nhau rồi phá lên cười."] },
  garden: { name: "Dạo vườn hoa", icon: "🌷", needs: ["flowers", "greenhouse", "herbgarden", "park", "tree", "orchard", "sakura", "rose_bush"], topic: "farming", scene: ["Vườn hoa nở rộ. {me} cúi xuống ngửi một bông, rồi gài nó lên tóc {p}.", "Ong mật bay vo ve. {me} kể tên từng loài hoa, sai gần hết mà vẫn tự tin."] },
  library: { name: "Đọc sách cùng nhau", icon: "📖", needs: ["library", "academy"], topic: "books", scene: ["Thư viện yên tĩnh. Hai người ngồi đọc chung một cuốn sách, đầu gần chạm nhau.", "{me} đọc to một đoạn thơ cổ, giọng hơi run ở câu cuối."] },
  temple: { name: "Thắp nến ở đền", icon: "🕯️", needs: ["temple", "clinic"], topic: "history", scene: ["Ánh nến lung linh. {me} chắp tay, khẽ nói một lời nguyện không cho ai nghe.", "Khi bước ra, {me} bảo: \"{I} đã nguyện cho cả hai chúng ta.\""] },
  training: { name: "Đấu tập", icon: "🤺", needs: ["training"], topic: "battle", scene: ["Hai thanh kiếm gỗ va vào nhau. {me} đánh thật, không nhường chút nào.", "Trận đấu kết thúc khi cả hai cùng ngã ra cỏ, thở hổn hển mà vẫn cười."] },
  market: { name: "Dạo chợ phiên", icon: "🧺", needs: ["market"], topic: "money", scene: ["Chợ phiên rộn ràng. {me} trả giá say sưa như đang đánh trận.", "{me} mua một chiếc vòng nhỏ, rồi lén đeo vào tay {p}."] },
  hotspring: { name: "Ngâm chân suối nước ấm", icon: "♨️", needs: ["bathhouse", "clinic", "palace"], topic: "nature", scene: ["Hơi nước bốc lên mờ ảo. Hai người ngâm chân, kể nhau nghe chuyện xấu hổ nhất đời.", "{me} bảo đây là nơi duy nhất {I} thấy mình không phải gồng lên."] },
};
export const DATE_END = {
  great: ["Trên đường về, {me} khẽ nắm lấy tay {p}. \"Hôm nay là một ngày {I} sẽ nhớ mãi.\"", "\"Lần sau lại đi nữa nhé,\" {me} nói, mắt sáng lấp lánh.", "{me} cười suốt cả buổi. \"{I} không nhớ lần cuối mình vui thế này là khi nào.\""],
  good: ["\"Cảm ơn {you} đã rủ {I},\" {me} mỉm cười.", "Một buổi chiều dễ chịu. {me} vẫy tay chào tạm biệt, còn ngoái lại hai lần.", "\"Không tệ chút nào,\" {me} nói, và có vẻ thật lòng."],
  meh: ["{me} lịch sự, nhưng có vẻ hơi chán. Có lẽ lần sau nên chọn chỗ khác.", "\"Ừm... cũng được,\" {me} nói, nhìn ra xa.", "{me} ngáp một cái rồi vội che miệng. \"Xin lỗi, không phải tại {you} đâu.\""],
};

// ------------------------------------------------------------ ambient
/** Short bubbles while walking around the sanctuary. */
export const AMBIENT: Record<Persona, string[]> = {
  cheerful: ["La la la~", "Hôm nay đẹp trời ghê!", "Ai muốn chơi đuổi bắt không?", "Mầm ơi, chào buổi sáng!", "Bánh mì thơm quá!"],
  grumpy: ["Hừ.", "Ồn quá...", "Ai để cái xô ở đây vậy?", "Lại mưa nữa à.", "Mệt."],
  shy: ["...", "*lí nhí hát*", "Ừm...", "*giật mình*", "Hôm nay mình sẽ chào ai đó..."],
  proud: ["Thánh Địa cần một bức tượng. Của ta.", "Hừm, tạm được.", "Không ai sánh bằng ta.", "Đường này cần lát đá lại."],
  greedy: ["Giá lúa lên rồi!", "*đếm tiền*", "Chỗ này mở quán thì lời to.", "Một đồng, hai đồng..."],
  kind: ["Mọi người ăn gì chưa?", "Cẩn thận kẻo ngã nhé.", "Hoa nở đẹp quá.", "Để tôi giúp một tay."],
  mysterious: ["...Gió đổi hướng rồi.", "*nhìn xa xăm*", "Đêm nay sẽ có điềm.", "Ngươi nghe thấy không?"],
  brave: ["Ha! Hôm nay xuống tầng mấy?", "*vung kiếm tập*", "Tay ngứa quá!", "Ai đấu tập không?"],
};
export const AMBIENT_ANY = ["Chào buổi sáng!", "Hôm nay ăn gì nhỉ?", "Mầm lại lớn thêm rồi kìa.", "Nhớ nhà ghê.", "Trời hôm nay {weather}.", "Thánh Địa ngày càng đông vui.", "Ai thấy cây búa của tôi đâu không?", "*ngáp dài*"];

/** Two residents chatting: [a, b] line pairs. */
export const PAIR_TALK: [string, string][] = [
  ["Hôm qua cậu ngủ ngon không?", "Ngon lắm, mơ thấy bánh ngọt."],
  ["Nghe nói {p} vừa xuống tầng sâu.", "Ừ, lo ghê. Mong là về an toàn."],
  ["Mùa này trồng gì được nhỉ?", "Củ cải. Lúc nào cũng là củ cải."],
  ["Kiếm của cậu mài chưa?", "Mài rồi, sắc tới mức cắt được gió."],
  ["Tối nay có lửa trại không?", "Có! Tớ mang đàn."],
  ["Cậu thấy Mầm cười chưa?", "Thấy rồi, dễ thương lắm."],
  ["Nhớ nhà không?", "Có. Nhưng ở đây cũng là nhà rồi."],
  ["Hôm nay trời đẹp thật.", "Ừ, đẹp như ngày tớ tới đây."],
  ["Cậu nợ tớ một ly rượu đấy.", "Tớ nhớ mà! ...Mai nhé."],
  ["Có nghe gì mới không?", "Suỵt, lại đây, tớ kể..."],
  ["Mệt quá...", "Ngồi nghỉ đi, để tớ làm nốt."],
  ["Cậu có sợ Vực Sâu không?", "Có. Nhưng sợ cùng nhau thì đỡ hơn."],
];

/** Gossip about other residents. */
export const GOSSIP = {
  friend: ["{friend} là người tốt lắm. Hôm trước còn giúp {I} vá mái nhà.", "{I} với {friend} hay ngồi uống trà buổi chiều. {You} nên tham gia!", "Nếu {you} buồn, hãy nói chuyện với {friend}. Người đó biết cách lắng nghe."],
  rival: ["{rival} lại chiếm chỗ ngồi yêu thích của {I}. Lần thứ ba rồi đấy.", "{I} với {rival} không hợp nhau lắm. Không ghét, chỉ là... không hợp.", "Đừng kể với {rival} là {I} nói vậy nhé."],
  partner: ["Nghe nói {you} với {partner} đang hẹn hò hả? Chúc mừng nha!", "{partner} dạo này cười nhiều hơn hẳn. Là nhờ {you} đấy.", "Hai người đẹp đôi lắm. Thật đấy."],
  flirty: ["{You} biết không, nhiều người ở đây để ý {you} lắm đấy.", "Nghe đồn {you} ngọt ngào với ai cũng như nhau...", "Cẩn thận nhé, tim người ta không phải đồ chơi."],
};
