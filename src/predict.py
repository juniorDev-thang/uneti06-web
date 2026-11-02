"""Model inference from LightGBM artifact; same pure features as training.
Usage: python -m src.predict --test data/UNETI06_TEST_3000.csv --output results/submission_UNETI06.csv
"""
import argparse,json
from pathlib import Path
import numpy as np
import pandas as pd
import lightgbm as lgb
from .features import build_features, REQUIRED
ROOT=Path(__file__).resolve().parents[1]
INPUT_COLUMNS=REQUIRED
class TripPredictor:
    def __init__(self,root=ROOT):
        self.root=Path(root)
        self.meta=json.loads((self.root/'models/model_metadata.json').read_text(encoding='utf-8'))
        if float(self.meta['w_xgb']) != 0:
            raise RuntimeError('This release requires LightGBM-only metadata (w_xgb=0)')
        self.booster=lgb.Booster(model_file=str(self.root/'models/lgbm_final.txt'))
        if self.booster.num_feature()!=len(self.meta['features']):
            raise RuntimeError('Model feature count differs from metadata')
    def predict(self,rows:pd.DataFrame):
        missing=set(REQUIRED)-set(rows.columns)
        if missing:raise ValueError('Thiếu thông tin: '+', '.join(sorted(missing)))
        f=build_features(rows)[self.meta['features']]
        if not np.isfinite(f.to_numpy()).all():raise ValueError('Đầu vào có NaN hoặc giá trị vô hạn')
        pred_log=self.booster.predict(f,num_threads=2)
        if self.meta.get('clip_log'):pred_log=np.clip(pred_log,*self.meta['clip_log'])
        result=np.expm1(pred_log)
        if not np.isfinite(result).all() or not (result>0).all():raise ValueError('Giá trị suy diễn không hợp lệ')
        return result

def predict_seconds(rows):return TripPredictor().predict(rows)

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--test',default=str(ROOT/'data/UNETI06_TEST_3000.csv'))
    p.add_argument('--output',default=str(ROOT/'results/submission_UNETI06.csv'))
    args=p.parse_args()
    data=pd.read_csv(args.test)
    pr=TripPredictor().predict(data)
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    pd.DataFrame({'trip_id':data.trip_id,'trip_duration':np.round(pr,3)}).to_csv(out,index=False)
    from .validate_submission import validate
    validate(args.test,out)
    print('PASS:',out,len(pr),'rows')
