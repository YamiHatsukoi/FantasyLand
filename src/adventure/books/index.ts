/**
 * Library of Adventure. Each book's data is loaded only when it is opened.
 * Adding a book: put its data in `books/<id>.ts` (`export default {...} satisfies Book`),
 * its images in `public/adventure/<id>/`, and one line here.
 */
import type { Book, Mood } from "../types";

export interface BookMeta {
  id: string;
  title: string;
  subtitle?: string;
  blurb: string;
  author?: string;
  cover?: string;
  accent?: string;
  mood?: Mood;
  load: () => Promise<Book>;
}

export const BOOKS: BookMeta[] = [
  {
    id: "demo",
    title: "Ngọn Hải Đăng Tắt Lửa",
    subtitle: "Truyện thử nghiệm",
    blurb: "Một cuộc phiêu lưu ngắn để thử engine: lựa chọn, thử vận may, vật phẩm và chiến đấu theo lượt.",
    mood: "storm",
    accent: "#9fd7ff",
    load: () => import("./demo").then((m) => m.default),
  },
];
