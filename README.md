# Rạp Âm · Iron Dome Karaoke

Phòng sinh hoạt 3D trên web để hát karaoke theo hàng đợi, xem phim cùng nhau và chơi Ma Sói. Mỗi người chọn tên và một avatar động vật trước khi vào phòng. Hỗ trợ máy tính và điện thoại, không cần cài game hay Unity.

Web: [karaoke-eiqz.onrender.com](https://karaoke-eiqz.onrender.com/).

## Bắt đầu sử dụng

1. Nhập tên và chọn mèo, chó, vịt, gà, bò, gấu, lợn, ngựa hoặc rồng. Không đổi loài khi đang ở phòng.
2. Bấm **Vào phòng**. Bạn xuất hiện ở cửa thang máy; bấm/chạm ghế trống để tự đi đến ngồi.
3. Mở **Chọn bài / Phim** để đăng ký karaoke hoặc tìm phim. Chủ phòng đổi chế độ tại **Phòng hát → Karaoke / Xem phim / Ma Sói**.
4. Mở **Phòng hát → Hướng dẫn** bất cứ lúc nào để xem thao tác và cách khôi phục tiếng/video.

Người đầu tiên vào phòng là chủ phòng 👑, có thể trao quyền trong danh sách **Trong phòng**. Khi chủ phòng mất kết nối, quyền được giữ tối đa 45 giây rồi chuyển cho người còn kết nối đã vào sớm nhất. Người đang hát vẫn tự điều khiển bài của mình.

## Karaoke

- Tìm tên bài trên YouTube hoặc dán link video, bấm **Thêm vào hàng đợi / Đăng ký lượt hát** và chờ xác nhận **Đã thêm**.
- Mọi người lần lượt lên hát theo hàng đợi; chưa có song ca. Đến lượt, avatar tự lên sân khấu và web thử bật mic sau khi có quyền trình duyệt.
- Người hát xem màn hình lời riêng, kiểm tra **Phòng hát → Âm lượng mic**, rồi bấm **▶ Bắt đầu hát**. Người hát có quyền tạm dừng/tiếp tục và bỏ qua bài; hết bài tự chuyển lượt.
- Mỗi máy tự tải video YouTube; web điều chỉnh đồng bộ thời điểm phát, không lưu video YouTube vào phòng. Giọng hát đi qua LiveKit khi cấu hình đầy đủ.
- Mặc định nhạc **30%**, giọng hát **100%**, bù trễ người nghe **650 ms**; lựa chọn đã lưu trên máy được giữ lại. Âm lượng nghe là thiết lập cá nhân, không giảm mic gửi đến người khác. Người hát có thể chỉnh độ vang gửi ra phòng.
- Khán giả bấm **🌹** cạnh thanh chat để cổ vũ. Nên dùng tai nghe để tránh vọng nhạc vào mic.

## Xem phim

- Mở **Chọn bài / Phim → Tìm và chọn phim**, tìm tên hoặc dán link KKPhim, chọn phiên bản/tập. Chủ phòng bấm **Chiếu phim này cho cả phòng** rồi **Phát phim**.
- Chủ phòng điều khiển phát, tạm dừng và tua chung. Trên điện thoại, thanh thời gian nằm trong **Phòng hát** để không che cảnh.
- Màn chiếu được mở rộng, ẩn mic sân khấu và đèn rọi. Mỗi người có thể tự bật mic trò chuyện trong **Phòng hát**.
- Chọn phim khi có người hát sẽ chờ hết bài. Hàng đợi karaoke được giữ; chủ phòng chọn **Phòng hát → Karaoke** để quay về hát.
- Nguồn phim có thể lỗi hoặc giới hạn vùng; mỗi máy có nút tải lại/bắt kịp phim. Chưa hỗ trợ tự trích video từ link trang bất kỳ.

## Ma Sói

- Chủ phòng chọn **Phòng hát → Ma Sói**. Người chơi mở **🐺 Bàn chơi → Tham gia bàn → Sẵn sàng**; cần **5–20 người** để bắt đầu.
- Có **26 vai** để lựa chọn trước ván; bộ vai thực sự phụ thuộc số người, không phải bật toàn bộ là ván nào cũng có đủ 26 vai.
- Mở **🃏 Vai của tôi** để xem vai/kết quả riêng. Ban đêm chờ lượt kỹ năng, chọn mục tiêu rồi xác nhận; ban ngày thảo luận và bỏ phiếu. Hết giờ không chọn thì bỏ lượt.
- Vai bí mật do máy chủ xử lý. Người bị loại và khán giả có chat/mic tách khỏi người còn chơi; Sói có chat riêng ban đêm. Người vào sau khi ván bắt đầu chỉ xem.
- Muốn đổi chế độ khi đang chơi, chủ phòng phải kết thúc ván trước. Kết thúc ván sẽ công khai vai.

## Chat nội bộ và TikTok LIVE

- Thanh nhập nằm dưới màn hình. Mục **Chat** hiện 10 tin nội bộ gần nhất, tin mới ở trên. Chat công khai hiện tạm trên đầu avatar; rê chuột lên avatar để xem tên.
- Chủ phòng mở **Phòng hát → Chat TikTok LIVE**, nhập `@ten_kenh` hoặc `https://www.tiktok.com/@ten_kenh/live`, rồi **Kết nối LIVE**. Kênh phải đang LIVE; dùng username, không dùng tên hiển thị hoặc link rút gọn.
- Bình luận mới có nhãn **TikTok**, giữ tối đa 10 tin riêng bên cạnh tin nội bộ. Mỗi người có thể ẩn/hiện trên máy mình; chỉ chủ phòng đổi kênh hoặc ngắt kết nối cho cả phòng.
- Chỉ nhận **TikTok → web**, không gửi chat/video/mic của phòng lên TikTok. Thư viện không chính thức có thể bị TikTok giới hạn. Server restart hoặc người cuối cùng rời phòng thì ngắt LIVE.
- Xem [hướng dẫn kết nối và xử lý lỗi TikTok](docs/TIKTOK_LIVE.md).

## Điều khiển

| Thao tác | Máy tính | Điện thoại |
| --- | --- | --- |
| Di chuyển | WASD hoặc phím mũi tên | Joystick bên trái |
| Nhìn quanh | Kéo chuột trên cảnh | Kéo một ngón trên cảnh |
| Góc nhìn thứ nhất / thứ ba | Cuộn chuột gần/xa | Chụm/tách hai ngón |
| Chọn ghế | Rê chuột thấy mũi tên, bấm ghế trống | Chạm ghế trống |
| Đứng dậy | Di chuyển, Space hoặc **Phòng hát → Đứng dậy** | Joystick hoặc **Phòng hát → Đứng dậy** |
| Nhảy | Space | Không có nút nhảy riêng |
| Toàn rạp / góc nhìn avatar | **Phòng hát → Đổi góc nhìn** | **Phòng hát → Đổi góc nhìn** |
| Đóng bảng | Nút × hoặc Escape | Nút × |

Không có Shift chạy nhanh. Đóng bảng/đưa focus về cảnh sau khi nhập chat hoặc tìm bài để di chuyển. Trong Ma Sói, avatar được xếp vào bàn thay vì tự đi quanh rạp.

## Không có tiếng hoặc hình

- **Không nghe gì:** bấm **Bật nhạc và giọng hát** nếu hiện ra, hoặc **Phòng hát → Bật tiếng**. Trình duyệt có thể cần một lần chạm để phát âm thanh.
- **Có nhạc nhưng thiếu giọng hát:** chọn **Kết nối lại giọng hát**. Người hát kiểm tra quyền mic, icon mic và thanh mức âm lượng mic.
- **Mic gạch đỏ:** đang tắt, bấm để bật. Thanh mức mic chỉ xác nhận máy đang thu được tín hiệu, không thay thế kiểm tra ở máy người nghe.
- **Video đen/đứng:** thử **Tải lại video**, hoặc **Tải lại phim / Bật tiếng / bắt kịp phim**. Video YouTube không cho nhúng cần chọn bài khác.
- **iPhone/iPad:** nhạc 0% tắt riêng nhạc; mức 1–100% có thể không được trình duyệt áp dụng. Nút âm lượng máy chỉnh tổng tiếng.
- **Đang kết nối lại:** chờ web tự nối lại; nếu vẫn kẹt, tải lại trang và vào phòng. Render Free có thể cần thời gian thức dậy.

## Chạy trên Windows

Cần Node.js **22.x** và trình duyệt hỗ trợ WebGL. Dùng HTTPS khi chia sẻ và dùng mic trên thiết bị khác; localhost dùng được để thử trên máy chạy server.

```powershell
cd C:\UTC\Nam4Ki1\karaoke
npm.cmd ci
npm.cmd start
```

Mở [http://localhost:4173](http://localhost:4173). Dừng bằng `Ctrl+C`; sửa server thì chạy lại, sửa giao diện thì tải lại trang. Thêm `?room=ten-phong` để chọn phòng riêng: 1–48 chữ Latin, số, `_` hoặc `-`. **Mời bạn bè** sao chép link phòng trên địa chỉ HTTPS dùng chung.

### Biến môi trường

| Biến | Công dụng |
| --- | --- |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Âm thanh LiveKit, cần đủ ba giá trị |
| `YOUTUBE_API_KEY` | Tìm tên bài qua YouTube Data API; dán link không cần key |
| `REDIS_URL`, `REDIS_PREFIX` | Lưu trạng thái/checkpoint và cache; prefix tách môi trường |
| `ROOM_STATE_MODE=local` | Một tiến trình Render giữ trạng thái realtime, ghi checkpoint Redis khi có cấu hình |
| `EULERSTREAM_API_KEY` | Tùy chọn cho dịch vụ ký TikTok khi cần key; hạn mức/chi phí tùy nhà cung cấp |
| `PORT`, `HOST` | Cổng và địa chỉ server; Render cấp PORT, HOST thường là 0.0.0.0 |

Giữ key/secret trong Environment của Render hoặc môi trường Node, không đưa vào trình duyệt hay commit. Nếu thiếu LiveKit, code còn đường P2P dự phòng với STUN/TURN; có thể không nối được ở một số mạng.

Repo có [render.yaml](render.yaml). Dịch vụ hiện tại do người dùng manual deploy: sau khi push GitHub, chọn **Render → Manual Deploy → Deploy latest commit**. Deploy làm kết nối phòng phải nối lại; TikTok cần chủ phòng kết nối lại.

### Kiểm tra và build

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run build:static
```

`check` kiểm tra cú pháp; `test` kiểm tra hàng đợi, quyền điều khiển, kết nối lại, chat/TikTok, âm thanh, phim, Ma Sói và mô hình. Một số bài cần localhost, bài Redis tích hợp cần Redis thật. `build:static` tạo tài nguyên trong `dist/`, không thay thế Node server/WebSocket.

## Kiến trúc và giới hạn

- Node.js/WebSocket quản lý phòng; Three.js dựng rạp/avatar, LiveKit truyền giọng hát, YouTube nhúng karaoke và HLS/native video phát phim.
- Render mặc định chạy một tiến trình. Có Redis thì ghi checkpoint nền; không Redis thì trạng thái ở RAM và mất khi server restart. Checkpoint không phải bản ghi từng thay đổi tức thì.
- Có 20 ghế rạp/phòng và tối đa 60 bài chờ. Chưa kiểm thử tải để công bố sức chứa người dùng. TikTok tối đa 10 phòng kết nối/server, 5 bình luận/giây/phòng; chưa chia sẻ nguồn TikTok giữa nhiều replica.
- Link phòng chưa có mật khẩu hay tài khoản xác thực. Chủ phòng là quyền trong phiên, không phải tài khoản admin toàn hệ thống.
- Đồng bộ video phụ thuộc mạng, khả năng nhúng, autoplay và thiết bị; không bảo đảm tất cả máy phát cùng một khung hình.

## Tài liệu bổ sung

- [Kết nối TikTok LIVE](docs/TIKTOK_LIVE.md).
- [Hướng dẫn sử dụng](docs/HUONG_DAN_SU_DUNG.md), [kiến trúc](docs/KIEN_TRUC.md), [phát triển](docs/PHAT_TRIEN.md), [tiến độ](docs/TIEN_DO.md): có ghi chú các giai đoạn trước; README này mô tả luồng hiện tại.
- [Nguồn tài nguyên](public/assets/README.md): mô hình/animation và giấy phép, gồm cả tài nguyên cũ còn trong repo.
