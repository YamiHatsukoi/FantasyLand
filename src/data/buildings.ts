import { hashString } from "../core/rng";
import type { Station } from "./items/recipeTypes";

export type Cost = Record<string, number>; // item id -> amount, "gold" for gold

export type BuildingCategory = "core" | "farm" | "production" | "craft" | "housing" | "service" | "decor" | "floor";

export interface BuildingDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  size: [number, number];
  maxLevel: number;
  unique: boolean;
  fixed?: boolean;
  rank: number; // settlement rank required to build
  category: BuildingCategory;
  station?: Station;
  housing?: number; // residents per level
  workers?: number; // workers needed per level
  appeal?: number; // attractiveness per level
  walkable?: boolean; // flat decor (paths, rugs): people walk over it
  /** Ground cover filling its whole tile; pieces of the same family join up (roads, plazas, ponds). */
  floor?: string;
  /** Rendering style: wall/roof colours and an item-icon emblem on the facade. */
  style?: { wall: string; roof: string; emblem?: string };
  first?: Cost; // explicit build cost (otherwise generated)
}

export const RANK_NAMES = ["", "Trại", "Xóm", "Làng", "Thị Trấn", "Thành Phố", "Kinh Đô"];
export const POP_REQ = [0, 0, 3, 8, 16, 30, 50];
export const FLOOR_REQ = [0, 1, 2, 3, 5, 7, 10];
export const TERRITORY_SIZES = [20, 28, 36, 44, 52, 64, 76, 88, 104, 120];
export const MAX_TERRITORY_FOR_RANK = [0, 1, 3, 4, 6, 8, 9];

const B = (d: BuildingDef) => d;

