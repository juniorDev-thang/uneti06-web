"use strict";
const places=[
 ['Times Square',-73.99,40.76],['Penn Station',-73.99,40.75],['Grand Central',-73.98,40.75],
 ['Central Park',-73.97,40.78],['Columbia',-73.96,40.81],['Wall Street',-74.01,40.71],
 ['Brooklyn Bridge',-73.99,40.71],['Union Square',-73.99,40.74],['JFK',-73.78,40.64],
 ['LaGuardia',-73.87,40.77],['Williamsburg',-73.96,40.71],['Long Island City',-73.94,40.75]
];
const fields=['vendor_id','passenger_count','pickup_month','pickup_dayofweek','pickup_hour','pickup_minute_bucket','pickup_lon_approx','pickup_lat_approx','dropoff_lon_approx','dropoff_lat_approx','straight_line_km_approx','store_and_fwd_flag'];
const $=id=>document.getElementById(id);
const P=(lon,lat)=>[+lon.toFixed(2),+lat.toFixed(2)];
const rad=x=>x*Math.PI/180;
function kmDist(lon1,lat1,lon2,lat2){const a=Math.sin(rad(lat2-lat1)/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(rad(lon2-lon1)/2)**2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(a)))}
const distanceNow=()=>kmDist(+ $('pickup_lon_approx').value,+$('pickup_lat_approx').value,+$('dropoff_lon_approx').value,+$('dropoff_lat_approx').value);
function updateDistance(){let d=distanceNow();if(Number.isFinite(d))$('straight_line_km_approx').value=(Math.round(d*2)/2).toFixed(1);verifyDistance()}
function verifyDistance(){const d=distanceNow(),q=+ $('straight_line_km_approx').value;const el=$('distanceNotice');el.textContent=Number.isFinite(d)&&Number.isFinite(q)&&Math.abs(d-q)>3?`Khoảng cách nhập lệch hơn 3 km so với ước tính đường chim bay ${d.toFixed(1)} km. Hãy kiểm tra lại.`:'';}
function setCoords(side,lon,lat){const a=P(lon,lat);$(side+'_lon_approx').value=a[0].toFixed(2);$(side+'_lat_approx').value=a[1].toFixed(2);matchPlace(side);updateDistance();plotScene();resetPrediction()}
function matchPlace(side){const lon=+$(side+'_lon_approx').value,lat=+$(side+'_lat_approx').value;let ix=places.findIndex(p=>p[1]===lon&&p[2]===lat);$(side==='pickup'?'pickupPlace':'dropoffPlace').value=ix>=0?String(ix):'manual';}
function fieldSet(row){fields.forEach(k=>{if($(k)&&row[k]!==undefined)$(k).value=row[k]});matchPlace('pickup');matchPlace('dropoff');verifyDistance();plotScene();}
function collect(){let o={};fields.forEach(k=>{let v=$(k).value;o[k]=k==='store_and_fwd_flag'?v:Number(v)});return o}
function selectPlace(id,side){let v=$(id).value;if(v==='manual')return;let p=places[+v];setCoords(side,p[1],p[2]);}
function buildPlaceSelect(id){$(id).innerHTML='<option value="manual">Nhập tọa độ</option>'+places.map((p,i)=>`<option value="${i}">${p[0]}</option>`).join('');}
function makeExample(which){return which===1?{vendor_id:1,passenger_count:1,pickup_month:5,pickup_dayofweek:4,pickup_hour:17,pickup_minute_bucket:0,pickup_lon_approx:-73.99,pickup_lat_approx:40.76,dropoff_lon_approx:-73.78,dropoff_lat_approx:40.64,straight_line_km_approx:0,store_and_fwd_flag:'N'}:{vendor_id:2,passenger_count:2,pickup_month:4,pickup_dayofweek:0,pickup_hour:8,pickup_minute_bucket:0,pickup_lon_approx:-73.99,pickup_lat_approx:40.74,dropoff_lon_approx:-73.99,dropoff_lat_approx:40.76,straight_line_km_approx:0,store_and_fwd_flag:'N'}}
function resetPrediction(){ $('predictionValue').innerHTML='<span class="placeholder">Nhấn “Dự đoán thời gian” để xem kết quả.</span>'; $('predictionMeta').textContent=''; $('predictionRange').textContent=''; }
function useExample(i){fieldSet(makeExample(i));updateDistance();resetPrediction()}
async function predict(ev){if(ev)ev.preventDefault();$('err').textContent='';$('predictBtn').disabled=true;
 try{const res=await fetch('/api/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(collect())});const x=await res.json();if(!res.ok){throw Error(x.detail?typeof x.detail==='string'?x.detail:'Thông tin chuyến đi chưa hợp lệ.':'Yêu cầu chưa thành công');}
 const speed=x.seconds>0?((+ $('straight_line_km_approx').value)*3600/x.seconds).toFixed(1):'—';const sec=Math.round(x.seconds);$('predictionValue').innerHTML=`${Math.floor(sec/60)} <small>phút</small> ${String(sec%60).padStart(2,'0')} <small>giây</small>`;$('predictionMeta').textContent=`${x.seconds.toFixed(2)} giây · Khoảng cách ${x.distance_km.toFixed(1)} km · Tốc độ trung bình ngụ ý ${speed} km/h`;
 const sample=window.holdoutRows||[];$('predictionRange').textContent='';if(sample.length){const d=+$('straight_line_km_approx').value;const subset=sample.filter(r=>Math.abs(r.km-d)<Math.max(1,d*.4)).map(r=>r.actual).sort((a,b)=>a-b);if(subset.length>=30){let lo=subset[Math.floor(.1*(subset.length-1))],hi=subset[Math.floor(.9*(subset.length-1))];$('predictionRange').textContent=`P10–P90 thời lượng lịch sử cùng nhóm khoảng cách: ${Math.round(lo)}–${Math.round(hi)} giây (n=${subset.length}). Đây là phân bố mẫu, không phải khoảng tin cậy của dự đoán.`}}
 }catch(e){$('err').textContent=e.message;}finally{$('predictBtn').disabled=false}}
// Bản đồ 2D dùng để chọn điểm. Cảnh 3D dùng Canvas 2D, không tạo WebGL context.
let density=null,currentMapView='flat',flatReady=false,flatStarted=false,terrain3d=null,spinning=false;
function selectedSide(){return document.querySelector('input[name="mapmode"]:checked')?.value||'pickup'}
function currentPoints(){return {a:[+$('pickup_lon_approx').value,+$('pickup_lat_approx').value],b:[+$('dropoff_lon_approx').value,+$('dropoff_lat_approx').value]};}
function stopSpinning(){spinning=false;if(terrain3d)terrain3d.spin(false);$('mapSpin').textContent='Xoay tự động';}
function makeFlat(){
 if(!density||flatStarted||!window.Plotly)return;
 flatStarted=true;
 const d=density;
 const x=Array.from({length:d.counts[0].length},(_,i)=>+(d.longitude_min+i*.01).toFixed(2));
 const y=Array.from({length:d.counts.length},(_,i)=>+(d.latitude_min+i*.01).toFixed(2));
 const z=d.counts.map(row=>row.map(v=>Math.log1p(v)));
 const {a,b}=currentPoints();
 const tr=[
  {type:'heatmap',x,y,z,colorscale:[[0,'#edf4f5'],[.3,'#b8d6da'],[.65,'#40838f'],[1,'#0c485c']],showscale:false,hovertemplate:'Kinh độ %{x:.2f}<br>Vĩ độ %{y:.2f}<br>Mật độ (log) %{z:.2f}<extra></extra>'},
  {type:'scatter',mode:'markers+text',x:places.map(p=>p[1]),y:places.map(p=>p[2]),text:places.map(p=>p[0]),textposition:'top center',textfont:{size:9,color:'#536b7c'},marker:{size:5,color:'#829daa'},hoverinfo:'text'},
  {type:'scatter',mode:'lines',x:[a[0],b[0]],y:[a[1],b[1]],line:{color:'#177787',dash:'dash',width:3},hoverinfo:'skip'},
  {type:'scatter',mode:'markers+text',x:[a[0],b[0]],y:[a[1],b[1]],text:['Điểm đón','Điểm đến'],textposition:'top right',textfont:{size:12,color:'#19445a'},marker:{size:15,color:['#00a89c','#eb885b'],line:{width:2,color:'#fff'}},hoverinfo:'text'}
 ];
 const layout={paper_bgcolor:'#f1f7f8',plot_bgcolor:'#f1f7f8',margin:{l:57,r:12,t:12,b:36},showlegend:false,
  xaxis:{title:'Kinh độ',range:[d.longitude_min,d.longitude_max],gridcolor:'#d5e5e9',tickfont:{size:10}},
  yaxis:{title:'Vĩ độ',range:[d.latitude_min,d.latitude_max],gridcolor:'#d5e5e9',tickfont:{size:10},scaleanchor:'x',scaleratio:1.32}};
 Plotly.newPlot('flatMap',tr,layout,{responsive:true,displaylogo:false,displayModeBar:false}).then(()=>{
  flatReady=true;
  const node=$('flatMap');
  node.on('plotly_click',info=>{
    const pt=(info.points||[]).find(q=>Number.isFinite(+q.x)&&Number.isFinite(+q.y));
    if(pt)setCoords(selectedSide(),+pt.x,+pt.y);
  });
  updateMapMarkers();
 }).catch(()=>{$('distanceNotice').textContent='Không thể hiển thị biểu đồ 2D. Hãy kiểm tra lại các tệp thư viện cục bộ.';});
}
function updateMapMarkers(){
 if(!flatReady)return;
 const {a,b}=currentPoints();
 Plotly.restyle('flatMap',{x:[[a[0],b[0]],[a[0],b[0]]],y:[[a[1],b[1]],[a[1],b[1]]]},[2,3]).catch(()=>{});
}
function showMap(view){
 currentMapView=view;
 $('flatMap').classList.toggle('hidden',view!=='flat');
 $('terrainMap').classList.toggle('hidden',view!=='scene');
 $('mapFlat').classList.toggle('active',view==='flat');
 $('mapOffline').classList.toggle('active',view==='scene');
 $('mapSpin').disabled=view==='flat';
 if(view==='flat'){
  stopSpinning();makeFlat();
  if(flatReady)requestAnimationFrame(()=>Plotly.Plots.resize($('flatMap')));
 }else{
  if(!terrain3d&&density&&window.UNETI06Terrain3D){
   terrain3d=UNETI06Terrain3D($('terrainCanvas'),$('terrainTooltip'),density.counts,density,places,(lon,lat)=>setCoords(selectedSide(),lon,lat));
  }
  if(!terrain3d){currentMapView='flat';showMap('flat');return;}
  terrain3d.resize();
 }
 updateMapMarkers();
}
function plotScene(){
 if(!density)return;
 const {a,b}=currentPoints();
 $('pickupCoord').textContent=`${a[1].toFixed(2)}, ${a[0].toFixed(2)}`;
 $('dropoffCoord').textContent=`${b[1].toFixed(2)}, ${b[0].toFixed(2)}`;
 updateMapMarkers();
 if(terrain3d)terrain3d.setPoints(a,b);
}
function switchPage(page){document.querySelectorAll('.content[id^="page-"]').forEach(el=>el.classList.toggle('hidden',el.id!=='page-'+page));document.querySelectorAll('.nav button').forEach(el=>el.classList.toggle('active',el.dataset.page===page));if(page==='du-doan')setTimeout(()=>currentMapView==='flat'?Plotly.Plots.resize($('flatMap')):terrain3d?.resize(),50);if(page==='du-lieu')loadStatistics();if(page==='hieu-nang')loadScores();}
let statsLoaded=false,scoreLoaded=false;
const opts={responsive:true,displaylogo:false};const dark='#205575',teal='#0b8585';
function draw(id,data,layout){Plotly.react(id,data,{paper_bgcolor:'#fff',plot_bgcolor:'#fff',margin:{l:55,r:18,t:28,b:48},font:{family:'Segoe UI, Arial',size:12,color:'#526879'},...layout},opts)}
function kpi(el,title,value,sub){el.innerHTML+=`<section class="panel metric"><span>${title}</span><h3>${value}</h3><small>${sub}</small></section>`}
async function loadStatistics(){if(statsLoaded)return;const e=await(await fetch('/api/insights')).json();statsLoaded=true;const el=$('edaKpis');kpi(el,'Số chuyến','1.200.000','Có nhãn');kpi(el,'Trung vị thời gian',e.duration_seconds.median+' giây','11 phút 05 giây');kpi(el,'P90',e.duration_seconds.p90+' giây','90% chuyến không quá mức này');kpi(el,'Giá trị thiếu',e.missing_train,'Bộ Train');
 draw('durationChart',[{type:'bar',x:e.hist_min,y:e.hist_count,marker:{color:dark}}],{xaxis:{title:'Thời gian (phút)'},yaxis:{title:'Số chuyến'}});
 draw('hourChart',[{type:'scatter',mode:'lines+markers',x:e.hourly.hours,y:e.hourly.median_minutes,line:{color:teal,width:3}}],{xaxis:{title:'Giờ đón'},yaxis:{title:'Trung vị (phút)'}});
 const labels=['≤0,5','0,5–1','1–2','2–3','3–5','5–8','8–12','12–20','>20'];draw('distanceChart',[{type:'bar',x:labels,y:e.distance.counts,marker:{color:teal}}],{xaxis:{title:'Khoảng cách (km)'},yaxis:{title:'Số chuyến'}});
 draw('weekdayChart',[{type:'bar',x:['T2','T3','T4','T5','T6','T7','CN'],y:e.weekday.median_minutes,marker:{color:dark}}],{xaxis:{title:'Thứ'},yaxis:{title:'Trung vị (phút)'}});
 $('dataInsights').innerHTML='<ol><li>53,2% chuyến có khoảng cách không quá 2 km, nên sai số ở nhóm chuyến ngắn cần được chú ý.</li><li>Trung vị lúc 6 giờ là 7,9 phút và lúc 14 giờ là 12,1 phút, cho thấy thời điểm đón ảnh hưởng đến thời gian.</li><li>Phân vị 90% là 1.626 giây, gấp 2,45 lần trung vị 665 giây, nên dùng phép biến đổi log1p khi huấn luyện.</li></ol>';
}
async function loadScores(){if(scoreLoaded)return;const e=await(await fetch('/api/performance')).json();scoreLoaded=true;const el=$('modelKpis');kpi(el,'Mô hình','LightGBM','41 đặc trưng');kpi(el,'RMSLE tập giữ riêng',e.selected_rmsle.toFixed(6),'180.000 chuyến');kpi(el,'RMSLE tập kiểm định',e.metrics.find(x=>x.model.startsWith('LightGBM')).rmsle.toFixed(6),'102.000 chuyến');kpi(el,'Mục tiêu','RMSLE nhỏ','Dự đoán thời gian bằng giây');
 draw('scoreChart',[{type:'bar',orientation:'h',y:e.metrics.map(x=>x.model).reverse(),x:e.metrics.map(x=>x.rmsle).reverse(),marker:{color:teal}}],{xaxis:{title:'RMSLE'},margin:{l:145,r:15,t:15,b:40}});
 draw('scatterChart',[{type:'scatter',mode:'markers',x:e.scatter.actual,y:e.scatter.pred,marker:{size:5,color:teal,opacity:.33}}],{xaxis:{title:'Thực tế (giây)'},yaxis:{title:'Dự đoán (giây)'}});
 draw('importanceChart',[{type:'bar',orientation:'h',y:e.feature_importance.map(x=>x.feature).reverse(),x:e.feature_importance.map(x=>x.importance).reverse(),marker:{color:dark}}],{xaxis:{title:'Tỷ lệ đóng góp (%)'},margin:{l:155,r:12,t:15,b:40}});
}
async function init(){['pickupPlace','dropoffPlace'].forEach(buildPlaceSelect);for(let i=1;i<=6;i++)$('pickup_month').add(new Option('Tháng '+i,i));for(let i=0;i<7;i++)$('pickup_dayofweek').add(new Option(['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ Nhật'][i],i));for(let i=0;i<24;i++)$('pickup_hour').add(new Option(String(i).padStart(2,'0')+':00',i));
 document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>switchPage(b.dataset.page)));
 $('pickupPlace').addEventListener('change',()=>selectPlace('pickupPlace','pickup'));$('dropoffPlace').addEventListener('change',()=>selectPlace('dropoffPlace','dropoff'));
 for(const side of ['pickup','dropoff'])for(const coord of ['lat','lon'])$(side+'_'+coord+'_approx').addEventListener('change',()=>{matchPlace(side);updateDistance();plotScene();resetPrediction()});
 $('straight_line_km_approx').addEventListener('input',()=>{verifyDistance();resetPrediction()});$('example1Btn').onclick=()=>useExample(1);$('exampleBtn').onclick=()=>useExample(2);$('tripForm').addEventListener('submit',predict);for(const f of fields){if(f!=='straight_line_km_approx')$(f).addEventListener('change',resetPrediction)}
 $('mapFlat').onclick=()=>showMap('flat');
 $('mapOffline').onclick=()=>showMap('scene');
 $('mapSpin').onclick=()=>{if(!terrain3d)return;spinning=!spinning;terrain3d.spin(spinning);$('mapSpin').textContent=spinning?'Dừng xoay':'Xoay tự động';};
 try{const d=await(await fetch('/static/map_density.json')).json();density=d;}catch(e){$('distanceNotice').textContent='Không tải được dữ liệu nền bản đồ cục bộ.';}
 useExample(1);showMap('flat');plotScene();try{let status=await(await fetch('/api/health')).json();$('statusChip').textContent=status.model_ready?'Mô hình sẵn sàng':'Thiếu mô hình';}catch(e){$('statusChip').textContent='Chưa kết nối';}
 try{const resp=await fetch('/results/holdout_sample.csv');if(resp.ok){const t=await resp.text(),lines=t.trim().split('\n');let head=lines.shift().split(',');const ixKm=head.findIndex(s=>/km|distance/.test(s)),ixActual=head.findIndex(s=>/actual/.test(s));window.holdoutRows=ixKm>=0&&ixActual>=0?lines.map(s=>{let a=s.split(',');return{km:+a[ixKm],actual:+a[ixActual]}}):[];}}catch(e){}
}
window.addEventListener('DOMContentLoaded',init);
