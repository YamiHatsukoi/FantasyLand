# FantasyLand — Vực Sâu Bách Tầng

RPG pixel-art chạy trên trình duyệt (máy tính và điện thoại). Bạn là một linh hồn bị chuyển sinh vào **Vực Sâu Bách Tầng** —
một đại mê cung 100 tầng, mỗi tầng là một vùng đất rộng lớn với hệ sinh thái, quái vật và câu chuyện riêng.

Game có 3 lối chơi chính:

| | Lối chơi | Bạn làm gì |
|---|---|---|
| 🏡 | **Thánh Địa** (safe zone) | Trồng trọt, xây và nâng cấp công trình, mở rộng lãnh địa, chế tạo đồ ăn/thuốc/bom/trang bị, nghiên cứu kỹ năng |
| 🗺️ | **Khám phá Vực Sâu** | Đi trên bản đồ pixel có sương mù, thu thập tài nguyên, mở rương, gặp sự kiện kiểu **gamebook** (đối thoại + lựa chọn + tung xúc xắc kiểm tra chỉ số) |
| ⚔️ | **Chiến đấu theo lượt** | Đội tối đa 4 người, 187 kỹ năng (147 người chơi học được), 52 hiệu ứng trạng thái, ~20 phản ứng nguyên tố, 55 nội tại |

## Nội dung hiện có

- **Đăng nhập** bằng tên + mật khẩu (tài khoản do admin tạo trong Supabase), ghi nhớ đăng nhập 30 ngày, tự lưu game lên Supabase.
- **Cốt truyện Chương 1 (tầng 1–3)** viết tay: Rừng Nguyên Sinh Thì Thầm, Biển Cát Hổ Phách, Đầm Lầy Đèn Ma — 21 sự kiện, 4 đồng đội (Lyra, Bram, Samira, Morwen), 3 trùm, các lựa chọn ảnh hưởng tới trận đánh trùm.
- **Tầng 4–100 có khung sẵn**: bản đồ, 15 biome xoay vòng, quái được biến thể theo nguyên tố, trùm, 10 loại sự kiện ngẫu nhiên. Cốt truyện riêng sẽ được viết thêm dần.
- 7 lớp nhân vật (Kiếm Sĩ, Pháp Sư, Du Hiệp, Sát Thủ, Tư Tế, Hộ Vệ, Phù Thủy), 8 loại cây trồng, 12 loại công trình, 50 công thức chế tạo, 34 trang bị.

### Một vài tương tác trong chiến đấu

- **Ướt + Sét → Điện Giật** (x1.5, choáng, lan sang kẻ địch ướt khác) · **Ướt + Băng → Đóng Băng Tức Thì** · **Ướt + Lửa → Bốc Hơi** (giảm sát thương nhưng gây mù)
- **Dầu + Lửa → Nổ Dầu** (x2, bắn lan) · **Đóng băng + đòn vật lý → Vỡ Băng** (x2) · **Thiêu đốt + Băng → Sốc Nhiệt** (phá giáp)
- **Thiêu đốt/Độc + Gió → lây lan** cho cả nhóm địch · **Nhiễm điện + Đất → Tiếp Địa** · **Ướt + Đất → Bùn Lầy** (trói, chậm)
- Tầng hiệu ứng: 3 tầng Tê cóng → Đóng băng; 3 tầng Nhiễm điện → Tê liệt; kỹ năng **Kích nổ** tiêu thụ tầng hiệu ứng để gây sát thương lớn
- Tẩm nguyên tố cho vũ khí (vd. Lôi Ấn) để đòn vật lý kích hoạt phản ứng; bom/bình ném (Bình Nước Thánh, Bình Dầu...) để tự tạo phản ứng

## Kiến trúc

```
Trình duyệt (GitHub Pages)                         Supabase (gói Free)
┌───────────────────────────────┐   HTTPS/RPC   ┌──────────────────────────────┐
│ Vite + TypeScript, Canvas 2D  │ ────────────▶ │ game_login / game_load /     │
│ Không cần server riêng        │               │ game_save / game_logout      │
│ Cache: token phiên + bản lưu  │ ◀──────────── │ (security definer, bcrypt)   │
└───────────────────────────────┘               │ Bảng players/sessions/saves  │
                                                │ RLS bật, trình duyệt không   │
                                                │ đọc trực tiếp được bảng nào  │
                                                └──────────────────────────────┘
```

- **Bảo mật đăng nhập:** mật khẩu được trigger băm bằng bcrypt ngay khi bạn nhập vào bảng. Việc so khớp mật khẩu chạy trong hàm SQL trên server.
  Máy người chơi chỉ lưu *token phiên* (tự gia hạn 30 ngày), không lưu mật khẩu. Sai 5 lần thì khoá 5 phút.
