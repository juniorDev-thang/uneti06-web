"""Tạo báo cáo tiếng Việt 3 trang A4 từ kết quả đã lưu."""
from pathlib import Path
import json, pandas as pd, numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
R=Path(__file__).resolve().parents[1]
F=R/'reports/figures';F.mkdir(parents=True,exist_ok=True)
OUT=R/'reports/UNETI06_REPORT_FINAL.pdf';OUT.parent.mkdir(exist_ok=True)
font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';bold='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
if not Path(font).exists():
    for a,b in [('C:/Windows/Fonts/arial.ttf','C:/Windows/Fonts/arialbd.ttf'),
                ('C:/Windows/Fonts/tahoma.ttf','C:/Windows/Fonts/tahomabd.ttf')]:
        if Path(a).exists() and Path(b).exists():font,bold=a,b;break
if not Path(font).exists():
    raise FileNotFoundError('Please install a Unicode Vietnamese-capable TTF and update font/bold paths')
pdfmetrics.registerFont(TTFont('DV',font));pdfmetrics.registerFont(TTFont('DVB',bold))
W,H=A4;L=38;RIGHT=W-38
INK='#13283D';TEAL='#087C85';BLUE='#3978B9';MUTED='#637689';LINE='#DFE7EE';LIGHT='#F2F7F9';ORANGE='#DF8555';WHITE='#FFFFFF'
def txt(c,s,x,y,size=9,color=INK,bold=False):
    c.setFillColor(HexColor(color));c.setFont('DVB' if bold else 'DV',size);c.drawString(x,y,str(s))
def right(c,s,x,y,size=9,color=INK,bold=False):
    c.setFillColor(HexColor(color));c.setFont('DVB' if bold else 'DV',size);c.drawRightString(x,y,str(s))
def center(c,s,x,y,size=9,color=INK,bold=False):
    c.setFillColor(HexColor(color));c.setFont('DVB' if bold else 'DV',size);c.drawCentredString(x,y,str(s))
def rule(c,x1,y,x2,color=LINE):
    c.setStrokeColor(HexColor(color));c.setLineWidth(.8);c.line(x1,y,x2,y)
def rect(c,x,y,w,h,fill=WHITE,stroke=LINE,r=8):
    c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(stroke));c.roundRect(x,y,w,h,r,fill=1,stroke=1)
def wrap(c,s,x,y,width,size=8,leading=13,color=INK,bold=False):
    cur=''; fontname='DVB' if bold else 'DV'
    for w in str(s).split():
        next_=(cur+' '+w).strip()
        if cur and pdfmetrics.stringWidth(next_,fontname,size)>width:
            txt(c,cur,x,y,size,color,bold); y-=leading; cur=w
        else:cur=next_
    if cur:txt(c,cur,x,y,size,color,bold);y-=leading
    return y
def sec(c,num,label,y):
    txt(c,num,L,y,8,TEAL,True);txt(c,label,L+24,y,10,INK,True);rule(c,L,y-8,RIGHT)
def header(c,n,topic):
    c.setFillColor(HexColor(INK));c.rect(0,H-9,W,9,fill=1,stroke=0)
    txt(c,'Đội UNETI06  /  OLYMPIC TRÍ TUỆ NHÂN TẠO 2026',L,H-33,8.5,TEAL,True)
    right(c,f'VÒNG 2   ·   {topic}',RIGHT,H-33,7.2,MUTED)
    rule(c,L,H-43,RIGHT)
def footer(c,n):
    rule(c,L,45,RIGHT)
    txt(c,'Nguồn: bộ Train 1.200.000 chuyến',L,30,7,MUTED)
    right(c,f'Trang {n}/3',RIGHT,30,7,TEAL,True)

