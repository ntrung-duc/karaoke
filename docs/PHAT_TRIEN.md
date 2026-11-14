# Hướng dẫn phát triển và vận hành

## 1. Môi trường và quy trình sửa mã

Dùng Node.js 22 trở lên. Cài đúng phiên bản dependency đã khóa bằng `npm.cmd ci`. Dự án dùng JavaScript ES modules, không có bundler hay bước build bắt buộc cho giao diện.

```powershell
cd C:\UTC\Nam4Ki1\karaoke
npm.cmd ci
npm.cmd run check
npm.cmd test
npm.cmd start
```

Sau mỗi thay đổi: chạy kiểm tra thích hợp, tải lại trình duyệt và thử luồng bị tác động. Mã trong `public` được đọc từ đĩa khi phục vụ; dùng Ctrl+F5 sau sửa frontend. Thay đổi `server/` hoặc `server.mjs` cần dừng bằng Ctrl+C rồi chạy lại. Restart làm mất trạng thái RAM và các kết nối sẽ được tạo lại.

`npm.cmd run check` chỉ kiểm tra cú pháp, không thay thế test hay kiểm tra hình ảnh. `npm.cmd test` dùng Node test runner; phần HTTP/WebSocket tạo server thử ở cổng ngẫu nhiên, cần quyền loopback và không dùng phòng trên cổng 4173.

## 2. Cấu hình máy chủ

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `4173` | Cổng HTTP và WebSocket, số nguyên 0–65535; 0 dành cho kiểm thử |
| `HOST` | `0.0.0.0` | Địa chỉ lắng nghe; `127.0.0.1` để chỉ nghe loopback |
| `TURN_URL` | Không có | URL máy chủ TURN khi kết nối audio trực tiếp thất bại |
| `TURN_USER` | Không có | Tài khoản TURN do người triển khai cung cấp |
| `TURN_PASSWORD` | Không có | Mật khẩu TURN tương ứng |

