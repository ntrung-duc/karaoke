# Tiến độ hiện tại — 14/11/2026

## Trạng thái bàn giao

Đã hoàn tất các yêu cầu đang làm trước lần tạm dừng:

1. **Màn hình người hát:** nâng tâm màn hình nhỏ từ Y=1,28 lên Y=1,85, thêm chân đỡ; màn hình lớn không đổi. Đã kiểm tra trên sân khấu ở góc nhìn avatar.
2. **Chọn 9 khuôn mặt:** bảng Phòng hát → Khuôn mặt avatar, lấy đúng 9 mặt từ ảnh người dùng gửi. Lưu bằng `rap-face` trong localStorage, gửi lại khi kết nối và đồng bộ qua server cho người khác trong phòng.
3. **Đầu xoay 360° độc lập:** bỏ giới hạn yaw ±1,2 rad và cơ chế thân xoay đuổi theo đầu. `yaw` là hướng nhìn; `bodyYaw` là hướng thân do server đặt. WASD đi theo hướng thân. Khi lên/xuống sân khấu, server đặt lại hướng thích hợp.
4. **Hình dạng đầu:** người dùng đã cho phép thay đổi. Thân và rig vẫn từ mannequin chính thức; đầu thay bằng ellipsoid bo tròn, nét mặt được vẽ thẳng vào texture đầu. Không dùng lớp decal nổi trên mặt mannequin nữa vì dễ che nét khi quay ngược. Vùng cổ không bị head bone kéo theo.
5. **Khung dự án và tài liệu:** đã tách server HTTP/config/rooms/application, cảnh nhà hát và avatar. Có README, hướng dẫn sử dụng, kiến trúc và phát triển trong thư mục docs.

## File quan trọng

- `public/scenery.js`: vị trí màn hình nhỏ và chân đỡ.
- `public/avatar.js`: mannequin, texture mặt và vòng đời avatar.
- `public/avatar-head.js`: đầu bo tròn trên bone B-head.
- `public/faces.js`: lấy nét mặt từ ảnh, thumbnail và texture đầu.
- `public/avatar-settings.js`: 9 mặt, vùng cắt, kiểm tra face và chuẩn hóa yaw.
- `public/assets/face-atlas.png`: ảnh tham chiếu gốc do người dùng cung cấp.
- `public/hall.js`: hướng thân riêng, góc đầu, hướng di chuyển, camera.
- `public/app.js`: UI chọn mặt, localStorage, gửi appearance.
- `server/rooms.mjs`: kiểm tra face 0–8, đồng bộ face/bodyYaw.
- `tools/prepare-mannequin.mjs`: xuất GLB, bỏ đầu gốc, giữ vùng cổ theo bone cổ.
- `public/assets/mannequin.glb`: asset đã tạo lại, có 21 clip (20 nguồn + ngồi).

## Kiểm tra đã hoàn thành

- `npm.cmd run check`: đạt, 24 file JavaScript.
- `npm.cmd test`: đạt 9/9 sau khi tiếp tục từ lần tạm dừng.
- Kiểm thử tự động gồm face hợp lệ/không hợp lệ, gửi yaw qua nhiều góc không thay bodyYaw, bộ xương riêng, đầu xoay không kéo các đỉnh thân/cổ, nhảy, tách phòng, hàng chờ và quyền chuyển lượt.
- Trình duyệt: 9 thumbnail đúng ảnh, mặt trên đầu đầy đủ, lựa chọn giữ sau tải lại; kiểm tra đầu quay 180° trong khi thân giữ 0°; console không có lỗi ứng dụng trong các lượt kiểm tra.
- Màn hình: đã vào lượt thử trong phòng `final-review`, xác nhận vị trí nâng cao và chân đỡ ở góc nhìn avatar; đã kết thúc lượt thử.
- Đã mở bản chính ở `http://localhost:4173` và bảng chọn khuôn mặt, kết nối trực tuyến.

## Ảnh minh họa

- [Bảng chọn mặt và đầu mới](images/avatar-faces.jpg).
- [Vị trí màn hình người hát](images/singer-monitor.jpg). Ảnh này dùng mã video giả `abcdefghijk` để kiểm tra bố cục, nên thông báo YouTube unavailable trong ảnh là chủ ý; không có nội dung âm thanh thử.

