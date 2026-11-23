# Nhà hát Iron Dome

Ứng dụng karaoke nhiều người dùng trên web, dùng Node.js, WebSocket, Three.js và WebRTC. Avatar mặc định là mannequin nam chính thức trong gói **Human Basic Motions FREE** của Kevin Iglesias. Không cần cài Unity để chạy ứng dụng.

## Chạy nhanh trên Windows

Cần Node.js 22 trở lên và trình duyệt hỗ trợ WebGL.

```powershell
cd C:\UTC\Nam4Ki1\karaoke
npm.cmd ci
npm.cmd start
```

Mở [http://localhost:4173](http://localhost:4173). Giữ cửa sổ máy chủ chạy; nhấn `Ctrl+C` để dừng. Sau khi sửa mã máy chủ, dừng và chạy lại. Sau khi sửa giao diện, tải lại trang bằng `Ctrl+F5`.

## Tài liệu

- [Hướng dẫn sử dụng](docs/HUONG_DAN_SU_DUNG.md): vào phòng, đi/chạy/nhảy, chọn bài, bật mic và xử lý lỗi.
- [Kết nối chat TikTok LIVE](docs/TIKTOK_LIVE.md): admin kết nối kênh đang LIVE, hiển thị bình luận và xử lý mất kết nối.
- [Đánh giá kiến trúc](docs/KIEN_TRUC.md): sơ đồ thành phần, trách nhiệm từng file, giới hạn và lộ trình mở rộng.
- [Hướng dẫn phát triển](docs/PHAT_TRIEN.md): cấu hình, kiểm thử, thêm tính năng, thay avatar và triển khai.
- [Nguồn mô hình và animation](public/assets/README.md): xuất xứ, giấy phép và cách tạo lại GLB.

## Điều khiển

| Thao tác | Điều khiển |
| --- | --- |
| Đi | WASD hoặc phím mũi tên |
| Chạy | Giữ Shift khi đi |
| Nhảy | Space; đang ngồi sẽ đứng dậy rồi nhảy |
| Nhìn quanh | Kéo chuột: xoay camera ở góc thứ ba, xoay đầu ở góc thứ nhất |
| Đổi góc nhìn, ngồi/đứng | Mở bảng **Phòng hát** |
| Đăng ký bài | Mở bảng **Chọn bài** |
| Đóng bảng | Nút × hoặc Escape |

Trên thiết bị cảm ứng có nút di chuyển và **Nhảy**. Đóng bảng điều khiển trước khi di chuyển.

## Lệnh dành cho người phát triển

```powershell
npm.cmd run check
npm.cmd test
```

`check` kiểm tra cú pháp JavaScript. `test` kiểm tra cấu hình, mannequin, chuyển động và giao thức HTTP/WebSocket. Chạy test cần quyền kết nối localhost. Không cần tải lại asset nguồn để chạy hoặc kiểm thử bản đã có GLB.

## Phạm vi hiện tại

Đây là nền tảng demo/MVP cho một máy chủ. Có nhiều phòng độc lập, 20 ghế mỗi phòng và tối đa 60 bài chờ mỗi phòng; 20 ghế không phải giới hạn số người kết nối. Chưa có kiểm thử tải để công bố sức chứa. Trạng thái phòng và hàng đợi mất khi khởi động lại; URL phòng riêng chưa có mật khẩu. Dùng HTTPS khi chia sẻ qua Internet và dùng mic. Xem đánh giá kiến trúc trước khi mở rộng thành dịch vụ công khai.

Trong **Phòng hát → Khuôn mặt avatar**, có thể chọn 9 mặt; lựa chọn được lưu trên trình duyệt và đồng bộ trong phòng. Ở góc thứ ba, kéo chuột xoay camera mà đầu không đi theo. Cuộn vào góc thứ nhất để đầu nhìn theo camera; cuộn lùi để trở lại góc thứ ba. WASD đi theo camera ở góc thứ nhất và theo hướng thân ở góc thứ ba.

Tiến độ và ghi chú bàn giao: [docs/TIEN_DO.md](docs/TIEN_DO.md).
