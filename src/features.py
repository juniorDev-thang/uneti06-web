"""Pipeline đặc trưng DUY NHẤT, dùng chung cho train / predict / app.

Stateless (không học gì từ nhãn) => không rò rỉ nhãn, áp dụng y hệt cho Train, Validation, Test và đầu vào mới.
Không dùng trip_id hay bất kỳ thông tin nào chỉ có sau khi chuyến đi kết thúc.
"""
import numpy as np
import pandas as pd

KX, KY = 84.4, 111.2          # km / độ kinh, vĩ tại New York
TH = np.deg2rad(29.0)         # góc xoay lưới Manhattan
POI = {"jfk": (-73.7781, 40.6413), "lga": (-73.8740, 40.7769),
       "midtown": (-73.9855, 40.7580), "downtown": (-74.0110, 40.7075)}

RAW = ["vendor_id", "passenger_count", "pickup_month", "pickup_dayofweek", "pickup_hour",
       "pickup_minute_bucket", "pickup_lon_approx", "pickup_lat_approx",
       "dropoff_lon_approx", "dropoff_lat_approx", "straight_line_km_approx"]
REQUIRED = RAW + ["store_and_fwd_flag"]

G_RAW = RAW + ["store_fwd"]
G_DIST = ["hav_km", "manhattan_km", "dx_km", "dy_km", "hav_minus_km", "log_km", "log_hav", "bear_sin", "bear_cos"]
G_GRID = (["p_rx", "p_ry", "d_rx", "d_ry", "rx_diff", "ry_diff", "rot_manhattan"]
          + [f"{p}_to_{n}" for n in POI for p in ("pickup", "dropoff")]
          + ["pickup_airport", "dropoff_airport", "pickup_cell", "dropoff_cell", "same_cell"])
G_TIME = ["minute_of_day", "hour_of_week", "is_weekend", "is_rush", "hour_sin", "hour_cos",
          "dow_sin", "dow_cos", "km_x_rush", "km_x_weekend"]


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    miss = [c for c in REQUIRED if c not in df.columns]
    if miss:
        raise ValueError(f"Thiếu cột đầu vào: {miss}")
    f = pd.DataFrame(index=df.index)
    for c in RAW:
        f[c] = df[c].astype("float64")
    f["store_fwd"] = (df["store_and_fwd_flag"].astype(str).str.upper() == "Y").astype("float64")

    plon, plat = f["pickup_lon_approx"], f["pickup_lat_approx"]
    dlon, dlat = f["dropoff_lon_approx"], f["dropoff_lat_approx"]
    km = f["straight_line_km_approx"]
    dx, dy = (dlon - plon) * KX, (dlat - plat) * KY

    # --- khoảng cách / hướng
    a, b = np.radians(plat), np.radians(dlat)
    h = np.sin((b - a) / 2) ** 2 + np.cos(a) * np.cos(b) * np.sin(np.radians(dlon - plon) / 2) ** 2
    hav = 2 * 6371.0 * np.arcsin(np.sqrt(h))
    ang = np.arctan2(dy, dx)
    f["hav_km"], f["manhattan_km"], f["dx_km"], f["dy_km"] = hav, dx.abs() + dy.abs(), dx, dy
    f["hav_minus_km"] = hav - km          # phần thông tin dưới mức làm tròn của tọa độ
    f["log_km"], f["log_hav"] = np.log1p(km), np.log1p(hav)
    f["bear_sin"], f["bear_cos"] = np.sin(ang), np.cos(ang)

    # --- lưới Manhattan xoay 29°, mốc giao thông, ô lưới
    for p, (lo, la) in {"p": (plon, plat), "d": (dlon, dlat)}.items():
        x, y = (lo + 73.98) * KX, (la - 40.75) * KY
        f[f"{p}_rx"] = x * np.cos(TH) - y * np.sin(TH)
        f[f"{p}_ry"] = x * np.sin(TH) + y * np.cos(TH)
    f["rx_diff"], f["ry_diff"] = f["d_rx"] - f["p_rx"], f["d_ry"] - f["p_ry"]
    f["rot_manhattan"] = f["rx_diff"].abs() + f["ry_diff"].abs()
    for n, (lo, la) in POI.items():
        f[f"pickup_to_{n}"] = np.hypot((plon - lo) * KX, (plat - la) * KY)
        f[f"dropoff_to_{n}"] = np.hypot((dlon - lo) * KX, (dlat - la) * KY)
    f["pickup_airport"] = ((f["pickup_to_jfk"] < 3.5) | (f["pickup_to_lga"] < 2.5)).astype("float64")
    f["dropoff_airport"] = ((f["dropoff_to_jfk"] < 3.5) | (f["dropoff_to_lga"] < 2.5)).astype("float64")
    f["pickup_cell"] = np.rint((plon + 75) * 100) * 1000 + np.rint((plat - 40) * 100)
    f["dropoff_cell"] = np.rint((dlon + 75) * 100) * 1000 + np.rint((dlat - 40) * 100)
    f["same_cell"] = (f["pickup_cell"] == f["dropoff_cell"]).astype("float64")

    # --- thời gian
    hr, dow = f["pickup_hour"], f["pickup_dayofweek"]
    wk = (dow >= 5).astype("float64")
    rush = ((~(dow >= 5)) & (((hr >= 7) & (hr <= 10)) | ((hr >= 16) & (hr <= 19)))).astype("float64")
    f["minute_of_day"] = hr * 60 + f["pickup_minute_bucket"]
    f["hour_of_week"] = dow * 24 + hr
    f["is_weekend"], f["is_rush"] = wk, rush
    f["hour_sin"], f["hour_cos"] = np.sin(2 * np.pi * hr / 24), np.cos(2 * np.pi * hr / 24)
    f["dow_sin"], f["dow_cos"] = np.sin(2 * np.pi * dow / 7), np.cos(2 * np.pi * dow / 7)
    f["km_x_rush"], f["km_x_weekend"] = km * rush, km * wk

    return f.astype("float32")


ALL_FEATURES = G_RAW + G_DIST + G_GRID + G_TIME