Ví dụ chạy riêng trên máy:

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = '4174'
npm.cmd start
```

Biến `$env:` tiếp tục tồn tại trong cửa sổ PowerShell đó. Muốn trả về mặc định, mở cửa sổ mới hoặc xóa biến tương ứng.

Có thể sao chép `.env.example` sang `.env`, sửa giá trị rồi chạy:

```powershell
Copy-Item .env.example .env
node --env-file=.env server.mjs
```

`npm start` hiện không tự đọc `.env`; nó đọc biến đã có trong môi trường tiến trình. Không commit `.env` hay bí mật TURN. Thông tin ICE cần thiết được gửi cho trình duyệt tham gia phòng; không dùng khóa quản trị hạ tầng làm credential TURN. STUN mặc định được cấu hình trong `public/app.js`.

## 3. Sửa đúng module

| Muốn thay đổi | Nơi bắt đầu | Kiểm tra kèm theo |
| --- | --- | --- |
| Giao diện, bảng điều khiển | `public/index.html`, `public/style.css`, `public/app.js` | Desktop, kích thước hẹp, focus và Escape |
| Nội thất, đèn, màn hình | `public/scenery.js` | Góc nhìn 3D, che khuất video, bóng/hiệu năng |
| Ghế, giới hạn phòng | `public/layout.js` và hình ghế ở `scenery.js` | Va chạm và ghế trùng; cả server lẫn client dùng layout |
| Camera/input/đồng bộ avatar | `public/hall.js` | WASD, Shift, Space, cảm ứng, bảng đang mở |
| Mô hình/clip avatar | `public/avatar.js`, `tools/prepare-mannequin.mjs` | Skinning, clone riêng, đổi trạng thái và dispose |
| Tốc độ/hướng/timeline nhảy | `public/motion.js` | Test chuyển động và kiểm tra trên hai trình duyệt |
| Quy tắc tên phòng/giới hạn chuỗi | `public/session.js` | Client và server cùng áp dụng |
| Nghiệp vụ ghế, hàng chờ, quyền hát | `server/rooms.mjs` | Test phòng độc lập, chuyển lượt và disconnect |
| HTTP/đường dẫn asset mới | `server/http.mjs` | Khai báo allowlist + MIME, kiểm tra 404/405 |
| Khởi tạo/vòng đời server | `server/application.mjs`, `server/config.mjs`, `server.mjs` | Port, upgrade và shutdown |

Thêm một module frontend mới cần đăng ký URL trong allowlist HTTP nếu trình duyệt sẽ import nó. Không mở toàn bộ thư mục dự án làm static root.

## 4. Hợp đồng avatar để dễ thay nhân vật

`hall.js` chỉ cần `createAvatar(color, material)` trả về:

```javascript
{
  body,        // THREE.Group gắn vào scene
  ready,       // Promise hoàn tất tải model hoặc phương án dự phòng
  setFace(index), // 0–8; cập nhật texture riêng cho avatar này
  update(dt, state, yaw, pitch),
  dispose(),
  get state() {}
}
```

Các state hiện dùng: `idle`, `sit`, `jump`, `fall`, `land`, `walk`/`run` cộng một trong tám hướng như `walkForwardLeft`. `yaw`, `pitch` là góc nhìn tương đối; vị trí toàn thân và độ cao nhảy do hall quản lý. Clip cần in-place để không cộng chuyển động tịnh tiến hai lần.

GLB được cache theo trang. Dùng `SkeletonUtils.clone` để mỗi người có bộ xương độc lập, clone material khi đổi màu; không dispose geometry/texture dùng chung lúc một người rời phòng. Hủy mixer, skeleton và material riêng khi xóa avatar. Nhân vật mới có rig khác cần retarget lại clip, không chỉ thay URL GLB.

Gói tải về có cả mannequin nam và nữ, nhưng bản chạy hiện chỉ đóng gói mannequin nam. Để thêm mannequin nữ: xuất mô hình nữ với clip nữ tương ứng, chuẩn hóa tên state, rồi thêm lựa chọn/thuộc tính avatar vào client, server và kiểm thử. Chưa có tùy chọn đó trong UI hiện tại.

## 5. Tạo lại asset

GLB và JSON đã được đóng gói sẵn, nên cài mới dự án không cần Unity hoặc gói FBX nguồn.

Khi cần tái tạo, tải bản chính thức từ tác giả rồi giải nén để có:

```text
tools/source-assets/human-basic-motions-free/
  Models/HumanM_Model.fbx
  Animations/Male/...
  Textures/HumanAnimations_ColorPalette.png