Trong đợt này không kiểm tra lại micro/audio WebRTC trên mạng Internet hoặc nhiều thiết bị thật. Không coi 9 test là kiểm thử tải hay chứng nhận production.

## Khi quay lại dự án

```powershell
cd C:\UTC\Nam4Ki1\karaoke
npm.cmd start
```

Nếu máy chủ 4173 vẫn chạy thì chỉ mở trang và Ctrl+F5. Nếu dừng/chạy lại, trạng thái phòng và hàng chờ trong RAM sẽ mất như thiết kế hiện tại. Các tiến trình xem trước từ lượt bị tạm dừng có thể đã bị hệ thống dừng; không dựa vào session id cũ. Đọc file này cùng `KIEN_TRUC.md` trước khi tiếp tục mở rộng.

Không còn bước lập trình bắt buộc nào của ba thay đổi trên đang bỏ dở. Bước tiếp theo là nhận phản hồi người dùng về giao diện/chiều cao hoặc tính năng mới.

## Cập nhật mới nhất: camera góc thứ ba / thứ nhất

Yêu cầu mới thay thế hành vi kéo chuột mô tả ở phần bàn giao trước:

- Góc thứ ba: camera có yaw, pitch và khoảng cách riêng; kéo chuột chỉ xoay camera quanh avatar, không đổi yaw/pitch của đầu.
- Cuộn lên để tiến gần; khoảng cách <= 0,55 chuyển sang góc thứ nhất. Đầu đồng bộ với hướng camera lúc chuyển và tiếp tục nhìn theo khi kéo chuột.
- Cuộn lùi để trở lại góc thứ ba. Đầu giữ hướng cuối ở góc thứ nhất; xoay camera tiếp không kéo đầu theo.
- Thân và hướng WASD vẫn dùng bodyYaw riêng. Nút Đổi góc nhìn vẫn giữ chu kỳ avatar → thứ nhất → toàn cảnh.
- Module mới: `public/camera-controls.js`; tích hợp ở `public/hall.js`. Đã đăng ký static route.
- Kiểm tra: cú pháp 26 file; 13/13 test đạt. Đã thử kéo và cuộn chuột thực tế trong Edge, thấy chuyển qua lại đúng nhãn góc nhìn.
- Khi đến lượt hát hoặc kết thúc lượt của chính mình, camera căn lại theo vị trí/hướng mới. Lượt của người khác không làm mất góc orbit đang chọn.

Ảnh kiểm chứng camera mới:

- [Orbit góc thứ ba, đầu không xoay theo](images/camera-third-person.jpg).
- [Cuộn vào góc thứ nhất](images/camera-first-person.jpg).

Đã kiểm tra lại bằng chuột ở bản chính cổng 4173 sau khi cập nhật. Giữ máy chủ chính chạy; máy chủ xem trước 4178 được dọn sau kiểm tra.

## Sửa hướng WASD và giảm độ trễ

- Góc thứ nhất dùng camera/head yaw cho W/A/S/D; góc thứ ba tiếp tục dùng bodyYaw. Hướng animation được tính theo dịch chuyển thực tế so với thân để chạy/đi ngang/lùi đúng.
- Đứng dậy được dự đoán ngay trên client khi bấm phím, không chờ snapshot trả về. `public/player-state.js` giữ vị trí/góc nhìn đang dự đoán khi nhận snapshot cũ; lệnh ngồi hoặc chuyển lên/xuống sân khấu từ server vẫn được áp dụng.
- Chuyển trạng thái đi/dừng gửi ngay, không chờ nhịp 75 ms; cập nhật di chuyển cục bộ vẫn chạy mỗi frame.
- Bù thời gian frame tối đa 100 ms thay vì 45 ms để tránh đi chậm khi khung hình giảm; vẫn giới hạn bước khi tab bị treo lâu.
- `batchStaticBoxes` trong scenery gộp 465 mesh khối tĩnh thành 32 draw objects; giữ world transform, vật liệu và cờ shadow. Màn hình, đèn động và avatar không bị gộp.
- Đã thử W từ ghế, xoay camera khoảng 90°, zoom vào góc thứ nhất rồi giữ W trong Edge. Quan sát 5 pose liên tiếp: forwardAlignment=1, yaw=1.57 và bodyYaw=0; xác nhận hướng đi trùng hướng nhìn. Đây không phải phép đo thời gian input-to-photon hay FPS trên mọi thiết bị.
