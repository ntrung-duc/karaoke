# Nguồn mannequin và chuyển động

Tác giả: **Kevin Iglesias**. Gói: **Human Basic Motions FREE 2.4.2**.

- [Unity Asset Store](https://assetstore.unity.com/packages/3d/animations/human-basic-motions-free-154271)
- [Bản tải chính thức đã dùng trên itch.io](https://kevdev.itch.io/basic-motions-free): Godot/Unreal ZIP, tải ngày 14/11/2026.
- [Trang tác giả và giấy phép](https://www.keviniglesias.com/#license)
- [Danh sách animation](https://www.keviniglesias.com/documentation/Human%20Basic%20Motions%20FREE.pdf)

## Các file dùng trong ứng dụng

| File | Vai trò |
| --- | --- |
| `mannequin.glb` | Avatar mặc định: mô hình nam `HumanM_Model.fbx`, bộ xương và 20 clip chính thức; thêm một tư thế ngồi do dự án tạo |
| `human-motions.json` | 20 clip lấy mẫu theo joint của avatar hình khối dự phòng |

GLB khoảng 3,6 MiB, tự chứa geometry, skeleton, animation và ảnh palette nguồn. Lớp runtime dùng vật liệu matte sáng, có sắc độ theo người dùng để mannequin dễ thấy trong nhà hát tối. Mesh và chuyển động gốc xuất phát từ gói chính thức, không phải mô hình người tự dựng.

20 clip gồm idle, đi tám hướng, chạy tám hướng, bắt đầu nhảy, trên không và tiếp đất. Tư thế ngồi không thuộc gói miễn phí; dự án tạo thêm trên bộ xương. Script xử lý tỷ lệ cm → đơn vị nhà hát và hướng +Z → -Z; bổ sung hiệu chỉnh sàn cho clip nhảy in-place.

## Tạo lại

Giải nén gói chính thức vào `tools/source-assets/human-basic-motions-free`, rồi chạy:

```powershell
npm.cmd run prepare-mannequin
npm.cmd run prepare-motions
```

Danh sách clip chung: `tools/motion-sources.mjs`. Script xuất mannequin: `tools/prepare-mannequin.mjs`. Script dữ liệu dự phòng: `tools/prepare-motions.mjs`.

Nguồn tải về không được đưa vào Git hoặc phục vụ qua HTTP. Ứng dụng chạy từ asset đã xuất sẵn và không cần Unity/Blender khi triển khai.

## Điều kiện sử dụng

Giữ asset trong sản phẩm/dự án tích hợp; không tách gói này thành thư viện mô hình/animation để bán hoặc phân phối lại độc lập. Tham khảo điều khoản gốc của tác giả tại các liên kết trên khi thay đổi phạm vi sử dụng. Thông tin tác giả được giữ trong metadata GLB và tài liệu này. Giấy phép dependency Three.js/ws là riêng biệt với giấy phép asset.

## Tùy chỉnh đầu và bộ mặt

Theo yêu cầu người dùng, bản hiện tại giữ thân/rig mannequin và thay phần đầu bằng ellipsoid bo tròn dựng trong `public/avatar-head.js`. GLB đã bỏ mesh đầu cũ; vùng cổ giữ theo bone cổ để không bị kéo khi đầu quay 360°. Đây là tùy chỉnh của dự án trên thân mannequin, không phải hình dạng đầu nguyên bản của tác giả.

`face-atlas.png` là ảnh 9 mặt do người dùng cung cấp trong cuộc trò chuyện. Dự án giữ nguyên ảnh, lấy vùng nét mặt khi chạy và vẽ trực tiếp vào texture đầu. Bộ này không nằm trong gói Human Basic Motions FREE. Các vùng cắt và nhãn được khai báo trong `public/avatar-settings.js`.