type Deco = [id: string, name: string, icon: string, size: [number, number], rank: number, appeal: number, first: Cost | undefined, desc: string, walkable?: boolean];
/** Decorations: they only make the sanctuary prettier (appeal draws settlers). */
const DECOR: Deco[] = [
  ["bench", "Ghế Gỗ", "🪑", [1, 1], 1, 1, { wood: 4 }, "Chỗ ngồi nghỉ chân."],
  ["stone_bench", "Ghế Đá", "🪨", [1, 1], 2, 1, { stone: 6 }, "Ghế đá mát lạnh dưới bóng cây."],
  ["paper_lantern", "Cột Đèn Lồng", "🏮", [1, 1], 1, 1, { wood: 3, fiber_forest: 2 }, "Đèn lồng giấy đỏ đung đưa trong gió."],
  ["street_lamp", "Đèn Đường Sắt", "💡", [1, 1], 3, 2, undefined, "Cột đèn sắt uốn cong kiểu thành phố."],
  ["torch", "Đuốc", "🔥", [1, 1], 1, 1, { wood: 2 }, "Ngọn đuốc cháy suốt đêm."],
  ["brazier", "Chậu Lửa", "🪔", [1, 1], 2, 1, { stone: 4, wood: 2 }, "Chậu đồng đỏ rực than hồng."],
  ["flower_pot", "Chậu Hoa", "🪴", [1, 1], 1, 1, { stone: 2, herb: 1 }, "Chậu gốm với cây cảnh xanh mướt."],
  ["sunflowers", "Khóm Hướng Dương", "🌻", [1, 1], 1, 1, { herb: 2 }, "Luôn quay về phía có ánh sáng."],
  ["rose_bush", "Bụi Hồng", "🌹", [1, 1], 2, 2, { herb: 3 }, "Hoa hồng đỏ thắm, có gai."],
  ["hedge", "Hàng Rào Cây", "🟩", [1, 1], 1, 1, { herb: 2, wood: 1 }, "Bụi cây cắt tỉa vuông vức."],
  ["fence_wood", "Hàng Rào Gỗ", "🪵", [1, 1], 1, 0, { wood: 2 }, "Rào gỗ mộc mạc."],
  ["fence_white", "Hàng Rào Trắng", "⬜", [1, 1], 2, 1, { wood: 2, stone: 1 }, "Rào gỗ sơn trắng kiểu nông trại."],
  ["fence_stone", "Tường Rào Đá", "🧱", [1, 1], 2, 1, { stone: 4 }, "Tường rào thấp xếp đá."],
  ["barrel", "Thùng Gỗ", "🛢️", [1, 1], 1, 0, { wood: 3 }, "Thùng gỗ đựng nước mưa."],
  ["crates", "Chồng Thùng Hàng", "📦", [1, 1], 1, 0, { wood: 4 }, "Hàng hoá chờ chuyển đi."],
  ["hay_bale", "Kiện Rơm", "🌾", [1, 1], 1, 1, { fiber_forest: 3 }, "Rơm khô thơm mùi nắng."],
  ["scarecrow", "Bù Nhìn", "🧑‍🌾", [1, 1], 1, 1, { wood: 2, fiber_forest: 2 }, "Canh ruộng cho khỏi chim. Trông hơi đáng sợ."],
  ["signpost", "Cột Chỉ Đường", "🪧", [1, 1], 1, 1, { wood: 3 }, "Chỉ về Vực Sâu, Nhà Chính và... tầng 100?"],
  ["mailbox", "Hộp Thư", "📮", [1, 1], 2, 1, { wood: 2, copper_ingot: 1 }, "Chưa ai gửi thư. Chưa."],
  ["bird_bath", "Bể Tắm Chim", "🐦", [1, 1], 2, 2, { stone: 5 }, "Chim chóc hay ghé tắm vào buổi sáng."],
  ["sundial", "Đồng Hồ Mặt Trời", "🕰️", [1, 1], 3, 2, undefined, "Dưới Vực Sâu nó chỉ giờ sai hoàn toàn."],
  ["bush", "Bụi Cây", "🌿", [1, 1], 1, 1, { herb: 2 }, "Bụi cây tròn xanh."],
  ["pine", "Cây Thông", "🌲", [1, 1], 1, 1, { wood: 3, herb: 1 }, "Cây thông cao vút."],
  ["sakura", "Cây Anh Đào", "🌸", [1, 1], 2, 3, undefined, "Hoa anh đào nở quanh năm ở Thánh Địa."],
  ["maple", "Cây Phong Đỏ", "🍁", [1, 1], 2, 2, undefined, "Lá đỏ như lửa."],
  ["palm", "Cây Cọ", "🌴", [1, 1], 2, 2, undefined, "Một chút nhiệt đới."],
  ["bamboo", "Khóm Trúc", "🎋", [1, 1], 1, 1, { wood: 2, herb: 1 }, "Trúc xanh xào xạc."],
  ["giant_mushroom", "Nấm Khổng Lồ", "🍄", [1, 1], 2, 2, { mushroom_cap: 3 }, "Nấm phát sáng to bằng người."],
  ["crystal_cluster", "Cụm Pha Lê", "💎", [1, 1], 3, 3, undefined, "Pha lê ngân nga khi có gió."],
  ["rock_garden", "Đá Cảnh", "🪨", [1, 1], 1, 1, { stone: 4 }, "Vài tảng đá rêu xếp đẹp mắt."],
  ["stone_lantern", "Đèn Đá Cổ", "🗼", [1, 1], 2, 2, { stone: 6 }, "Đèn đá kiểu đền cổ."],
  ["totem", "Cột Vật Tổ", "🗿", [1, 1], 2, 2, { wood: 6 }, "Tượng gỗ chạm khắc các linh thú."],
  ["banner", "Cờ Hiệu", "🚩", [1, 1], 1, 1, { wood: 2, fiber_forest: 2 }, "Cờ của Thánh Địa tung bay."],
  ["wind_chime", "Chuông Gió", "🎐", [1, 1], 2, 1, { wood: 2, copper_ingot: 1 }, "Leng keng mỗi khi có gió."],
  ["snowman", "Người Tuyết", "⛄", [1, 1], 1, 1, { stone: 1 }, "Không bao giờ tan. Phép thuật chăng?"],
  ["pumpkins", "Đống Bí Ngô", "🎃", [1, 1], 1, 1, { herb: 2 }, "Bí ngô mùa thu, có quả khắc mặt cười."],
  ["cart", "Xe Kéo", "🛒", [1, 1], 1, 1, { wood: 5 }, "Xe kéo chở đầy nông sản."],
  ["weapon_rack", "Giá Vũ Khí", "⚔️", [1, 1], 2, 1, { wood: 3, iron_ingot: 1 }, "Kiếm, giáo và khiên xếp gọn gàng."],
  ["cat_house", "Nhà Mèo", "🐈", [1, 1], 1, 2, { wood: 3 }, "Có một con mèo sống ở đây. Nó không trả tiền thuê."],
  ["dog_house", "Chuồng Chó", "🐕", [1, 1], 1, 2, { wood: 4 }, "Nhà của chú chó canh cổng."],
  ["campfire_ring", "Vòng Lửa Trại", "🏕️", [1, 1], 1, 1, { stone: 3, wood: 2 }, "Nơi mọi người quây quần kể chuyện."],
  ["angel_statue", "Tượng Thiên Thần", "👼", [1, 1], 4, 4, undefined, "Đôi cánh đá sải rộng."],
  ["sprout_statue", "Tượng Mầm", "🌱", [1, 1], 3, 3, undefined, "Mầm rất thích bức tượng này. Rất rất thích."],
  ["obelisk", "Bia Đá Cổ", "🪦", [1, 1], 3, 2, undefined, "Khắc những ký tự không ai đọc được."],
  ["stone_path", "Đường Lát Đá", "⬛", [1, 1], 1, 0, { stone: 2 }, "Lối đi lát đá. Đi xuyên qua được.", true],
  ["flower_carpet", "Thảm Hoa Dại", "💐", [1, 1], 1, 1, { herb: 1 }, "Hoa dại mọc thành thảm. Đi xuyên qua được.", true],
  ["picnic_rug", "Thảm Picnic", "🧺", [2, 2], 1, 2, { fiber_forest: 4 }, "Tấm thảm kẻ ô với giỏ bánh. Đi xuyên qua được.", true],
  ["lily_pond", "Hồ Sen", "🪷", [2, 2], 2, 4, undefined, "Hồ nhỏ với lá sen và cá chép."],
  ["gazebo", "Chòi Nghỉ", "⛱️", [2, 2], 3, 5, undefined, "Chòi lục giác cho những buổi chiều thong thả."],
  ["wood_bridge", "Cầu Gỗ Cong", "🌉", [2, 1], 2, 3, undefined, "Cây cầu cong kiểu vườn cảnh."],
  ["torii", "Cổng Đền", "⛩️", [2, 1], 3, 4, undefined, "Cổng đỏ đánh dấu nơi linh thiêng."],
  ["dragon_statue", "Tượng Rồng", "🐉", [2, 2], 5, 8, undefined, "Rồng đá cuộn mình canh giữ Thánh Địa."],
  // street furniture and garden pieces, all from things the sanctuary makes
  ["willow", "Cây Liễu Rủ", "🌳", [1, 1], 1, 2, { wood: 3, herb: 2 }, "Cành liễu rủ xuống như mành, đẹp nhất bên bờ nước."],
  ["lantern_tree", "Cây Đèn Đom Đóm", "🌟", [1, 1], 2, 3, { wood: 3, glass: 1, herb: 1 }, "Đèn lồng nhỏ treo khắp tán cây, sáng lung linh."],
  ["twin_lamp", "Cột Đèn Đôi", "🏮", [1, 1], 2, 2, { iron_ingot: 1, glass: 2 }, "Hai ngọn đèn kính trên cột sắt cho quảng trường."],
  ["cafe_table", "Bàn Ô Ngoài Trời", "⛱️", [1, 1], 2, 2, { plank_forest: 2, cloth_forest: 1 }, "Bàn tròn dưới chiếc ô sọc, có cả tách trà."],
  ["swing", "Xích Đu", "🪢", [1, 1], 1, 2, { wood: 3, rope: 1 }, "Xích đu gỗ cho lũ trẻ (và người lớn)."],
  ["mini_windmill", "Cối Xay Gió Nhỏ", "🌬️", [1, 1], 2, 2, { plank_forest: 2, cloth_forest: 1 }, "Cối xay gió trang trí, cánh quạt kẽo kẹt."],
  ["clock_post", "Cột Đồng Hồ", "🕰️", [1, 1], 3, 3, { iron_ingot: 1, glass: 1, gears: 1 }, "Đồng hồ phố trên cột sắt. Giờ ở Thánh Địa cuối cùng cũng đúng."],
  ["notice_board", "Bảng Tin", "📜", [1, 1], 1, 1, { plank_forest: 2, paper: 1 }, "Đầy giấy dán: tìm mèo lạc, bán bí ngô, mời đi câu."],
  ["flower_cart", "Xe Hoa", "🌺", [1, 1], 2, 3, { plank_forest: 2, herb: 3 }, "Xe đẩy chở đầy hoa tươi đủ màu."],
  ["stone_well_deco", "Giếng Ước", "🪙", [1, 1], 2, 3, { stone: 6, rope: 1 }, "Ném một đồng xu, ước một điều. Mầm đã ném rất nhiều."],
  ["topiary", "Cây Cắt Tỉa Hình Thú", "🐇", [1, 1], 2, 2, { herb: 3, stone: 1 }, "Bụi cây tỉa thành hình chú thỏ trong chậu đá."],
  ["planter_box", "Bồn Hoa Gỗ", "🌼", [1, 1], 1, 1, { plank_forest: 1, herb: 2 }, "Bồn gỗ trồng hoa, đặt dọc đường rất đẹp."],
  ["wisteria_arch", "Giàn Tử Đằng", "💜", [2, 1], 2, 4, { plank_forest: 3, herb: 3 }, "Hoa tử đằng tím buông thành mành. Đi xuyên qua được.", true],
  ["market_stall", "Sạp Hoa Quả", "🍎", [2, 1], 2, 3, { plank_forest: 3, cloth_forest: 2 }, "Sạp mái vải sọc, bày táo, cam và dưa."],
  ["round_planter", "Bồn Hoa Tròn", "💐", [2, 2], 2, 5, { stone: 8, mortar: 2, herb: 4 }, "Bồn hoa xây đá giữa quảng trường, hoa nở bốn mùa."],
  ["bell_tower", "Tháp Chuông", "🔔", [2, 2], 4, 7, { brick: 8, mortar: 4, plank_forest: 4, copper_ingot: 2 }, "Tháp gạch với quả chuông đồng, ngân vang mỗi sáng."],
  ["zen_garden", "Vườn Đá Thiền", "🎑", [2, 2], 3, 5, { sand: 6, stone: 4 }, "Cát cào thành sóng quanh vài tảng đá. Yên tĩnh lạ thường."],
];
type Floor = [id: string, name: string, icon: string, rank: number, family: string, first: Cost, desc: string, walkable?: false];
/**
 * Ground cover, one tile each, laid in rows or whole areas: pieces of a family join seamlessly
 * and draw an edge only where the family ends. The water family makes ponds, lakes and canals
 * with banks that follow their outline (people walk round, or over the stepping stones and
 * boardwalk).
 */