def plot():
    e=json.loads((R/'results/eda_summary.json').read_text(encoding='utf8'))
    v=json.loads((R/'results/validation_metrics.json').read_text(encoding='utf8'))
    fi=pd.read_csv(R/'results/feature_importance.csv').head(10)
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9.0,'axes.titlesize':10.3,'axes.titleweight':'bold','axes.labelsize':8.6,'axes.spines.top':False,'axes.spines.right':False,'axes.edgecolor':'#c5d1dc','xtick.color':MUTED,'ytick.color':MUTED,'axes.labelcolor':INK,'figure.facecolor':'white'})
    def save(fig,n): fig.savefig(F/n,dpi=165,bbox_inches='tight',facecolor='white');plt.close(fig)
    fig,ax=plt.subplots(figsize=(4.8,3.0));ax.bar(e['hist_min'],np.array(e['hist_count'])/1000,width=.94,color=BLUE);ax.axvline(e['duration_seconds']['median']/60,color=TEAL,linewidth=2,linestyle='--');ax.set(xlabel='Thời gian (phút)',ylabel='Nghìn chuyến',title='01 · Phân phối thời gian');ax.set_xlim(0,61);ax.grid(axis='y',alpha=.13);fig.tight_layout();save(fig,'eda1.png')
    fig,ax=plt.subplots(figsize=(4.8,3.0));ax.bar(['≤0,5','0,5–1','1–2','2–3','3–5','5–8','8–12','12–20','>20'],np.array(e['distance']['counts'])/1000,color=TEAL);ax.set(xlabel='Khoảng cách ước tính (km)',ylabel='Nghìn chuyến',title='02 · Phân bố quãng đường');ax.tick_params(axis='x',labelrotation=32);ax.grid(axis='y',alpha=.13);fig.tight_layout();save(fig,'eda2.png')
    fig,ax=plt.subplots(figsize=(9.2,2.45));ax.plot(e['hourly']['hours'],e['hourly']['median_minutes'],color=BLUE,lw=2.5,marker='o',markersize=3);ax.set(xlabel='Giờ đón khách',ylabel='Trung vị (phút)',title='03 · Thời gian di chuyển theo giờ');ax.set_xticks(range(0,24,2));ax.grid(axis='y',alpha=.13);fig.tight_layout();save(fig,'eda3.png')
    fig,ax=plt.subplots(figsize=(9.3,3.1));top=fi.iloc[::-1];ax.barh(top['feature'],top['gain']*100,color=TEAL);ax.set(xlabel='Độ quan trọng theo gain (%)',title='10 đặc trưng đóng góp lớn nhất – LightGBM');ax.grid(axis='x',alpha=.13);fig.tight_layout();save(fig,'importance.png')
    return e,v,fi


