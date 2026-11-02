# Đưa ứng dụng UNETI06 lên Internet

1. Giải nén `UNETI06_WEB.zip` và vào thư mục `UNETI06_WEB` (có `app.py`, `Dockerfile`, `models`, `static`, `src`, `results`).
2. Trên GitHub, tạo kho mã mới; đưa **toàn bộ nội dung bên trong** thư mục này lên thư mục gốc của kho mã (không đẩy thư mục `.venv` hoặc `__pycache__`).
3. Mở Render, chọn **New > Web Service**, kết nối kho GitHub, chọn môi trường **Docker**.
4. Tệp `Dockerfile` đã sử dụng Python 3.12 và cổng `${PORT}`; bắt đầu triển khai.
5. Sau khi Render cấp địa chỉ web, mở cả ba màn hình, chạy hai ví dụ và kiểm tra biểu đồ, bản đồ 2D/3D.
6. Mở lại địa chỉ bằng cửa sổ ẩn danh, sau đó mới dán vào biểu mẫu nộp bài.

Bản đồ mật độ và cảnh địa hình 3D hoạt động bằng dữ liệu đã lưu trong gói, không cần tải ảnh nền từ máy chủ ngoài. Cảnh 3D dùng Canvas 2D, không yêu cầu WebGL. Không có bản đồ phố 3D trong phiên bản này.