const FLOORS: Floor[] = [
  ["dirt_road", "Đường Đất Nện", "🟫", 1, "dirt_road", { stone: 1 }, "Đường đất nện chặt, có vệt bánh xe."],
  ["gravel", "Lối Sỏi", "🪨", 1, "gravel", { stone: 2 }, "Sỏi nhỏ lạo xạo dưới chân."],
  ["cobble", "Đường Đá Cuội", "⚪", 1, "cobble", { stone: 3 }, "Đá cuội tròn lát kín, kiểu phố cổ."],
  ["sand_path", "Đường Cát", "🏖️", 1, "sand_path", { sand: 3 }, "Cát trắng mịn, hợp với bờ ao."],
  ["lawn", "Thảm Cỏ Xanh", "🟩", 1, "lawn", { herb: 1 }, "Cỏ xén gọn gàng, xanh mướt."],
  ["clover", "Thảm Cỏ Hoa", "🍀", 1, "clover", { herb: 2 }, "Cỏ ba lá lấm tấm hoa trắng và vàng."],
  ["plank_deck", "Sàn Ván Gỗ", "🪵", 1, "plank_deck", { plank_forest: 2 }, "Sàn ván gỗ ấm áp cho hiên và quán."],
  ["flagstone", "Sàn Đá Phiến", "⬜", 2, "flagstone", { block_forest: 1, stone: 1 }, "Những phiến đá lớn ghép không đều."],
  ["moss_stone", "Đá Rêu Cổ", "🌿", 2, "moss_stone", { stone: 2, herb: 1 }, "Đá lát cũ, rêu xanh mọc trong kẽ."],
  ["brick_road", "Đường Gạch Đỏ", "🧱", 2, "brick_road", { brick: 2, mortar: 1 }, "Gạch nung xếp so le, đường phố đúng nghĩa."],
  ["herringbone", "Gạch Xương Cá", "🔶", 3, "herringbone", { brick: 3, mortar: 1 }, "Gạch xếp kiểu xương cá cho quảng trường."],
  ["checker", "Sàn Đá Hoa Cờ", "🏁", 3, "checker", { stone: 3, mortar: 2 }, "Đá trắng đen xen kẽ như bàn cờ."],
  ["red_carpet", "Thảm Đỏ", "🟥", 3, "red_carpet", { cloth_forest: 2, dye: 1 }, "Thảm đỏ viền vàng, đón khách quý."],
  ["mosaic", "Sàn Khảm Hoa Văn", "🔷", 4, "mosaic", { stone: 2, mortar: 1, glass: 1 }, "Đá khảm xanh lam và vàng thành hoa văn."],
  ["starlight", "Gạch Ánh Sao", "✨", 5, "starlight", { glass: 2, mortar: 1, dye: 1 }, "Gạch thủy tinh tối lấp lánh như trời sao."],
  // water: one family, so lotus, koi and reeds join into the same pond
  ["pond_water", "Nước Ao", "💧", 1, "water", { clay: 2 }, "Ô nước trong. Ghép nhiều ô thành ao hồ; bờ tự uốn theo hình.", false],
  ["lotus_water", "Nước Có Sen", "🪷", 1, "water", { clay: 2, herb: 2 }, "Lá sen và hoa sen hồng trên mặt nước.", false],
  ["reed_water", "Nước Có Lau Sậy", "🌾", 1, "water", { clay: 2, fiber_forest: 1 }, "Lau sậy mọc ven nước.", false],
  ["koi_water", "Nước Có Cá Koi", "🐟", 2, "water", { clay: 2, glass: 1 }, "Cá chép đỏ trắng lững lờ bơi.", false],
  ["deep_water", "Nước Sâu", "🌊", 2, "water", { clay: 3 }, "Nước sâu xanh thẫm cho giữa hồ.", false],
  ["stepping_stones", "Đá Bước Qua Suối", "🪨", 1, "water", { clay: 2, stone: 2 }, "Những tảng đá phẳng giữa dòng: đi qua được."],
  ["boardwalk", "Cầu Ván Trên Nước", "🌉", 2, "water", { clay: 2, plank_forest: 2 }, "Lối ván gỗ bắc trên mặt nước: đi qua được."],
];

