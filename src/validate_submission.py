"""Strict UNETI06 CSV format and original test ID/order validation."""
import argparse,hashlib
from pathlib import Path
import numpy as np
import pandas as pd

def validate(test_path,submission_path,max_bytes=5_000_000):
    test_path,submission_path=Path(test_path),Path(submission_path)
    raw=submission_path.read_bytes()
    if len(raw)>max_bytes:raise ValueError('CSV exceeds 5 MB')
    if raw.startswith(b'\xef\xbb\xbf'):raise ValueError('UTF-8 BOM is not accepted')
    if raw.splitlines()[0].decode('utf8')!='trip_id,trip_duration':raise ValueError('Wrong header/order')
    te=pd.read_csv(test_path,dtype={'trip_id':'string'})
    sub=pd.read_csv(submission_path,dtype={'trip_id':'string'})
    if list(sub.columns)!=['trip_id','trip_duration']:raise ValueError('Wrong columns')
    if len(sub)!=len(te) or len(sub)!=3000:raise ValueError('Wrong row count')
    if te.trip_id.duplicated().any() or sub.trip_id.duplicated().any():raise ValueError('Duplicate IDs')
    if not te.trip_id.equals(sub.trip_id):raise ValueError('Test IDs or row order changed')
    if sub.isna().any().any():raise ValueError('Missing values')
    if not pd.api.types.is_numeric_dtype(sub.trip_duration):raise ValueError('trip_duration is not numeric')
    y=sub.trip_duration.to_numpy(dtype='float64')
    if not np.isfinite(y).all() or not (y>0).all():raise ValueError('Invalid predictions')
    result={'status':'PASS','rows':int(len(sub)),'size_bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}
    print(result)
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('--test',default='data/UNETI06_TEST_3000.csv')
    p.add_argument('--submission',default='results/submission_UNETI06.csv')
    a=p.parse_args();validate(a.test,a.submission)