```

Sau đó:

```powershell
npm.cmd run prepare-mannequin
npm.cmd run prepare-motions
npm.cmd test
```

Có thể truyền đường dẫn nguồn khác bằng `npm.cmd run prepare-mannequin -- 'C:\duong-dan\goi-nguon'`. Hai script dùng chung danh sách 20 clip ở `tools/motion-sources.mjs`. Mannequin GLB thêm một tư thế ngồi tự tạo; hình khối dự phòng có dữ liệu JSON riêng. Script có thông báo về chuyển hệ trục Z-up và giới hạn bốn trọng số skinning khi đọc FBX; vẫn cần kiểm tra kết quả xuất.

Không sửa thủ công binary GLB để thêm clip. Sau xuất cần kiểm tra hướng mặt -Z, tỷ lệ cơ thể, sàn, tiếp đất, tư thế ngồi và hai avatar không dùng chung skeleton. Mannequin hiện có lớp vật liệu sáng hơn để đọc được trong nhà hát tối. Nguồn và điều kiện sử dụng nằm ở `public/assets/README.md`.

## 6. Danh sách thử trên trình duyệt trước khi bàn giao

- Vào hai cửa sổ cùng phòng: thấy cả hai; di chuyển/nhảy một người không kéo bộ xương người kia.
- Vào phòng khác: danh sách và lượt hát tách biệt.
- Thử ngồi/đứng, Space từ ghế, giữ Space, đi tám hướng, giữ Shift và đổi camera.
- Mở bảng/nhập tên: phím di chuyển không điều khiển avatar; Escape đóng bảng.
- Mở màn hình hẹp/cảm ứng: cụm di chuyển và nút Nhảy không che nút cần thiết.
- Kiểm tra trường hợp asset lỗi và console không có lỗi lặp mỗi frame.
- Chọn video được phép nhúng, thử hàng chờ/chuyển lượt và âm thanh bằng tai nghe.
- Tự cấp quyền mic khi cần kiểm tra. Việc test HTTP/animation tự động không chứng minh WebRTC hoạt động trên mọi mạng.

## 7. Triển khai và giới hạn vận hành

Hiện phù hợp chạy một instance Node sau reverse proxy HTTPS có hỗ trợ WebSocket upgrade. Giữ nguyên Host và chuyển tiếp Origin phù hợp vì máy chủ kiểm tra host của Origin. Trình duyệt dùng cùng origin cho HTTP và `/live` qua WSS. Node tự phục vụ các module Three.js từ `node_modules`, nên môi trường chạy phải có dependency.

Phục vụ ứng dụng ở gốc tên miền: asset và WebSocket hiện dùng URL tuyệt đối như `/app.js`, `/assets/...`, `/live`; chưa hỗ trợ tự động mount dưới `/karaoke/`. Nếu thay base path, cần sửa nhất quán routing và import.

Chưa triển khai proxy, TLS, TURN, database, xác thực hoặc load balancing trong repo. Khi dùng nhiều instance, cùng một tên phòng vẫn có thể bị chia thành nhiều Map riêng; cần thiết kế bộ điều phối/phân phối trạng thái trước. Cần đo tải thực tế thay vì suy ra capacity từ số ghế. Xem `KIEN_TRUC.md` cho thứ tự mở rộng.

## 8. Khuôn mặt và hướng đầu

Bộ 9 mặt lấy từ ảnh do người dùng cung cấp, giữ ảnh gốc ở public/assets/face-atlas.png. Các vùng mặt/tên nằm trong public/avatar-settings.js; public/faces.js tạo thumbnail, loại nền xám và vẽ texture đầu được cache theo lựa chọn. public/avatar-head.js dựng đầu bo tròn độc lập trên bone B-head. Script xuất GLB bỏ phần đầu cũ và giữ trọng số vùng cổ trên bone cổ để đầu xoay không kéo thân.

Client gửi appearance với face là số nguyên 0–8. Máy chủ kiểm tra trước khi đưa face vào snapshot. localStorage lưu rap-face và gửi lại khi kết nối. Trường bodyYaw do máy chủ thiết lập khi vào phòng/lên sân khấu; yaw chỉ là hướng nhìn, được chuẩn hóa theo vòng tròn. WASD tính theo bodyYaw; không dùng yaw để xoay thân hoặc xác định hướng đi. Không thêm lại giới hạn góc đầu ±1,2 rad hay cơ chế thân đuổi theo đầu nếu muốn giữ hành vi 360°.

## Camera và đầu

`public/camera-controls.js` sở hữu camera mode, yaw/pitch cục bộ và khoảng cách orbit. Thao tác kéo ở góc avatar không sửa user.yaw/user.pitch và không làm dirty pose. Khi chuyển vào góc thứ nhất bằng con lăn/nút, controller chép hướng camera vào đầu; chỉ các thao tác kéo ở mode first sửa pose để gửi server. Không gộp hướng orbit vào trạng thái user khi mở rộng hệ thống camera.

### Quy tắc di chuyển mới

`cameraControls.movementHeading(player)` dùng yaw camera/đầu khi mode first, bodyYaw khi mode avatar. `displacementGait` chiếu dịch chuyển thực tế về hệ trục thân để chọn clip đúng. `player-state.js` quản lý dự đoán đứng dậy và hòa giải snapshot phòng, tránh giật lùi khi có bản tin cũ. `batchStaticBoxes` chỉ gộp kiến trúc tĩnh dùng chung BoxGeometry; không gọi lại sau khi thêm avatar/đối tượng cần chuyển động vào cùng geometry.