const list: BuildingDef[] = [
  // ------------------------------------------------------------ core
  B({ id: "house", name: "Nhà Chính", icon: "🏛️", size: [3, 3], maxLevel: 6, unique: true, fixed: true, rank: 1, category: "core", housing: 2, appeal: 2, style: { wall: "#d8c8a0", roof: "#9a3a2a" },
    desc: "Trái tim của Thánh Địa. Nâng cấp để thăng hạng khu định cư: Trại → Xóm → Làng → Thị Trấn → Thành Phố → Kinh Đô." }),
  B({ id: "gate", name: "Cổng Vực Sâu", icon: "🌀", size: [2, 2], maxLevel: 1, unique: true, fixed: true, rank: 1, category: "core",
    desc: "Cánh cổng đá dẫn xuống Vực Sâu Bách Tầng. Dịch chuyển tới đầu mọi tầng đã mở khoá." }),
  // ------------------------------------------------------------ farming
  B({ id: "farm", name: "Ô Ruộng", icon: "🟫", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "farm", first: { wood: 2 },
    desc: "Gieo hạt rồi chờ cây lớn theo thời gian thật (từ 15 giây). Tưới nước giữ ẩm 3 phút để cây lớn nhanh và được mùa; bón phân cho đất màu mỡ." }),
  B({ id: "well", name: "Giếng Nước", icon: "🪣", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "farm", appeal: 1, first: { stone: 10, wood: 4 },
    desc: "Mở khoá nút 'Tưới tất cả' cho mọi ô ruộng." }),
  B({ id: "sprinkler", name: "Vòi Tưới Tự Động", icon: "💦", size: [1, 1], maxLevel: 3, unique: false, rank: 3, category: "farm",
    desc: "Giữ ẩm liên tục cho các ô ruộng xung quanh — không cần tưới tay (bán kính 1/2/3 theo cấp)." }),
  B({ id: "compost", name: "Hố Ủ Phân", icon: "🟤", size: [1, 1], maxLevel: 3, unique: true, rank: 1, category: "farm", station: "compost", first: { wood: 6, stone: 4 },
    desc: "Ủ phân bón từ phụ phẩm nông nghiệp, xương và bào tử." }),
  B({ id: "greenhouse", name: "Nhà Kính", icon: "🏡", size: [3, 3], maxLevel: 3, unique: false, rank: 3, category: "farm", style: { wall: "#b8e8f0", roof: "#6ab0c0" },
    desc: "4/6/8 ô trồng bên trong, luôn đúng mùa và được tưới tự động." }),
  B({ id: "coop", name: "Chuồng Gà Vịt", icon: "🐔", size: [2, 2], maxLevel: 3, unique: false, rank: 1, category: "farm", workers: 1, style: { wall: "#c8a070", roof: "#a0602a", emblem: "egg" }, first: { wood: 12, fiber_forest: 4 },
    desc: "Cho trứng mỗi ngày. Cần hạt ngũ cốc (lúa, ngô, lúa nước) làm thức ăn. Cấp 2 có thêm vịt." }),
  B({ id: "barn", name: "Chuồng Gia Súc", icon: "🐄", size: [3, 2], maxLevel: 3, unique: false, rank: 2, category: "farm", workers: 2, style: { wall: "#b04a3a", roof: "#6a2a1a", emblem: "bottle" },
    desc: "Bò cho sữa; cấp 2 có dê (sữa dê); cấp 3 có cừu (lông cừu). Cần rau củ làm thức ăn." }),
  B({ id: "beehive", name: "Tổ Ong", icon: "🐝", size: [1, 1], maxLevel: 3, unique: false, rank: 2, category: "farm",
    desc: "Cho mật ong mỗi ngày, nhiều hơn khi có hoa trồng gần đó. Thỉnh thoảng có Sữa Ong Chúa." }),
  B({ id: "fishpond", name: "Ao Cá", icon: "🐟", size: [2, 2], maxLevel: 3, unique: false, rank: 2, category: "farm", workers: 1,
    desc: "Mỗi ngày câu được cá theo mùa. Ngày giông bão có thể bắt được Lươn Sấm." }),
  B({ id: "silkhouse", name: "Nhà Nuôi Tằm", icon: "🐛", size: [2, 2], maxLevel: 2, unique: false, rank: 4, category: "farm", workers: 2, style: { wall: "#f0e0c0", roof: "#c89a5a", emblem: "wool" },
    desc: "Cho kén tằm mỗi ngày. Cần lá cây (cải, trà) làm thức ăn." }),
  // ------------------------------------------------------------ production (daily)
  B({ id: "lumber", name: "Trại Đốn Gỗ", icon: "🪓", size: [2, 2], maxLevel: 4, unique: false, rank: 1, category: "production", workers: 2, style: { wall: "#8a5a2a", roof: "#5a3a1e", emblem: "log" }, first: { wood: 10, stone: 5 },
    desc: "Công nhân đốn gỗ mỗi ngày. Cấp cao đốn được gỗ quý." }),
  B({ id: "quarry", name: "Mỏ Đá", icon: "⛏️", size: [2, 2], maxLevel: 4, unique: false, rank: 1, category: "production", workers: 2, style: { wall: "#8a8f96", roof: "#4a4e56", emblem: "stone" }, first: { wood: 12, stone: 4 },
    desc: "Khai thác đá, cát và đất sét mỗi ngày." }),
  B({ id: "mine", name: "Hầm Mỏ", icon: "⚒️", size: [2, 2], maxLevel: 5, unique: false, rank: 2, category: "production", workers: 3, style: { wall: "#5a4a3a", roof: "#3a2a1a", emblem: "ore" },
    desc: "Khai thác quặng kim loại mỗi ngày. Cấp càng cao càng đào sâu tới kim loại quý." }),
  B({ id: "herbgarden", name: "Vườn Thảo Dược", icon: "🌿", size: [2, 2], maxLevel: 3, unique: false, rank: 2, category: "production", workers: 1,
    desc: "Thu hái thảo dược các vùng mỗi ngày." }),
  B({ id: "market", name: "Chợ", icon: "🏪", size: [3, 2], maxLevel: 4, unique: true, rank: 2, category: "production", workers: 2, appeal: 3, style: { wall: "#e8c070", roof: "#c83a3a", emblem: "coin" },
    desc: "Thu thuế buôn bán: mỗi ngày nhận vàng theo số dân." }),
  // ------------------------------------------------------------ crafting stations
  B({ id: "kitchen", name: "Bếp Lửa", icon: "🍳", size: [2, 2], maxLevel: 4, unique: true, rank: 1, category: "craft", station: "kitchen", style: { wall: "#c8a878", roof: "#7a5a3a", emblem: "bowl" }, first: { wood: 8, stone: 6 },
    desc: "Nấu nông sản thành món ăn hồi phục và buff bữa ăn." }),
  B({ id: "forge", name: "Lò Rèn", icon: "⚒️", size: [2, 2], maxLevel: 6, unique: true, rank: 1, category: "craft", station: "forge", style: { wall: "#7a7a82", roof: "#4a4a52", emblem: "ingot" }, first: { stone: 10, wood: 5 },
    desc: "Luyện quặng thành thỏi và rèn vũ khí, giáp, trang sức. Cấp càng cao rèn được kim loại càng quý." }),
  B({ id: "sawmill", name: "Xưởng Cưa", icon: "🪚", size: [2, 2], maxLevel: 5, unique: true, rank: 1, category: "craft", station: "sawmill", style: { wall: "#a07040", roof: "#6a4a2a", emblem: "plank" }, first: { wood: 10, stone: 4 },
    desc: "Xẻ gỗ thành ván, đốt than, làm giấy và nhựa cây." }),
  B({ id: "workshop", name: "Xưởng Đá & Thủy Tinh", icon: "🧱", size: [2, 2], maxLevel: 5, unique: true, rank: 1, category: "craft", station: "workshop", style: { wall: "#9a9ea4", roof: "#5a5e66", emblem: "block" }, first: { stone: 14, wood: 4 },
    desc: "Đẽo khối đá, nung gạch, nấu thủy tinh, đúc đinh và bánh răng." }),
  B({ id: "tailor", name: "Xưởng May & Thuộc Da", icon: "🧵", size: [2, 2], maxLevel: 6, unique: true, rank: 1, category: "craft", station: "tailor", style: { wall: "#c8a0c0", roof: "#7a4a6a", emblem: "cloth" }, first: { wood: 8, hide: 3 },
    desc: "Dệt vải, thuộc da, bện dây và may giáp vải/da, ma thư." }),
  B({ id: "alchemy", name: "Phòng Giả Kim", icon: "⚗️", size: [2, 2], maxLevel: 4, unique: true, rank: 1, category: "craft", station: "alchemy", style: { wall: "#7a8a6a", roof: "#3a6a4a", emblem: "potion" }, first: { wood: 10, herb: 5, slime_gel: 5 },
    desc: "Chưng cất tinh dầu, bào chế thuốc, thuốc tăng lực, dầu tẩm vũ khí và bom nguyên tố." }),
  B({ id: "library", name: "Thư Viện Phép", icon: "📚", size: [2, 2], maxLevel: 5, unique: true, rank: 1, category: "craft", station: "library", style: { wall: "#b8b0d0", roof: "#3a4a9a", emblem: "book" }, first: { wood: 12, mushroom_cap: 4, mana_crystal: 2 },
    desc: "Nghiên cứu kỹ năng và nội tại; viết cuộn phép dịch chuyển." }),
  // ------------------------------------------------------------ housing
  B({ id: "tent", name: "Lều Trại", icon: "⛺", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "housing", housing: 2, first: { wood: 3, hide: 2 },
    desc: "Chỗ ngủ tạm cho 2 người." }),
  B({ id: "cottage", name: "Nhà Gỗ", icon: "🏠", size: [2, 2], maxLevel: 2, unique: false, rank: 1, category: "housing", housing: 4, appeal: 1, style: { wall: "#c89a5a", roof: "#8a3a2a" }, first: { wood: 16, stone: 6 },
    desc: "Nhà gỗ ấm cúng cho 4 người (8 khi nâng cấp)." }),
  B({ id: "stonehouse", name: "Nhà Đá", icon: "🏘️", size: [2, 2], maxLevel: 2, unique: false, rank: 3, category: "housing", housing: 6, appeal: 2, style: { wall: "#b0b0a8", roof: "#4a5a8a" },
    desc: "Nhà đá kiên cố cho 6 người (12 khi nâng cấp)." }),
  B({ id: "manor", name: "Dinh Thự", icon: "🏰", size: [3, 3], maxLevel: 2, unique: false, rank: 4, category: "housing", housing: 12, appeal: 5, style: { wall: "#e8e0d0", roof: "#6a2a5a" },
    desc: "Dinh thự rộng rãi cho 12 người." }),
  B({ id: "apartment", name: "Chung Cư", icon: "🏢", size: [3, 3], maxLevel: 3, unique: false, rank: 5, category: "housing", housing: 20, appeal: 2, style: { wall: "#c8c0b0", roof: "#3a3a4a" },
    desc: "Toà nhà nhiều tầng cho 20 người mỗi cấp." }),
  B({ id: "palace", name: "Cung Điện", icon: "👑", size: [4, 4], maxLevel: 1, unique: true, rank: 6, category: "housing", housing: 40, appeal: 30, style: { wall: "#f0e8d0", roof: "#d8a020", emblem: "coin" },
    desc: "Biểu tượng của Kinh Đô. Nhà của 40 người và niềm tự hào của cả Vực Sâu." }),
  // ------------------------------------------------------------ services
  B({ id: "training", name: "Sân Tập", icon: "🎯", size: [2, 2], maxLevel: 3, unique: true, rank: 1, category: "service",
    desc: "Dùng vàng để huấn luyện đồng đội, giúp người ở nhà bắt kịp cấp độ." }),
  B({ id: "tavern", name: "Quán Rượu", icon: "🍺", size: [3, 2], maxLevel: 3, unique: true, rank: 2, category: "service", workers: 1, appeal: 4, style: { wall: "#a0703a", roof: "#5a2a1a", emblem: "cup" },
    desc: "Lính đánh thuê và nhà thám hiểm ghé qua mỗi ngày — có thể chiêu mộ họ. Cấp cao có người mạnh hơn." }),
  B({ id: "academy", name: "Học Viện", icon: "🎓", size: [3, 3], maxLevel: 3, unique: true, rank: 4, category: "service", workers: 2, appeal: 4, style: { wall: "#d8d0e8", roof: "#4a3a8a", emblem: "book" },
    desc: "Mỗi ngày, đồng đội không đi cùng nhận kinh nghiệm." }),
  B({ id: "temple", name: "Đền Thờ Mầm", icon: "⛩️", size: [3, 3], maxLevel: 3, unique: true, rank: 3, category: "service", appeal: 6, style: { wall: "#f0f0e8", roof: "#2a8a5a", emblem: "herb" },
    desc: "Khi xuống Vực Sâu, cả đội nhận Phúc Lành (+3% mọi chỉ số mỗi cấp) tới khi về nhà." }),
  B({ id: "clinic", name: "Y Quán", icon: "🏥", size: [2, 2], maxLevel: 3, unique: true, rank: 3, category: "service", workers: 1, appeal: 2, style: { wall: "#f4f4f4", roof: "#c83a3a", emblem: "potion" },
    desc: "Mỗi ngày bào chế Thuốc Hồi Máu cho kho (nhiều hơn theo cấp)." }),
  B({ id: "warehouse", name: "Nhà Kho", icon: "📦", size: [3, 2], maxLevel: 3, unique: true, rank: 3, category: "service", workers: 1, style: { wall: "#9a7a4a", roof: "#5a4a2a", emblem: "plank" },
    desc: "Quản lý kho tốt giúp các công trình sản xuất làm thêm 10%/20%/30% sản lượng." }),
  B({ id: "watchtower", name: "Tháp Canh", icon: "🗼", size: [1, 1], maxLevel: 2, unique: false, rank: 3, category: "service", appeal: 1,
    desc: "Lính gác trông chừng bóng tối. Tăng sức hút khu định cư." }),
  // built by the dozen: only things the sanctuary makes itself (quarry stone; workshop bricks and mortar)
  B({ id: "wall", name: "Tường Thành", icon: "🧱", size: [1, 1], maxLevel: 1, unique: false, rank: 4, category: "decor", appeal: 1, first: { stone: 6, brick: 3, mortar: 2 },
    desc: "Đoạn tường đá. Xếp thành vòng thành bao quanh Thánh Địa." }),
  // ------------------------------------------------------------ decor
  B({ id: "lamp", name: "Đèn Đá", icon: "🏮", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "decor", appeal: 1, first: { stone: 3 }, desc: "Ánh sáng ấm áp giữa lòng Vực Sâu." }),
  B({ id: "flowers", name: "Luống Hoa", icon: "🌷", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "decor", appeal: 1, first: { herb: 2 }, desc: "Một chút màu sắc. Ong rất thích." }),
  B({ id: "tree", name: "Cây Bóng Mát", icon: "🌳", size: [1, 1], maxLevel: 1, unique: false, rank: 1, category: "decor", appeal: 1, first: { wood: 4, herb: 2 }, desc: "Cây xanh toả bóng. Thỉnh thoảng rụng quả xương rồng." }),
  B({ id: "fountain", name: "Đài Phun Nước", icon: "⛲", size: [2, 2], maxLevel: 1, unique: false, rank: 3, category: "decor", appeal: 6, desc: "Trung tâm quảng trường." }),
  B({ id: "statue", name: "Tượng Anh Hùng", icon: "🗿", size: [1, 1], maxLevel: 1, unique: false, rank: 4, category: "decor", appeal: 4, desc: "Tượng tưởng niệm những người chuyển sinh đã ngã xuống." }),
  B({ id: "park", name: "Công Viên", icon: "🌲", size: [3, 3], maxLevel: 1, unique: false, rank: 4, category: "decor", appeal: 10, desc: "Vườn cây, ghế đá và lối đi lát sỏi." }),
  B({ id: "arch", name: "Cổng Hoa", icon: "🌸", size: [2, 1], maxLevel: 1, unique: false, rank: 2, category: "decor", appeal: 3, desc: "Cổng vòm phủ hoa leo." }),
  // ------------------------------------------------------------ more buildings
  B({ id: "bakery", name: "Lò Bánh", icon: "🥖", size: [2, 2], maxLevel: 3, unique: false, rank: 2, category: "production", workers: 1, appeal: 1, style: { wall: "#e8c890", roof: "#b86a3a", emblem: "bread" },
    desc: "Mỗi ngày nướng bánh mì từ lúa trong kho (2/4/6 lúa → bánh mì)." }),
  B({ id: "winery", name: "Hầm Rượu Vang", icon: "🍷", size: [2, 2], maxLevel: 3, unique: false, rank: 3, category: "production", workers: 1, style: { wall: "#8a5a4a", roof: "#5a2a3a", emblem: "bottle" },
    desc: "Ủ Nho Đêm thành Rượu Nho Đêm mỗi ngày." }),
  B({ id: "dairy", name: "Xưởng Bơ Sữa", icon: "🧀", size: [2, 2], maxLevel: 3, unique: false, rank: 3, category: "production", workers: 1, style: { wall: "#f0e8d0", roof: "#6a8ab0", emblem: "cheese" },
    desc: "Biến sữa bò thành bơ và sữa dê thành phô mai mỗi ngày." }),
  B({ id: "orchard", name: "Vườn Cây Ăn Trái", icon: "🍎", size: [3, 2], maxLevel: 3, unique: false, rank: 2, category: "farm", workers: 1, appeal: 2,
    desc: "Hàng cây ăn trái cho táo, cam, lê theo mùa mỗi ngày." }),
  B({ id: "windmill", name: "Cối Xay Gió", icon: "🌾", size: [2, 2], maxLevel: 3, unique: false, rank: 2, category: "production", workers: 1, appeal: 3,
    desc: "Cánh quạt quay đều mang lại may mắn: tăng 5% sản lượng mọi công trình sản xuất mỗi cấp (tối đa 3 cối)." }),
  B({ id: "fisherhut", name: "Chòi Câu Cá", icon: "🎣", size: [2, 1], maxLevel: 3, unique: false, rank: 1, category: "farm", workers: 1, first: { wood: 10, fiber_forest: 4 },
    desc: "Ngư dân câu vài con cá mỗi ngày, không cần ao." }),
  // --- raw materials that crafting and building eat the most
  B({ id: "pasture", name: "Đồng Cỏ Chăn Thả", icon: "🐑", size: [3, 2], maxLevel: 3, unique: false, rank: 1, category: "farm", workers: 1, appeal: 1, first: { wood: 10, fiber_forest: 4 },
    desc: "Cừu và dê gặm cỏ, không cần cho ăn. Mỗi ngày cho Da Thú và Lông Cừu; từ cấp 2 thêm da thú của các vùng đã khám phá." }),
  B({ id: "hunter", name: "Chòi Thợ Săn", icon: "🏹", size: [2, 2], maxLevel: 4, unique: false, rank: 1, category: "production", workers: 2, style: { wall: "#8a6a4a", roof: "#4a5a3a", emblem: "log" }, first: { wood: 10, stone: 4 },
    desc: "Thợ săn vào rừng mỗi ngày: Da Thú, Thịt Thú Rừng, đôi khi Xương và Lông Vũ. Từ cấp 2 săn cả thú của các vùng đã khám phá." }),
  B({ id: "vinegarden", name: "Giàn Dây Leo", icon: "🌿", size: [2, 2], maxLevel: 4, unique: false, rank: 1, category: "farm", workers: 1, appeal: 1, first: { wood: 8, herb: 2 },
    desc: "Giàn leo cho rất nhiều Sợi Dây Leo (dệt vải, bện thừng, làm giấy). Từ cấp 2 trồng thêm sợi của các vùng đã khám phá." }),
  B({ id: "pigsty", name: "Chuồng Heo Rừng", icon: "🐗", size: [2, 2], maxLevel: 3, unique: false, rank: 2, category: "farm", workers: 1,
    desc: "Heo rừng cho nhiều Da Thú và Thịt nhất. Ăn rau củ trong kho; thiếu thức ăn thì sản lượng giảm một nửa." }),
  B({ id: "kiln", name: "Lò Than", icon: "🔥", size: [2, 2], maxLevel: 3, unique: false, rank: 2, category: "production", workers: 1, style: { wall: "#8a6a5a", roof: "#3a3438", emblem: "stone" },
    desc: "Đốt Gỗ trong kho thành Than Củi (2 gỗ → 2 than mỗi cấp) để nung gạch và thủy tinh." }),
  B({ id: "mana_spring", name: "Suối Ma Lực", icon: "💠", size: [2, 2], maxLevel: 3, unique: false, rank: 3, category: "production", workers: 1, appeal: 3,
    desc: "Mạch ma lực trồi lên mặt đất, kết tinh thành Tinh Thể Ma Lực mỗi ngày (thứ dùng trong rất nhiều công thức)." }),
  B({ id: "observatory", name: "Đài Thiên Văn", icon: "🔭", size: [2, 2], maxLevel: 3, unique: true, rank: 4, category: "service", workers: 1, appeal: 4,
    desc: "Quan sát những đốm sáng trên trần Vực Sâu: mỗi ngày có cơ hội thu Tinh Thể Ma Lực. Nơi hẹn hò ngắm sao lý tưởng." }),
  B({ id: "bathhouse", name: "Nhà Tắm Suối Nóng", icon: "♨️", size: [3, 2], maxLevel: 2, unique: true, rank: 3, category: "service", workers: 1, appeal: 6, style: { wall: "#c8a878", roof: "#3a5a7a", emblem: "herb" },
    desc: "Cả đội hồi đầy khi ngủ dậy như thường, và cư dân vui vẻ hơn. Nơi hẹn hò ngâm chân thư giãn." }),
  B({ id: "inn", name: "Nhà Trọ", icon: "🛏️", size: [3, 2], maxLevel: 3, unique: false, rank: 3, category: "housing", housing: 6, appeal: 2, style: { wall: "#c89a5a", roof: "#3a6a4a", emblem: "cup" },
    desc: "Chỗ ở cho 6 người mỗi cấp, khách lữ hành cũng hay ghé." }),
  B({ id: "guild", name: "Hội Mạo Hiểm", icon: "🗡️", size: [3, 3], maxLevel: 3, unique: true, rank: 4, category: "service", workers: 2, appeal: 4, style: { wall: "#b0a080", roof: "#7a2a2a", emblem: "sword" },
    desc: "Nhà mạo hiểm giả nhận việc vặt: mỗi ngày mang về nguyên liệu từ các vùng đã khám phá." }),
  B({ id: "treehouse", name: "Nhà Trên Cây", icon: "🌳", size: [2, 2], maxLevel: 1, unique: false, rank: 2, category: "housing", housing: 3, appeal: 3,
    desc: "Căn nhà nhỏ trên cành cây cổ thụ cho 3 người." }),
  B({ id: "bamboohouse", name: "Nhà Trúc", icon: "🎋", size: [2, 2], maxLevel: 2, unique: false, rank: 2, category: "housing", housing: 4, appeal: 2, style: { wall: "#c8c080", roof: "#6a8a3a" },
    desc: "Nhà sàn bằng trúc mát mẻ cho 4 người." }),
  // ------------------------------------------------------------ more decor
  ...DECOR.map(([id, name, icon, size, rank, appeal, first, desc, walkable]) => B({ id, name, icon, size, maxLevel: 1, unique: false, rank, category: "decor", appeal, first, desc, walkable })),
  // ------------------------------------------------------------ ground cover
  ...FLOORS.map(([id, name, icon, rank, family, first, desc, walkable]) => B({ id, name, icon, size: [1, 1], maxLevel: 1, unique: false, rank, category: "floor", first, desc, floor: family, walkable: walkable ?? true })),
];

