# FantasyLand

Game hành động góc nhìn từ trên xuống, chạy trên trình duyệt: điều khiển hiệp sĩ chém quái vật qua từng wave,
nhặt ngọc, giữ combo và đua điểm trên bảng xếp hạng online.

- **Frontend:** HTML5 Canvas + JavaScript thuần (không cần build, không thư viện) → host miễn phí trên **GitHub Pages**.
- **Backend:** **Supabase** (gói Free: Postgres + REST API tự sinh) để lưu bảng xếp hạng.
  Chưa cấu hình thì game vẫn chạy, điểm được lưu trong `localStorage` của trình duyệt.

## Cách chơi

| Thao tác | Máy tính | Điện thoại |
|---|---|---|
| Di chuyển | WASD / phím mũi tên | Kéo ở nửa trái màn hình |
| Chém | Click chuột / Space (hướng theo chuột) | Nút ⚔ hoặc chạm nửa phải (tự nhắm quái gần nhất) |
| Tạm dừng / tắt tiếng | P, Esc / M | — |

Quái: Slime, Dơi, Orc, Pháp sư (bắn cầu lửa – chém để phá), mỗi 5 wave có trùm. Hạ liên tiếp để tăng combo (tối đa x5).

## Cấu trúc

```
web/                  # toàn bộ site tĩnh được deploy lên GitHub Pages
  index.html
  css/style.css
  js/config.js        # URL + key Supabase (để trống = chế độ offline)
  js/leaderboard.js   # gọi Supabase REST, fallback localStorage
  js/game.js          # game loop, vẽ, AI quái, input
supabase/schema.sql   # tạo bảng scores + Row Level Security
.github/workflows/pages.yml  # tự deploy khi push lên main
```

## Chạy thử ở máy

```bash
cd web && python3 -m http.server 8000
# mở http://localhost:8000
```

## Deploy lên GitHub Pages

1. Merge code vào nhánh `main`.
2. Vào **Settings → Pages → Build and deployment → Source** chọn **GitHub Actions**.
3. Workflow *Deploy to GitHub Pages* sẽ chạy; game có tại `https://<username>.github.io/FantasyLand/`.

## Bật bảng xếp hạng online (Supabase, miễn phí)

1. Tạo tài khoản và project tại <https://supabase.com> (gói Free).
2. Vào **SQL Editor**, dán nội dung `supabase/schema.sql` và bấm **Run**.
3. Vào **Project Settings → API** (hoặc **API Keys**), lấy **Project URL** và **anon / publishable key**.
4. Trong repo GitHub: **Settings → Secrets and variables → Actions → tab Variables**, tạo 2 biến:
   - `SUPABASE_URL` = Project URL (vd. `https://abcd1234.supabase.co`)
   - `SUPABASE_ANON_KEY` = anon / publishable key
5. Chạy lại workflow (tab **Actions → Deploy to GitHub Pages → Run workflow**). Workflow sẽ ghi các giá trị này vào `web/js/config.js` lúc deploy.

> Anon/publishable key là key **công khai** – được thiết kế để nằm trong trình duyệt. Quyền truy cập bị giới hạn
> bởi Row Level Security: ai cũng chỉ được *đọc* và *thêm* điểm, không sửa/xoá được. **Tuyệt đối không** dùng
> `service_role` / secret key ở đây.

### Lưu ý

- Điểm do trình duyệt gửi lên nên người rành kỹ thuật có thể gửi điểm giả. Với game hobby thì chấp nhận được;
  nếu cần chặt hơn có thể thêm Supabase Edge Function để kiểm tra, hoặc xoá điểm bất thường trong Table Editor.
- Project Supabase gói Free sẽ bị tạm dừng sau ~1 tuần không có truy cập; vào dashboard bấm *Restore* là chạy lại.
