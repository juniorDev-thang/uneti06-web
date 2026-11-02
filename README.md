# UNETI06 – Dự đoán thời gian di chuyển taxi

Ứng dụng FastAPI sử dụng mô hình LightGBM (41 đặc trưng) đã huấn luyện.

## Chạy trên Windows (Python 3.12)

Mở PowerShell tại thư mục chứa `app.py` rồi chạy:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8501
```

Mở http://127.0.0.1:8501. Giữ cửa sổ PowerShell đang chạy khi sử dụng ứng dụng.

## Các chức năng

- **Dự đoán chuyến đi:** nhập 12 trường dữ liệu, chọn **Ví dụ 1 / Ví dụ 2**, nhấn **Dự đoán thời gian**.
- **Bản đồ mật độ:** chọn nút **Điểm đón** hoặc **Điểm đến**, nhấp vào bản đồ để cập nhật tọa độ và khoảng cách ước tính.
- **Cảnh 3D dữ liệu:** địa hình nổi vẽ bằng Canvas 2D, không dùng WebGL và không cần ảnh bản đồ từ Internet. Nhấp để chọn điểm, kéo để xoay, lăn chuột để phóng to; có nút **Xoay tự động**.
- **Dữ liệu huấn luyện** và **Hiệu năng mô hình:** xem biểu đồ, thống kê và RMSLE từ kết quả đã lưu.

Đường nối chỉ minh họa hướng đi, không phải tuyến đường giao thông thực tế. Nếu thay đổi đầu vào, nhấn **Dự đoán thời gian** lần nữa để tính kết quả mới.