export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(list.map((b) => [b.id, b]));
export const BUILDING_LIST = list;

// ------------------------------------------------------------ generated costs
const POOLS: string[][] = [
  [],
  ["wood", "stone", "fiber_forest", "hide", "herb"],
  ["plank_forest", "block_forest", "copper_ingot", "rope", "cloth_forest", "brick"],
  ["plank_desert", "block_desert", "iron_ingot", "glass", "leather_forest", "nails", "mortar"],
  ["plank_swamp", "block_swamp", "steel_ingot", "gears", "amber", "cloth_desert", "leather_desert"],
  ["plank_tundra", "block_tundra", "silver_ingot", "frost_gem", "obsidian", "block_volcano", "leather_tundra"],
  ["mithril_ingot", "darkiron_ingot", "jade", "aquamarine", "block_reef", "plank_bamboo", "amethyst"],
];

/** Most materials a single build or upgrade asks for, of any one kind. */
export const MAX_MATERIAL = 10;
/**
 * Squeezes a raw material amount into a friendly one: everyday builds ask for about 5–6 of
 * each, the biggest upgrades for 10 at most. Gold is left as it is; small amounts never grow.
 */
export const tameAmount = (n: number) => Math.min(n, MAX_MATERIAL, Math.max(1, Math.round(2 + 2 * Math.log(1 + n / 4))));
export function tameCost(c: Cost): Cost {
  const out: Cost = {};
  for (const [k, v] of Object.entries(c)) out[k] = k === "gold" ? v : tameAmount(v);
  return out;
}

