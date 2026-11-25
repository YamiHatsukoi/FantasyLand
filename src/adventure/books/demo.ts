/** Short demo book: exercises every feature of the engine. Replace with real books. */
import type { Book } from "../types";

export default {
  id: "demo",
  title: "Ngọn Hải Đăng Tắt Lửa",
  subtitle: "Truyện thử nghiệm",
  blurb: "Ngọn hải đăng trên vách đá đã tắt ba đêm liền, và tàu bè bắt đầu vỡ nát trên đá ngầm. Người gác đèn không thấy đâu. Làng chài cần một người dám leo lên đó.",
  start: "1",
  rules: {
    skill: { dice: 1, plus: 6 },
    stamina: { dice: 2, plus: 12 },
    luck: { dice: 1, plus: 6 },
    provisions: 3,
    provisionHeal: 4,
    gold: 5,
  },
  items: {
    potion: { name: "Bình Thuốc Rong Biển", icon: "🧪", desc: "Hồi 4 Thể Lực. Dùng được khi chiến đấu.", use: { fx: [{ stat: "stamina", add: 4 }], combat: true, label: "Uống" } },
    key: { name: "Chìa Khoá Đồng", icon: "🗝️", desc: "Gỉ xanh, khắc hình con sóng." },
    oil: { name: "Bình Dầu Cá Voi", icon: "🏺", desc: "Thứ dầu đốt sáng nhất mà làng chài biết." },
    charm: { name: "Bùa Vỏ Ốc", icon: "🐚", desc: "Cầm trong tay thấy lòng bình tĩnh lạ. Dùng: +2 May Mắn.", use: { fx: [{ stat: "luck", add: 2 }], label: "Nắm chặt" } },
  },
  enemies: {
    crow: { name: "Quạ Bão", skill: 5, stamina: 4, icon: "🐦‍⬛", color: "#5a6a8a", desc: "Lông ướt sũng, mắt đỏ như than." },
    sailor: { name: "Xác Thuỷ Thủ", skill: 6, stamina: 5, icon: "💀", color: "#4a8a7a" },
    hag: { name: "Mụ Rong Biển", skill: 9, stamina: 10, damage: 3, icon: "🧜‍♀️", color: "#2e8a5a", desc: "Kẻ đã thổi tắt ngọn lửa." },
  },
  sections: {
    "1": {
      title: "Bến Cá",
      mood: "town",
      text: "Gió biển quất mưa vào mặt bạn khi chiếc thuyền đưa đò cập bến. Phía xa, trên đỉnh vách đá, ngọn hải đăng đứng đen ngòm như một ngón tay chỉ lên trời.\n\nMột bà lão vá lưới ngẩng lên nhìn bạn. \"Ba đêm rồi,\" bà nói, \"đèn không sáng. Ông Hàm gác đèn cũng biến mất. Nếu cậu định lên đó, thì ghé quán Mỏ Neo trước đã — ở đó người ta biết nhiều chuyện.\"",
      choices: [
        { text: "Ghé quán Mỏ Neo", to: "2" },
        { text: "Đi thẳng lên con đường vách đá", to: "4" },
      ],
    },
    "2": {
      title: "Quán Mỏ Neo",
      mood: "town",
      text: "Quán ấm và nồng mùi cá nướng. Chủ quán bày trên quầy vài bình thuốc màu xanh rêu. Ở góc phòng, một thuỷ thủ say khướt lẩm bẩm về \"cái hang dưới chân vách, nơi nước triều hát\".",
      choices: [
        { text: "Mua một bình thuốc (3 vàng)", to: "3", cond: { gold: 3 }, fx: [{ gold: -3 }, { give: "potion" }] },
        { text: "Mời gã thuỷ thủ một cốc và nghe chuyện", to: "3b", cond: { gold: 1 }, fx: [{ gold: -1 }] },
        { text: "Rời quán, lên vách đá", to: "4" },
      ],
    },
    "3": {
      mood: "town",
      text: "Chủ quán gói bình thuốc vào miếng vải dầu. \"Đừng để ướt,\" ông dặn, như thể ngoài kia có chỗ nào còn khô.",
      choices: [
        { text: "Mời gã thuỷ thủ một cốc", to: "3b", cond: { gold: 1 }, fx: [{ gold: -1 }] },
        { text: "Lên vách đá", to: "4" },
      ],
    },
    "3b": {
      mood: "town",
      text: "Gã thuỷ thủ nốc cạn cốc rượu rồi ghé sát tai bạn. \"Dưới chân vách có cái hang. Ông Hàm cất dầu cá voi trong đó, trong cái rương khoá. Chìa thì ông ấy giữ trong ngọn đèn.\" Gã dúi vào tay bạn một chiếc vỏ ốc. \"Cầm lấy. Nó giữ tôi sống qua hai trận bão.\"",
      fx: [{ flag: "cave_hint" }, { give: "charm" }],
      choices: [{ text: "Cảm ơn gã và lên vách đá", to: "4" }],
    },
    "4": {
      title: "Ngã Ba Vách Đá",
      mood: "storm",
      text: "Con đường đá trơn trượt chia làm hai. Một lối bậc thang dẫn thẳng lên cửa hải đăng. Lối kia men xuống bãi đá, nơi sóng đánh vào miệng một cái hang tối.",
      choices: [
        { text: "Leo bậc thang lên cửa hải đăng", to: "5" },
        { text: "Xuống bãi đá, vào hang", to: "9" },
      ],
    },
    "5": {
      title: "Cửa Hải Đăng",
      mood: "storm",
      text: "Cửa hải đăng mở hé, đập lạch cạch trong gió. Khi bạn lại gần, hai bóng đen lao xuống từ mái đá — những con quạ to bằng con chó, lông ướt sũng, mắt đỏ như than hồng.",
      fight: { enemies: ["crow", "crow"], together: true, win: "6", flee: "4" },
    },
    "6": {
      title: "Tầng Trệt",
      mood: "ruin",
      text: "Bên trong lạnh và tối. Trên bàn là cuốn sổ trực của ông Hàm, dòng cuối viết nguệch ngoạc: \"Mụ đến từ biển. Mụ muốn bóng tối.\"\n\nTreo trên móc cạnh cầu thang là một chiếc chìa khoá đồng.",
      fx: [{ give: "key" }],
      choices: [
        { text: "Leo cầu thang xoắn ốc lên phòng đèn", to: "7" },
        { text: "Mang chìa khoá xuống hang tìm dầu", to: "9", cond: { notFlag: "oil_taken" }, hide: true },
      ],
    },
    "7": {
      title: "Cầu Thang Mục",
      mood: "ruin",
      text: "Cầu thang gỗ rên rỉ dưới chân bạn. Đến giữa chừng, một bậc gãy đôi — bạn phải nhảy qua khoảng trống tối om.",
      test: { stat: "skill", pass: "8", fail: "7f" },
    },
    "7f": {
      mood: "ruin",
      text: "Chân bạn trượt. Bạn đập sườn vào lan can trước khi kịp bám lấy và kéo mình lên. Đau điếng, nhưng vẫn còn sống.",
      fx: [{ stat: "stamina", add: -3 }],
      choices: [{ text: "Leo tiếp", to: "8" }],
    },
    "8": {
      title: "Phòng Đèn",
      mood: "night",
      text: "Phòng đèn ướt đẫm nước biển. Ngọn đèn lớn đã tắt ngấm, và cuộn mình quanh nó là một sinh vật quấn đầy rong rêu, mái tóc là những sợi tảo đen dài.\n\n\"Bóng tối là của ta,\" mụ rít lên, và lao về phía bạn.",
      fight: { enemies: ["hag"], win: "13" },
    },
    "9": {
      title: "Hang Triều",
      mood: "sea",
      text: "Nước triều rút để lộ lối vào hang, vách đá phát sáng lờ mờ vì rêu biển. Trong một hốc khô có một chiếc rương sắt có khoá. Sâu hơn nữa, bóng tối vọng ra tiếng lạch xạch như xương va vào nhau.",
      choices: [
        { text: "Mở rương bằng chìa khoá đồng", to: "10", cond: { all: [{ has: "key" }, { notFlag: "oil_taken" }] } },
        { text: "Đi sâu vào hang", to: "11", cond: { notFlag: "cave_cleared" }, hide: true },
        { text: "Quay lại ngã ba", to: "4" },
      ],
    },
    "10": {
      mood: "cave",
      text: "Ổ khoá kêu cách một tiếng. Trong rương là một bình dầu cá voi nặng trịch và một túi tiền nhỏ của ông Hàm.",
      fx: [{ give: "oil" }, { gold: 6 }, { flag: "oil_taken" }],
      choices: [
        { text: "Đi sâu vào hang", to: "11", cond: { notFlag: "cave_cleared" }, hide: true },
        { text: "Quay lại ngã ba", to: "4" },
      ],
    },
    "11": {
      title: "Lòng Hang",
      mood: "cave",
      text: "Hai cái xác thuỷ thủ đứng dậy từ vũng nước, áo quần còn dính vỏ hàu. Chúng không nói, chỉ giơ những lưỡi móc gỉ sét lên.",
      fight: { enemies: ["sailor", "sailor"], win: "12", flee: "9" },
    },
    "12": {
      mood: "cave",
      text: "Khi xác thứ hai đổ xuống, bạn thấy sau lưng chúng một cầu thang đá cũ khoét vào vách, dẫn thẳng lên hầm hải đăng. Trên bậc đầu tiên có một gói lương khô ai đó bỏ quên.",
      fx: [{ provisions: 1 }, { flag: "cave_cleared" }],
      choices: [
        { text: "Leo cầu thang bí mật lên hải đăng", to: "6", cond: { notFlag: "oil_taken" }, hide: true },
        { text: "Leo cầu thang bí mật lên hải đăng", to: "7", cond: { flag: "oil_taken" }, hide: true },
        { text: "Quay lại cửa hang", to: "9" },
      ],
    },
    "13": {
      title: "Thắp Lại Ngọn Lửa",
      mood: "night",
      text: "Mụ Rong Biển tan thành một vũng nước mặn. Ngoài khơi, bạn thấy ánh đèn của một con thuyền đang chòng chành tiến về phía đá ngầm. Phải thắp đèn, ngay bây giờ.",
      choices: [
        { text: "Đổ dầu cá voi vào ngọn đèn", to: "14", cond: { has: "oil" }, fx: [{ take: "oil" }] },
        { text: "Không có dầu — đốt tạm sổ trực và gỗ vụn, cầu may", to: "13t" },
      ],
    },
    "13t": {
      mood: "night",
      text: "Bạn chất giấy và gỗ vụn vào lòng đèn, châm lửa và cầu nguyện rằng gió sẽ không thổi tắt nó.",
      test: { stat: "luck", pass: "14", fail: "15" },
    },
    "14": {
      title: "Ánh Sáng Trở Lại",
      mood: "fire",
      text: "Ngọn lửa bùng lên, và chiếc gương lớn hắt ánh sáng vàng rực ra biển đêm. Con thuyền ngoài khơi đổi hướng, lướt qua đá ngầm trong gang tấc.\n\nSáng hôm sau, cả làng chài kéo lên vách đá. Bà lão vá lưới nắm tay bạn và nói: \"Từ nay, ngọn đèn này cũng là của cậu.\"",
      end: "victory",
    },
    "15": {
      mood: "sea",
      text: "Ngọn lửa yếu ớt chập chờn rồi tắt. Bạn chỉ còn biết nhìn con thuyền va vào đá ngầm trong tiếng gỗ vỡ. Sáng ra, bạn cứu được vài người dưới bãi — nhưng ngọn hải đăng vẫn đen ngòm, chờ một người khác.",
      end: "death",
    },
  },
} satisfies Book;
