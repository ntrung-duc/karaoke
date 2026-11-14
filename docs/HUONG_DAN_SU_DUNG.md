# Hướng dẫn sử dụng Nhà hát Iron Dome

## 1. Chuẩn bị và mở ứng dụng

Máy chạy dự án cần Node.js 22 trở lên. Trong PowerShell:

```powershell
cd C:\UTC\Nam4Ki1\karaoke
npm.cmd ci
npm.cmd start
```

Mở [http://localhost:4173](http://localhost:4173) bằng Edge, Chrome hoặc trình duyệt có WebGL. Không mở trực tiếp file `public/index.html`, vì ứng dụng cần máy chủ HTTP và WebSocket. Người tham gia chỉ cần trình duyệt, không cần cài Node.js hay Unity.

Khi góc trên trái hiện **Trực tuyến**, bạn đã kết nối phòng. Lần đầu tải mannequin có thể mất thêm thời gian; dữ liệu mô hình khoảng 3,6 MiB và được dùng chung cho các avatar trong cùng trang.

## 2. Vào cùng phòng

Không có tham số phòng thì ứng dụng vào phòng `studio`. Ví dụ phòng riêng:

[http://localhost:4173/?room=lop-4A](http://localhost:4173/?room=lop-4A)

Tên phòng dài 1–48 ký tự, gồm chữ Latin, số, `_` hoặc `-`. Phân biệt chữ hoa và chữ thường. Mọi người cần mở cùng địa chỉ máy chủ và cùng tên phòng.

`localhost` chỉ trỏ tới máy đang mở trình duyệt: gửi link localhost cho người khác sẽ không đưa họ vào máy của bạn. Để sử dụng từ xa, cần địa chỉ HTTPS chung đã triển khai; nút **Mời bạn bè** sao chép địa chỉ đó. Phòng được tách theo tên, hiện chưa có mật khẩu hay kiểm soát người tham gia.

## 3. Tên hiển thị và avatar

Mở **Phòng hát**, sửa **Tên của bạn** rồi nhấn Tab hoặc bấm ra ngoài ô để cập nhật. Tên tối đa 24 ký tự và được nhớ trên trình duyệt đang dùng. Đây là tên hiển thị, chưa phải tài khoản đăng nhập.

Avatar mặc định là mannequin nam trong gói Human Basic Motions FREE. Mỗi người có một sắc độ nhẹ khác nhau và bộ xương chuyển động riêng. Mở **Phòng hát → Khuôn mặt avatar** để chọn một trong 9 mặt từ ảnh tham chiếu. Lựa chọn được nhớ trên trình duyệt và gửi cho mọi người trong phòng. Đầu được bo tròn để nét mặt rõ và xoay độc lập; hiện chưa có lựa chọn mannequin nữ hoặc thay trang phục.

## 4. Di chuyển và nhìn quanh

Đóng bảng **Phòng hát** hoặc **Chọn bài**, sau đó bấm vào vùng nhà hát để nhận bàn phím.

| Điều khiển | Tác dụng |
| --- | --- |
| W / ↑ | Đi tới |
| S / ↓ | Đi lùi |
| A / ← | Đi ngang trái |
| D / → | Đi ngang phải |
| Shift + phím di chuyển | Chạy |
| Space | Nhảy một lần |
| Nhấn giữ và kéo chuột | Góc thứ ba: xoay camera quanh avatar, đầu không xoay theo. Góc thứ nhất: đầu nhìn theo camera |

Space khi đang ngồi sẽ đứng dậy rồi nhảy. Giữ Space không tự nhảy liên tục; cần chờ hết pha tiếp đất mới nhảy tiếp. Trên màn hình cảm ứng, dùng cụm mũi tên và nút **Nhảy**. Chưa có nút chạy riêng trên điện thoại.

Cuộn chuột lên trong vùng nhà hát để tiến gần avatar; khi đủ gần sẽ chuyển sang góc nhìn thứ nhất và ẩn avatar của bạn. Cuộn lùi để trở lại góc thứ ba. Đầu chỉ đi theo hướng kéo chuột ở góc thứ nhất; khi quay lại góc thứ ba, đầu giữ hướng vừa nhìn. Trên thiết bị không có con lăn, dùng nút Đổi góc nhìn. Ở góc thứ nhất, WASD đi theo hướng camera: W tiến về phía đang nhìn, S lùi, A/D sang ngang. Ở góc thứ ba, WASD đi theo hướng thân và camera vẫn xoay tự do. Ghế và giới hạn phòng cản chuyển động. Bạn không tự đi lên sân khấu: hệ thống đưa bạn lên khi đến lượt hát. Khi mở bảng hoặc nhập liệu, phím di chuyển bị tạm ngưng.

Trong **Phòng hát**, **Đổi góc nhìn** chuyển lần lượt giữa góc nhìn avatar, góc nhìn thứ nhất và toàn cảnh. Nhấn Escape hoặc × để đóng bảng. **Toàn màn hình** xuất hiện nếu trình duyệt hỗ trợ.

## 5. Ngồi và đứng dậy

Khi vào phòng, bạn được xếp vào ghế trống nếu còn ghế. Bảng **Phòng hát** có nút **Đứng dậy** khi đang ngồi; khi đang đứng, nút đổi thành **Ngồi ghế trống** và chọn ghế trống gần nhất. Phím di chuyển cũng có thể yêu cầu đứng dậy.

Mỗi ghế chỉ dành cho một người. Nhà hát có 20 ghế; khi hết ghế, người vào sau đứng trong phòng. Người đang hát không đổi ghế cho đến khi kết thúc lượt.

## 6. Đăng ký bài hát

1. Mở **Chọn bài**.
2. Dán link một video YouTube vào **Liên kết YouTube**.
3. Nhập tên bài nếu muốn. Tên do bạn nhập, ứng dụng chưa tự lấy tiêu đề từ YouTube.
4. Bấm **Đăng ký lượt hát**.
5. Xem danh sách lượt trong cùng bảng. Khi sân khấu trống, bài đầu tiên bắt đầu; những bài sau vào hàng chờ.

Ứng dụng nhận link YouTube video thông thường, youtu.be và một số dạng shorts/live/embed có mã video hợp lệ. Link danh sách phát riêng chưa được hỗ trợ. Cần chọn video cho phép nhúng; việc link được chấp nhận chưa đảm bảo YouTube cho phép phát video đó.

Khi đến lượt, avatar được đưa lên sân khấu. Màn hình nhỏ dành riêng cho người hát được nâng cao trên chân đỡ để dễ theo dõi lời. Sau khi video kết thúc, ứng dụng yêu cầu chuyển lượt. Bạn cũng có thể mở **Phòng hát → Kết thúc lượt** để chuyển sang bài tiếp theo. Nếu YouTube từ chối video, người hát cần kết thúc lượt và đăng ký link khác.

## 7. Micro và âm thanh

**Bật mic** chỉ khả dụng với người đang hát. Mở **Phòng hát**, bấm **Bật mic** và tự cấp quyền micro khi trình duyệt hỏi. Bấm **Tắt mic** để ngừng gửi giọng hát. Dùng tai nghe để tránh âm thanh loa bị thu lại vào mic.

Nếu chưa nghe thấy video hoặc người hát, bấm **Bật âm thanh**. Trình duyệt có thể yêu cầu thao tác này vì chặn tự phát âm thanh. Nhạc YouTube được phát riêng ở từng trình duyệt và có đồng bộ định kỳ; giọng hát đi qua WebRTC. Không nên coi đây là hệ thống biểu diễn nhạc đồng bộ chính xác theo mili giây.

Micro cần HTTPS khi truy cập từ xa. HTTP trên localhost có thể dùng mic, nhưng HTTP qua địa chỉ IP LAN thường không đáp ứng điều kiện đó. Một số mạng cần máy chủ TURN do người triển khai cấu hình.

## 8. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| Không mở được localhost | Kiểm tra cửa sổ `npm.cmd start` còn chạy và dùng đúng cổng |
| Cổng đang được sử dụng | Dừng phiên máy chủ cũ hoặc chọn PORT khác theo tài liệu phát triển |
| Đang kết nối lại | Chờ máy chủ hoạt động; nếu vừa cập nhật mã, tải lại bằng Ctrl+F5 |
| Tên phòng không hợp lệ | Dùng 1–48 ký tự Latin, số, `_`, `-` |
| Không di chuyển được | Đóng bảng, bấm vùng 3D, đứng dậy và tránh ghế/tường |
| Mannequin chưa hiện hoặc hiện avatar hình khối | Chờ tải; Ctrl+F5 để thử lại. Hình khối là phương án dự phòng khi tải mannequin lỗi |
| Không thấy nhà hát 3D | Kiểm tra hỗ trợ WebGL/tăng tốc đồ họa; thử trình duyệt khác |
| Bật mic bị mờ | Chỉ người đang đến lượt hát được bật mic |
| Mic không mở | Kiểm tra quyền micro, thiết bị âm thanh và HTTPS/localhost |
| Không nghe thấy | Bấm Bật âm thanh, kiểm tra âm lượng và kết nối mạng |
| Video YouTube báo lỗi | Chọn video cho phép nhúng; người hát kết thúc lượt lỗi |
| Khởi động lại làm mất lượt hát | Hiện trạng thái chỉ nằm trong RAM; cần đăng ký lại |

Tải lại trang tạo kết nối và danh tính mới; bài chờ thuộc kết nối cũ sẽ bị bỏ khi kết nối cũ đóng. Hiện chưa có chức năng khôi phục phiên hoặc lưu lịch sử.