def make():
 e,v,fi=plot()
 team_path=R/'src/team_info.json'
 team=json.loads(team_path.read_text(encoding='utf8'))
 names=[x['name'] for x in team['members']]
 c=canvas.Canvas(str(OUT),pagesize=A4,pageCompression=1)
 c.setTitle('UNETI06 - Báo cáo dự đoán thời gian taxi New York')
 c.setAuthor('Đội UNETI06')
 def panel(x,y,w,h):rect(c,x,y,w,h,LIGHT,LINE,8)
 # TRANG 1
 header(c,1,'KHÁM PHÁ DỮ LIỆU')
 txt(c,'KHÁM PHÁ DỮ LIỆU',L,771,18,INK,True)
 txt(c,'Nguyễn Anh Vũ  ·  Trần Đức Thắng  ·  Đào Mai Nguyên',L,748,8.4,MUTED)
 kw=(W-2*L-27)/4
 for i,(t,val) in enumerate([('TRAIN','1.200.000'),('TEST','3.000'),('ĐẦU VÀO','12 trường'),('TRUNG VỊ','665 giây')]):
  x=L+i*(kw+9);panel(x,654,kw,68);txt(c,t,x+10,700,7,MUTED,True);txt(c,val,x+10,674,11 if len(val)>9 else 13,INK,True)
 sec(c,'01','KHÁM PHÁ DỮ LIỆU',637)
 pw=(W-2*L-12)/2
 panel(L,438,pw,184);panel(L+pw+12,438,pw,184)
 c.drawImage(str(F/'eda1.png'),L+7,444,width=pw-14,height=169)
 c.drawImage(str(F/'eda2.png'),L+pw+19,444,width=pw-14,height=169)
 panel(L,272,W-2*L,157)
 c.drawImage(str(F/'eda3.png'),L+12,278,width=W-2*L-24,height=144)
 sec(c,'02','CHẤT LƯỢNG DỮ LIỆU',254)
 panel(L,204,W-2*L,39)
 txt(c,'1.200.000 dòng × 14 cột · 12 đầu vào + mã chuyến · 0 giá trị thiếu.',L+10,227,8.1,INK)
 txt(c,'Nhãn 60–7.191 giây · 29.045 dòng trùng bộ đặc trưng (2,4%).',L+10,212,8.1,INK)
 sec(c,'03','NHẬN XÉT',186)
 y=167
 msgs=[
  '53,2% chuyến dài không quá 2 km; nhóm chuyến ngắn có sai số cao nên cần chú ý khi đánh giá.',
  'Lúc 6 giờ: 7,9 phút; lúc 14 giờ: 12,1 phút. Giờ đón ảnh hưởng rõ đến thời gian di chuyển.',
  'P90 1.626 giây gấp 2,45 lần trung vị 665 giây; dùng log1p để giảm tác động phân phối lệch.'
 ]
 for i,m in enumerate(msgs):
  txt(c,str(i+1).zfill(2),L,y,8,TEAL,True)
  y=wrap(c,m,L+23,y,W-2*L-25,7.65,11.8)-5
 footer(c,1);c.showPage()
 # TRANG 2
 header(c,2,'HUẤN LUYỆN VÀ ĐÁNH GIÁ')
 txt(c,'HUẤN LUYỆN VÀ ĐÁNH GIÁ',L,764,18,INK,True)
 txt(c,'Thời gian chuyến đi (giây) · log1p · RMSLE',L,742,8.5,MUTED)
 sec(c,'04','CÁC BƯỚC THỰC HIỆN',714)
 labs=['Dữ liệu','Tiền xử lý','Đặc trưng','Huấn luyện','Giữ riêng','Huấn luyện lại']
 gap=6;ww=(W-2*L-5*gap)/6
 for i,lab in enumerate(labs):
  x=L+i*(ww+gap);panel(x,651,ww,42);center(c,lab,x+ww/2,668,6.8,INK,True)
 txt(c,'Tập giữ riêng: 180.000 chuyến · Tập kiểm định: 102.000 chuyến · Hạt ngẫu nhiên 42.',L,631,8,INK)
 sec(c,'05','TIỀN XỬ LÝ VÀ ĐẶC TRƯNG',606)
 panel(L,508,W-2*L,87)
 items=[
  'Không có dữ liệu thiếu; mã chuyến không được dùng làm đầu vào mô hình.',
  '41 đặc trưng gồm vị trí, khoảng cách, lưới tọa độ và khoảng cách đến các mốc.',
  'Dùng chung cách tạo đặc trưng khi huấn luyện và dự đoán; khoảng cách gốc giữ riêng.',
  'Thử bỏ từng nhóm: RMSLE giảm từ 0.34378 xuống 0.34123 khi thêm lưới xoay và mốc.'
 ]
 y=577
 for textline in items:
  y=wrap(c,'• '+textline,L+11,y,W-2*L-24,7.5,12)-5
 sec(c,'06','SO SÁNH TRÊN TẬP KIỂM ĐỊNH 102.000 CHUYẾN',489)
 panel(L,297,W-2*L,178)
 c.setFillColor(HexColor('#deedf0'));c.roundRect(L+1,445,W-2*L-2,29,6,fill=1,stroke=0)
 txt(c,'Mô hình',L+12,455,8,INK,True);right(c,'RMSLE',RIGHT-12,455,8,INK,True)
 rows=[('Mô hình cơ sở',v['baseline_devval']),('Ridge',v['models']['ridge']),('LightGBM (41 đặc trưng)',v['models']['lightgbm']),('XGBoost',v['models']['xgboost']),('Kết hợp LightGBM và XGBoost',v['models']['blend'])]
 for i,(label,score) in enumerate(rows):
  y=426-i*27
  if i==2:c.setFillColor(HexColor('#e5f5f4'));c.rect(L+1,y-9,W-2*L-2,25,stroke=0,fill=1)
  txt(c,label,L+12,y,8.1,TEAL if i==2 else INK,i==2)
  right(c,f'{score:.6f}',RIGHT-12,y,8.3,TEAL if i==2 else INK,i==2)
 txt(c,'Tập giữ riêng 180.000 chuyến: RMSLE 0.336696',L+7,278,9,TEAL,True)
 sec(c,'07','MỨC ĐỘ QUAN TRỌNG CỦA ĐẶC TRƯNG',258)
 panel(L,65,W-2*L,179)
 c.drawImage(str(F/'importance.png'),L+12,72,width=W-2*L-24,height=166)
 footer(c,2);c.showPage()
 # TRANG 3
 header(c,3,'KẾT QUẢ VÀ HẠN CHẾ')
 txt(c,'KẾT QUẢ VÀ HẠN CHẾ',L,765,18,INK,True)
 panel(L,663,W-2*L,72)
 txt(c,'LightGBM (41 đặc trưng)',L+16,703,16,TEAL,True)
 right(c,'RMSLE tập giữ riêng',RIGHT-14,708,8,MUTED)
 right(c,'0.336696',RIGHT-14,681,20,INK,True)
 sec(c,'08','VÌ SAO CHỌN LIGHTGBM',643)
 reasons=[
 'RMSLE 0.336259 thấp hơn mô hình cơ sở 53,7% và thấp hơn Ridge 23,0%.',
 'So với XGBoost 0.337404, LightGBM 0.336259 tốt hơn khoảng 0,3%.',
 'Kết hợp hai mô hình đạt 0.336061, chỉ tốt hơn 0.0002 nên chọn một mô hình để đơn giản hóa.',
 'Thêm lưới xoay/mốc giảm RMSLE 0.34378 → 0.34123; thêm nhóm thời gian thành 0.34124 nên không giữ. Ba hạt ngẫu nhiên có độ lệch chuẩn 0.00018.'
 ]
 y=622
 for i,s0 in enumerate(reasons):
  txt(c,str(i+1).zfill(2),L,y,8.3,TEAL,True)
  y=wrap(c,s0,L+26,y,W-2*L-29,8,13)-12
 panel(L,440,W-2*L,43)
 txt(c,'Theo khoảng cách: chuyến ≤1 km có RMSLE 0.476; chuyến >20 km có RMSLE 0.176.',L+11,461,8,INK)
 txt(c,'Sai số lớn hơn ở các chuyến rất ngắn, cần thận trọng khi sử dụng kết quả.',L+11,447,8,MUTED)
 sec(c,'09','HẠN CHẾ',425)
 limits=['Tọa độ đã làm tròn đến 0,01°; khoảng cách chỉ là ước tính đường chim bay.',
         'Không có thông tin thời tiết, giao thông trực tiếp hoặc ngày khởi hành cụ thể.',
         'RMSLE tập giữ riêng là kết quả nội bộ; điểm Test do Ban Tổ chức chấm.']
 y=402
 for x in limits:
  y=wrap(c,'• '+x,L+5,y,W-2*L-10,8,13)-8
 sec(c,'10','PHÂN CÔNG THÀNH VIÊN',316)
 rect(c,L,181,W-2*L,122)
 for i,m in enumerate(team['members']):
  y=278-i*37
  txt(c,m['name'],L+13,y,8.6,INK,True)
  txt(c,m['role'],L+13,y-15,7.6,MUTED)
 sec(c,'11','KẾT LUẬN',160)
 wrap(c,'Mô hình dự đoán thời gian taxi đạt RMSLE 0.336696 trên 180.000 chuyến giữ riêng. Kết quả 3.000 chuyến UNETI06 đã được xuất theo yêu cầu của cuộc thi.',L,139,W-2*L,8.3,15)
 footer(c,3);c.showPage();c.save()
 print('REPORT_READY',OUT,OUT.stat().st_size)
 return OUT
if __name__=='__main__':make()