- **Lưu game:** mỗi thay đổi được ghi ngay vào `localStorage`, rồi đồng bộ lên Supabase sau vài giây (và khi đóng tab). Có đánh số phiên bản
  để phát hiện khi cùng tài khoản chơi trên 2 thiết bị — game sẽ hỏi giữ bản nào. Mất mạng vẫn chơi tiếp được bằng bản lưu trên máy.
- **Chế độ offline:** nếu chưa cấu hình Supabase, game vẫn chạy được, nhập tên bất kỳ để đăng nhập, dữ liệu lưu trong trình duyệt.

## Cài đặt

### 1. Supabase

1. Tạo project miễn phí tại <https://supabase.com>.
2. Mở **SQL Editor**, dán toàn bộ nội dung [`supabase/schema.sql`](supabase/schema.sql) rồi bấm **Run**. File chạy lại nhiều lần cũng không sao.
3. **Tạo tài khoản người chơi:** vào **Table Editor → players → Insert row**, điền `username` (3–32 ký tự) và `password` (gõ mật khẩu thường, sẽ tự được băm). Hoặc dùng SQL:
   ```sql
   insert into public.players (username, password) values ('tenban', 'matkhau123');
   -- đổi mật khẩu:
   update public.players set password = 'matkhaumoi' where username = 'tenban';
   ```
4. Vào **Project Settings → API** (hoặc **API Keys**), lấy **Project URL** và **anon key** (hoặc **publishable key**).
   Đây là key công khai, dùng được ở trình duyệt vì mọi quyền đều bị chặn bởi RLS. **Không** dùng `service_role`/secret key.

### 2. GitHub Pages

1. Vào **Settings → Secrets and variables → Actions → tab Variables**, tạo 2 biến:
   - `SUPABASE_URL` = Project URL (vd. `https://abcd1234.supabase.co`)
   - `SUPABASE_ANON_KEY` = anon/publishable key
2. **Settings → Pages → Build and deployment → Source:** chọn **GitHub Actions**.
3. Merge vào nhánh `main`. Workflow [`pages.yml`](.github/workflows/pages.yml) sẽ chạy test, build và deploy.
   Game có tại `https://<username>.github.io/FantasyLand/`.

> Lưu ý: project Supabase gói Free sẽ tạm dừng nếu không có truy cập khoảng 1 tuần; vào dashboard bấm *Restore* là chạy lại.

## Phát triển

```bash
npm install
cp .env.example .env.local   # (tuỳ chọn) điền Supabase để test online
npm run dev                  # http://localhost:5173
npm test                     # test engine chiến đấu, bản đồ, đồ thị cốt truyện
npm run build                # typecheck + build ra dist/
```

Công cụ dev trong `tools/` (chạy bằng `npx vite-node tools/<file>.ts`):
`sim.ts` / `sim1.ts` mô phỏng hàng trăm trận để cân bằng, `mapdump.ts <tầng>` in bản đồ dạng ASCII, `sprites.ts` xem sprite dạng chữ.

### Cấu trúc mã

```
src/
  combat/     engine chiến đấu (thuần logic, có test), hiệu ứng, phản ứng nguyên tố, AI
  data/       kỹ năng, nội tại, lớp nhân vật, quái, vật phẩm, công trình, công thức
  story/      hệ thống gamebook + nội dung: intro, floor1..3, sự kiện ngẫu nhiên
  world/      định nghĩa 100 tầng, biome, sinh bản đồ, Thánh Địa
  render/     sprite pixel (vẽ bằng dữ liệu ký tự), tile theo biome, camera bản đồ
  screens/    đăng nhập, Thánh Địa, Vực Sâu, chiến đấu, gamebook, đội hình, túi đồ
  net/        client Supabase RPC, quản lý lưu game
supabase/schema.sql   bảng + RLS + hàm RPC
tests/                vitest
```

### Thêm nội dung

- **Kỹ năng mới:** thêm một dòng `S(...)` trong `src/data/skills.ts`. Mô tả hiển thị được sinh tự động từ dữ liệu.
- **Sự kiện cốt truyện:** thêm `StoryEvent` (các cảnh, lựa chọn, điều kiện, kiểm tra xúc xắc, hiệu ứng, trận đánh) rồi gắn vào tầng trong `src/world/floors.ts`.
  Test `tests/world.test.ts` sẽ báo nếu có nhánh trỏ tới cảnh không tồn tại hoặc vật phẩm/quái sai tên.
- **Viết cốt truyện cho tầng 4+:** chuyển tầng đó từ bộ sinh tự động sang danh sách `HANDWRITTEN` trong `src/world/floors.ts`.

## Giới hạn hiện tại

- Chưa có âm thanh/nhạc.
- Cân bằng mới được mô phỏng kỹ cho tầng 1–3; các tầng sâu (đặc biệt 30+) cần tinh chỉnh thêm khi có cốt truyện.
- Người chơi rành kỹ thuật có thể sửa dữ liệu lưu của chính tài khoản mình (dữ liệu game do trình duyệt gửi lên). Nếu cần chống gian lận, phải chuyển logic quan trọng sang Edge Function.