/** Cost to build (level 0) or upgrade to level+1. */
export function costFor(type: string, level: number): Cost {
  return tameCost(rawCostFor(type, level));
}

function rawCostFor(type: string, level: number): Cost {
  const def = BUILDINGS[type];
  if (level === 0 && def.first) return def.first;
  const rank = Math.min(6, def.rank + level);
  const area = def.size[0] * def.size[1];
  const scale = Math.pow(area, 0.7) * (1 + level * 0.6);
  const h = hashString(`${type}:${level}`);
  const pool = POOLS[rank];
  const out: Cost = {};
  const picks = rank === 1 ? 2 : 3;
  for (let i = 0; i < picks; i++) {
    const id = pool[(h + i * 7) % pool.length];
    out[id] = (out[id] ?? 0) + Math.max(2, Math.round((i === 0 ? 8 : 5) * scale));
  }
  if (rank >= 2 && pool !== POOLS[rank - 1]) {
    const prev = POOLS[rank - 1][(h >>> 3) % POOLS[rank - 1].length];
    out[prev] = (out[prev] ?? 0) + Math.round(6 * scale);
  }
  const gold = Math.round(25 * rank * rank * Math.pow(area, 0.6) * (1 + level * 0.5));
  if (rank >= 2) out.gold = gold;
  return out;
}

export function expansionCost(level: number): Cost {
  const rank = Math.min(6, 1 + Math.floor(level * 0.62));
  const pool = POOLS[rank];
  const s = 1 + level * 0.8;
  return tameCost({ [pool[0]]: Math.round(12 * s), [pool[1]]: Math.round(10 * s), [pool[pool.length - 1]]: Math.round(6 * s), gold: Math.round(80 * rank * rank * s) });
}

export function houseRequirement(nextLevel: number) {
  return { pop: POP_REQ[nextLevel] ?? 999, floor: FLOOR_REQ[nextLevel] ?? 999 };
}

export const passiveSlotsFor = (houseLevel: number) => (houseLevel >= 4 ? 3 : 2);
export const skillSlotsFor = (houseLevel: number) => (houseLevel >= 5 ? 6 : 5);
export const PARTY_SIZE = 4; // hero + 3 companions
