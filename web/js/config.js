// Cấu hình backend (Supabase). Để trống => bảng xếp hạng chỉ lưu trên máy (localStorage).
// Khi deploy bằng GitHub Actions, file này được ghi đè từ Repository Variables
// SUPABASE_URL và SUPABASE_ANON_KEY (xem README). Anon/publishable key là key công khai,
// an toàn để lộ ra trình duyệt vì quyền truy cập được giới hạn bằng Row Level Security.
window.FL_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
};
