# Đưa chat TikTok LIVE vào phòng

## Kết nối

1. Deploy commit mới trên Render bằng **Manual Deploy → Deploy latest commit**. Không cần thay các khóa LiveKit/YouTube/Redis.
2. Mở TikTok và bắt đầu LIVE trên kênh của bạn. Tính năng này đọc bình luận của một buổi LIVE có sẵn, không phát hình/âm thanh của web lên TikTok.
3. Vào đúng phòng karaoke. Người có biểu tượng 👑 là chủ phòng; chủ phòng hiện tại có thể trao quyền trong **Phòng hát**.
4. Chủ phòng mở **Phòng hát → Chat TikTok LIVE**. Nhập `@ten_kenh` hoặc `https://www.tiktok.com/@ten_kenh/live`, bấm **Kết nối LIVE**. Dùng username, không dùng tên hiển thị và không dùng link rút gọn `vt.tiktok.com`.
5. Khi hiện **Đang nhận chat từ @ten_kenh**, gửi thử một bình luận trên TikTok rồi mở **Chat** trên web. Tin từ TikTok có nhãn riêng, không xuất hiện trên đầu avatar.

Mọi người trong phòng đều nhận được bình luận. Công tắc **Hiện chat TikTok trên máy này** chỉ ảnh hưởng máy của người bật/tắt. Chỉ chủ phòng mới được **Ngắt kết nối** hoặc đổi kênh. Chat trong web không được gửi ngược lên TikTok.

## Khi không nhận được bình luận

- Kênh phải đang LIVE và cho phép bạn xem bình luận. Kiểm tra username bằng link kênh.
- Bật công tắc hiển thị, mở mục **Chat**, và gửi bình luận mới sau khi kết nối thành công. Không tải lại bình luận cũ từ TikTok.
- Kết nối sẽ tự thử lại tối đa 3 lần. Nếu vẫn lỗi, chủ phòng chờ một chút rồi bấm **Kết nối LIVE** lại. Không tự tạo vòng lặp thử vô hạn.
- Đây là thư viện không chính thức `tiktok-live-connector` (đang khóa phiên bản 2.5.0). TikTok có thể chặn IP máy chủ hoặc thay đổi giao thức. Máy chủ cần truy cập được TikTok và dịch vụ ký kết nối của Euler Stream. Nếu dịch vụ ký yêu cầu API key/hết hạn mức, có thể cấu hình `EULERSTREAM_API_KEY` trong Environment của Render rồi deploy lại; hạn mức/chi phí phụ thuộc nhà cung cấp. Không cần nhập mật khẩu hoặc cookie TikTok vào web.
- Máy chủ restart/deploy hoặc người cuối cùng rời phòng thì ngắt kết nối TikTok. Chủ phòng kết nối lại sau khi vào phòng. Không tự nối khi chưa có ai ở phòng.

## Giới hạn và cách vận hành

- Thiết kế cho một máy chủ Node/Render đang phục vụ phòng. Chưa chia sẻ kết nối TikTok giữa nhiều instance; không bật nhiều replica nếu cần chat TikTok chung.
- Mỗi phòng chỉ có một kết nối nguồn, tối đa 10 phòng kết nối trên một server. Không thay đổi quyền điều khiển karaoke/phim/Ma Sói.
- Giữ tối đa 10 bình luận TikTok gần nhất trên từng trình duyệt bên cạnh 10 tin nội bộ. Người vào sau chỉ nhận bình luận mới; không lưu Redis hay lịch sử dài hạn.
- Chỉ nhận sự kiện bình luận, bỏ quà/like/join. Khử trùng ID, tối đa 5 bình luận/giây/phòng và gửi theo lô 250 ms. Khi chat quá nhanh sẽ bỏ bớt bình luận để bảo vệ phòng.
- Bình luận render bằng `textContent`; không mở HTML/link hoặc thực thi lệnh từ chat TikTok. Chat game riêng tư và bí mật vai Ma Sói không được gửi đến TikTok.
- Lỗi upstream được giữ trong kết nối TikTok riêng, không đóng WebSocket phòng hay dừng nhạc/mic.

Thư viện và giấy phép: [TikTok-Live-Connector, AGPL-3.0](https://github.com/zerodytrash/TikTok-Live-Connector). Source của phần tích hợp nằm trong repo này; xem giấy phép phụ thuộc khi phân phối bản sửa đổi.
