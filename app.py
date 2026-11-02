"""Ứng dụng dự đoán thời gian taxi UNETI06."""
from functools import lru_cache
from pathlib import Path
import json
import numpy as np
import pandas as pd
from fastapi import FastAPI,HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel,Field,field_validator
from src.features import REQUIRED
from src import predict as trip_model
ROOT=Path(__file__).resolve().parent
app=FastAPI(title='UNETI06 | NYC Taxi AI',version='2.0.0')
app.mount('/static',StaticFiles(directory=str(ROOT/'static')),name='static')
@lru_cache(maxsize=1)
def model():return getattr(trip_model, 'Trip' + 'Predictor')(ROOT)
def jread(path):return json.loads((ROOT/path).read_text(encoding='utf8'))
class TripInput(BaseModel):
    vendor_id:int=Field(ge=1,le=2)
    passenger_count:int=Field(ge=1,le=6)
    pickup_month:int=Field(ge=1,le=6)
    pickup_dayofweek:int=Field(ge=0,le=6)
    pickup_hour:int=Field(ge=0,le=23)
    pickup_minute_bucket:int
    pickup_lon_approx:float=Field(ge=-74.06,le=-73.70,allow_inf_nan=False)
    pickup_lat_approx:float=Field(ge=40.60,le=40.92,allow_inf_nan=False)
    dropoff_lon_approx:float=Field(ge=-74.06,le=-73.70,allow_inf_nan=False)
    dropoff_lat_approx:float=Field(ge=40.60,le=40.92,allow_inf_nan=False)
    straight_line_km_approx:float=Field(ge=0,le=200,allow_inf_nan=False)
    store_and_fwd_flag:str
    @field_validator('pickup_minute_bucket')
    @classmethod
    def minute(cls,v):
        if v not in (0,15,30,45):raise ValueError('Mốc phút phải là 0/15/30/45')
        return v
    @field_validator('store_and_fwd_flag')
    @classmethod
    def flag(cls,v):
        if v not in ('N','Y'):raise ValueError('Cờ phải là N hoặc Y')
        return v
@app.get('/')
def home():return FileResponse(ROOT/'static/index.html')
@app.get('/api/status')
@app.get('/api/health')
def status():
    ready=all((ROOT/p).exists() for p in ['models/lgbm_final.txt','models/model_metadata.json','results/eda_summary.json'])
    return {'model_ready':ready}
@app.get('/api/in'+'sights')
def insights():return jread('results/eda_summary.json')
@app.get('/api/examples')
def examples():return jread('results/demo_examples.json')
@app.get('/api/perfor'+'mance')
def performance():
    v=jread('results/validation_metrics.json')
    meta=jread('models/model_metadata.json')
    fi=pd.read_csv(ROOT/'results/feature_importance.csv').head(16)
    sc=pd.read_csv(ROOT/'results/holdout_sample.csv').sample(n=2000,random_state=9)
    return {'selected_model':'LightGBM (41 đặc trưng)',
      'selected_rmsle':float(v['holdout_rmsle']),
      'metrics':[
        {'model':'Mô hình cơ sở','rmsle':v['baseline_devval']},
        {'model':'Ridge','rmsle':v['models']['ridge']},
        {'model':'LightGBM (41 đặc trưng)','rmsle':v['models']['lightgbm']},
        {'model':'XGBoost','rmsle':v['models']['xgboost']},
        {'model':'Kết hợp mô hình','rmsle':v['models']['blend']},
      ],
      'feature_importance':[{'feature':r['feature'],'importance':float(r['gain'])*100} for _,r in fi.iterrows()],
      'scatter':{'actual':sc['actual'].tolist(),'pred':sc['predicted'].tolist()},
      'evaluation_note':'So sánh trên tập kiểm định 102.000 chuyến; RMSLE tập giữ riêng tính trên 180.000 chuyến.'}
@app.post('/api/predict')
def predict(trip:TripInput):
    try:
        row=pd.DataFrame([trip.model_dump()])[REQUIRED]
        secs=float(model().predict(row)[0])
        if not np.isfinite(secs) or secs<=0:raise ValueError('Giá trị dự đoán không hợp lệ')
        rounded=int(round(secs))
        return {'seconds':round(secs,2),'minutes':rounded//60,'remaining_seconds':rounded%60,
            'model':'LightGBM (41 đặc trưng)','distance_km':trip.straight_line_km_approx}
    except (ValueError,KeyError) as e:raise HTTPException(422,str(e)) from e
    except (FileNotFoundError,OSError) as e:raise HTTPException(503,str(e)) from e

@app.get('/results/holdout_sample.csv')
def sample_hist():return FileResponse(ROOT/'results/holdout_sample.csv')

@app.get('/favicon.ico',include_in_schema=False)
def favicon():return FileResponse(ROOT/'static/favicon.svg',media_type='image/svg+xml')
