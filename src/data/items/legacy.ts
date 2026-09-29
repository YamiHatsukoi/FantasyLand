import { C, I } from "./core";

// Materials from the first release (ids must stay stable for existing saves).
I("wood", "Gỗ Cổ Thụ", "material", 2, "Gỗ cứng từ những cây cổ thụ biết thì thầm.", "log", ["#8a5a2a", C.paleWood, "#ffffff"], { tier: 1, tags: ["forest"], icon: "🪵" });
I("stone", "Đá Tảng", "material", 2, "Đá xây dựng thông thường.", "stone", ["#8a8f96", C.darkStone, "#ffffff"], { tier: 1, tags: ["forest"], icon: "🪨" });
I("herb", "Thảo Dược Rừng", "herb", 3, "Lá thuốc mọc dưới tán rừng ẩm. Có thể nhai trực tiếp để hồi chút máu.", "herb", ["#4f9a45", C.green, "#ffffff"], { tier: 1, tags: ["forest"], icon: "🌿" });
I("hide", "Da Thú", "material", 4, "Tấm da dày từ thú hoang.", "hide", ["#8a5a3a", C.brown, "#ffffff"], { tier: 1, tags: ["forest"], icon: "🟫" });
I("fang", "Nanh Sói", "material", 5, "Nanh sắc của sói rừng.", "fang", ["#f4efe6", "#c8b890", "#ffffff"], { tags: ["monster"], icon: "🦷" });
I("slime_gel", "Gel Slime", "material", 3, "Chất nhầy dẻo, có tính kết dính.", "gel", ["#6fcf5a", "#3f9a3a", "#ffffff"], { tags: ["monster"], icon: "🟢" });
I("mushroom_cap", "Mũ Nấm Phát Sáng", "material", 5, "Mũ nấm phát ánh sáng xanh dịu, giàu ma lực.", "mushroom", ["#5ab0ff", "#efe0c0", "#d0f0ff"], { tier: 1, icon: "🍄" });
I("sandstone", "Sa Thạch", "material", 4, "Đá cát màu mật ong từ sa mạc.", "stone", ["#e0b870", "#a07a40", "#ffffff"], { tier: 2, tags: ["desert"], icon: "🧱" });
I("amber", "Hổ Phách", "material", 12, "Nhựa hoá thạch, đôi khi chứa sinh vật bên trong.", "gem", ["#f0a030", "#ffffff", "#ffffff"], { tier: 2, tags: ["desert"], icon: "🟠" });
I("chitin", "Giáp Xác", "material", 8, "Mảnh vỏ cứng của côn trùng sa mạc.", "shell", ["#d9912b", "#7a4a1a", "#ffffff"], { tags: ["monster"], icon: "🪲" });
I("bone", "Xương Khô", "material", 4, "Xương tẩy trắng bởi nắng sa mạc.", "bone", ["#e8dcc0", "#b8a888", "#ffffff"], { tags: ["monster"], icon: "🦴" });
I("linen", "Vải Liệm Cổ", "material", 6, "Vải liệm ngàn năm vẫn còn bền chắc.", "cloth", ["#e8dcc0", "#b8a888", "#ffffff"], { tier: 2, icon: "🧻" });
I("cactus_fruit", "Quả Xương Rồng", "crop", 5, "Ngọt, mọng nước — báu vật của sa mạc.", "fruit", ["#e84a6a", "#4f9a45", "#ffffff"], { tier: 2, icon: "🌵" });
I("peat", "Than Bùn", "material", 4, "Nhiên liệu cháy âm ỉ, rất bắt lửa.", "stone", ["#5a3a2a", "#2a1a10", "#ffffff"], { tier: 3, tags: ["swamp"], icon: "🟤" });
I("glowmoss", "Rêu Phát Quang", "herb", 7, "Rêu phát sáng dịu, xua tan tà khí.", "herb", ["#6aff9a", "#2a8a5a", "#ffffff"], { tier: 3, tags: ["swamp"], icon: "🟩" });
I("soul_wax", "Sáp Linh Hồn", "material", 14, "Sáp từ những ngọn đèn giam giữ linh hồn.", "wax", ["#e8e0f0", "#8a7ab0", "#8ad8ff"], { tier: 3, icon: "🕯️" });
I("pearl", "Ngọc Trai Đen", "material", 40, "Ngọc trai sinh ra từ nước mắt của vương quốc chìm.", "pearl", ["#3a3a4a", "#ffffff", "#ffffff"], { tier: 3, tags: ["swamp"], icon: "⚫" });
I("mana_crystal", "Tinh Thể Ma Lực", "material", 25, "Ma lực kết tinh. Dùng để nghiên cứu kỹ năng.", "crystal", ["#5ab0ff", "#2a4a8a", "#d0f0ff"], { icon: "💎" });
I("monster_core", "Lõi Quái Vật", "material", 30, "Trái tim kết tinh của quái vật mạnh.", "orb", ["#e83a3a", "#5a1a1a", "#ffffff"], { icon: "🔴" });
I("black_thorn", "Gai Đen", "key", 0, "Chiếc gai đen rút ra từ Boss Canh Cửa. Nó vẫn còn ấm, và dường như đang đập.", "thorn", ["#2a1a2a", "#5a2a5a", "#ff3a6a"], { icon: "🖤" });
