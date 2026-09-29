import type { StoryEvent } from "./types";

export const INTRO: StoryEvent = {
  id: "intro",
  title: "Khởi Đầu",
  start: "s1",
  scenes: {
    s1: {
      text: "Mưa.\n\nÁnh đèn pha trắng xoá. Tiếng phanh rít lên xé toạc màn đêm — rồi im lặng.\n\nBạn không còn cảm thấy cơ thể mình. Chỉ còn bóng tối, và một giọng nói vang lên từ mọi hướng cùng một lúc.",
      next: "s2",
    },
    s2: {
      speaker: "Giọng Nói",
      text: "Một linh hồn lạc từ thế giới bên kia... Ngươi nghe thấy ta chứ? Tốt.\n\nVực Sâu đã chọn ngươi. Nhưng trước tiên, hãy cho ta biết — kiếp trước, ngươi là ai?",
      choices: [
        { text: "⚔️ Một kiếm sĩ kendo, luyện tập mỗi sáng ở võ đường của ông nội.", fx: [{ setClass: "warrior" }], next: "s3" },
        { text: "🔮 Một nghiên cứu sinh vật lý, say mê những phương trình của vũ trụ.", fx: [{ setClass: "mage" }], next: "s3" },
        { text: "🏹 Một nhiếp ảnh gia hoang dã, quen rình rập hàng giờ giữa rừng sâu.", fx: [{ setClass: "ranger" }], next: "s3" },
        { text: "🗡️ Một kẻ sống ngoài vòng pháp luật, nhanh tay hơn nhanh miệng.", fx: [{ setClass: "rogue" }], next: "s3" },
        { text: "✨ Một y tá cấp cứu, người đã cứu nhiều mạng sống hơn mình nhớ.", fx: [{ setClass: "cleric" }], next: "s3" },
        { text: "🛡️ Một lính cứu hỏa, người luôn lao vào nơi người khác chạy ra.", fx: [{ setClass: "guardian" }], next: "s3" },
      ],
    },
    s3: {
      speaker: "Giọng Nói",
      text: "Và tên của ngươi?",
      input: "name",
      next: "s4",
    },
    s4: {
      speaker: "Giọng Nói",
      text: "{hero}... Một cái tên hay. Hãy nhớ nó thật kỹ, vì dưới Vực Sâu, những kẻ quên tên mình sẽ trở thành một phần của nó.\n\nMột trăm tầng. Mỗi tầng là một thế giới. Ở tầng cuối cùng là Trái Tim Vực Sâu — kẻ chạm tới nó sẽ được ban một điều ước. Bất kỳ điều ước nào.\n\nKể cả... được trở về nơi ngươi thuộc về.",
      next: "s5",
    },
    s5: {
      text: "Bạn mở mắt.\n\nÁnh sáng xanh dịu lọc qua tán lá của một cái cây nhỏ — không, một cái mầm cây, cao ngang đầu gối, đang phát sáng. Xung quanh là một khoảng đất trống nhỏ, bao bọc bởi bóng tối đặc quánh như mực. Phía trên đầu, thay cho bầu trời, là một lớp sương mù phát sáng lờ mờ.",
      next: "s6",
    },
    s6: {
      speaker: "Mầm",
      portrait: "sprout",
      text: "Ối! Cuối cùng cậu cũng tỉnh rồi!\n\nTớ là Mầm — linh hồn của Hạt Giống Nữ Thần. Đây là Thánh Địa, nơi duy nhất trong cả Vực Sâu mà quái vật không thể bước vào.",
      choices: [
        { text: "Nữ Thần nào?", next: "s7a" },
        { text: "Làm sao để thoát khỏi đây?", next: "s7b" },
      ],
    },
    s7a: {
      speaker: "Mầm",
      portrait: "sprout",
      text: "Nữ Thần đã tạo ra Vực Sâu... hoặc đã bị nó nuốt chửng, tớ không nhớ rõ nữa. Tớ chỉ biết là tớ lớn lên nhờ những người như cậu. Mỗi khi cậu xây dựng, trồng trọt ở đây, Thánh Địa sẽ rộng thêm một chút.",
      next: "s8",
    },
    s7b: {
      speaker: "Mầm",
      portrait: "sprout",
      text: "Đi xuống. Chỉ có đi xuống thôi. Cổng Vực Sâu ở phía bắc sẽ đưa cậu tới tầng 1. Nhưng đừng vội — cậu cần chuẩn bị đã.",
      next: "s8",
    },
    s8: {
      speaker: "Mầm",
      portrait: "sprout",
      text: "Tớ để lại cho cậu một ít hạt giống, gỗ và đá. Hãy gieo hạt ở ô ruộng, xây một cái Bếp Lửa, rồi xuống Vực Sâu tìm nguyên liệu. Khi mệt, cứ về Nhà Chính ngủ một giấc — mỗi giấc ngủ là một ngày trôi qua, và cây trồng sẽ lớn lên.\n\nÀ, và... nếu cậu gặp những người khác từ thế giới của cậu dưới đó, hãy cẩn thận nhé.",
      choices: [{ text: "(Gật đầu) Mình hiểu rồi." }],
    },
  },
};
