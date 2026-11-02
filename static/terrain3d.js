"use strict";
// Bề mặt dữ liệu ba chiều vẽ bằng Canvas 2D. Không mở WebGL context.
(function () {
  const COLORS = [[237,246,248],[182,215,221],[96,164,176],[29,104,126],[9,54,82]];
  const colorAt = t => {
    const q = Math.max(0,Math.min(.9999,t))*(COLORS.length-1), i=Math.floor(q), a=q-i;
    return `rgb(${COLORS[i].map((v,k)=>Math.round(v+(COLORS[i+1][k]-v)*a)).join(',')})`;
  };
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const round2=v=>Number(v.toFixed(2));
  function setup(canvas, tooltip, counts, bounds, landmarks, onSelect) {
    const ctx=canvas.getContext('2d',{alpha:false});
    if (!ctx) return null;
    const pick=document.createElement('canvas'), pickCtx=pick.getContext('2d',{willReadFrequently:true});
    if(!pickCtx)return null;
    const rows=counts.length, cols=counts[0].length, minX=bounds.longitude_min,maxX=bounds.longitude_max,minY=bounds.latitude_min,maxY=bounds.latitude_max;
    let angle=-0.72, pitch=0.48, zoom=1.04, W=690,H=435, resizeObserver=null;
    let start=[-73.99,40.76], end=[-73.78,40.64], spinning=false, timer=null;
    let cursorDown=null,dragging=false, raf=0, landmarksOnScreen=[];
    const raw=counts.flat().map(v=>Math.log1p(v)).sort((a,b)=>a-b);
    const cap=Math.max(1,raw[Math.floor(raw.length*.975)] || 8);
    const heights=Array.from({length:rows+1},(_,r)=>Array.from({length:cols+1},(_,c)=>{
      // Local 3×3 smoothing reduces isolated, needle-like mountains.
      let acc=0,weight=0;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const rr=clamp(r+dy-1,0,rows-1),cc=clamp(c+dx-1,0,cols-1);
        const w=dx===0&&dy===0?3:1;
        acc+=Math.min(cap,Math.log1p(counts[rr][cc]))*w;weight+=w;
      }
      return (acc/weight)/cap;
    }));
    const heightAt=(lon,lat)=>{
      const r=clamp(Math.round((lat-minY)/(maxY-minY)*rows),0,rows);
      const c=clamp(Math.round((lon-minX)/(maxX-minX)*cols),0,cols);
      return heights[r][c];
    };
    function point(lon,lat,height=0){
      const X=(lon-(minX+maxX)/2)/(maxX-minX)*0.87;
      const Y=(lat-(minY+maxY)/2)/(maxY-minY);
      const cos=Math.cos(angle),sin=Math.sin(angle);
      const x=X*cos-Y*sin, y=X*sin+Y*cos;
      const scale=Math.min(W*.83,H*1.47)*zoom;
      return [W/2 + x*scale, H*.67 + y*scale*pitch - height*H*.23];
    }
    const trace=(c,vertices)=>{c.beginPath();c.moveTo(vertices[0][0],vertices[0][1]);for(let j=1;j<vertices.length;j++)c.lineTo(vertices[j][0],vertices[j][1]);c.closePath()};
    function label(c,x,y,message,color){
      c.save();c.font='600 11px Segoe UI, Arial, sans-serif';
      const textW=c.measureText(message).width,boxW=textW+20;
      let lx=clamp(x+11,5,W-boxW-5),ly=clamp(y-35,8,H-35);
      c.fillStyle='rgba(255,255,255,.95)';c.shadowColor='rgba(13,54,68,.14)';c.shadowBlur=10;
      c.beginPath();c.roundRect(lx,ly,boxW,27,7);c.fill();c.shadowBlur=0;
      c.fillStyle=color;c.fillText(message,lx+10,ly+17);c.restore();
    }
    function draw(){
      raf=0;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      const actualW=Math.max(100,canvas.clientWidth||canvas.parentElement.clientWidth),actualH=Math.max(100,canvas.clientHeight||canvas.parentElement.clientHeight);
      if(actualW!==W||actualH!==H||canvas.width!==Math.round(actualW*dpr)){
        W=actualW;H=actualH;canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
        ctx.setTransform(dpr,0,0,dpr,0,0);pick.width=Math.round(W);pick.height=Math.round(H);
      }
      const gradient=ctx.createLinearGradient(0,0,0,H);
      gradient.addColorStop(0,'#e7f2f7');gradient.addColorStop(.8,'#f6fafb');gradient.addColorStop(1,'#ffffff');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
      pickCtx.fillStyle='#000';pickCtx.fillRect(0,0,W,H);
      // Ground plane and reference grid.
      const boundsPoly=[[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]].map(p=>point(...p));
      trace(ctx,boundsPoly);ctx.fillStyle='#dbeaf0';ctx.fill();ctx.strokeStyle='#bdd2db';ctx.lineWidth=1;ctx.stroke();
      ctx.strokeStyle='rgba(105,149,164,.23)';ctx.lineWidth=.7;
      for(let k=0;k<=8;k++){
        let x=minX+(maxX-minX)*k/8;let a=point(x,minY),b=point(x,maxY);
        ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
      }
      for(let k=0;k<=8;k++){
        let y=minY+(maxY-minY)*k/8;let a=point(minX,y),b=point(maxX,y);
        ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();
      }
      // Painter's order from back to front. Heightfield grid cells provide exact color-coded hit testing.
      const cells=[];
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
        const lon0=minX+c*(maxX-minX)/cols,lon1=minX+(c+1)*(maxX-minX)/cols;
        const lat0=minY+r*(maxY-minY)/rows,lat1=minY+(r+1)*(maxY-minY)/rows;
        const coords=[[lon0,lat0],[lon1,lat0],[lon1,lat1],[lon0,lat1]];
        const values=[heights[r][c],heights[r][c+1],heights[r+1][c+1],heights[r+1][c]];
        const quad=coords.map((p,i)=>point(p[0],p[1],values[i]));
        const center=point((lon0+lon1)/2,(lat0+lat1)/2);
        cells.push({r,c,quad,depth:center[1],shade:values.reduce((a,b)=>a+b,0)/4});
      }
      cells.sort((a,b)=>a.depth-b.depth);
      for(const cell of cells){
        trace(ctx,cell.quad);
        ctx.fillStyle=colorAt(Math.pow(cell.shade,.85));ctx.fill();
        ctx.strokeStyle='rgba(230,247,247,.12)';ctx.lineWidth=.65;ctx.stroke();
        const id=cell.r*cols+cell.c+1;
        trace(pickCtx,cell.quad);pickCtx.fillStyle=`rgb(${id&255},${(id>>8)&255},${(id>>16)&255})`;pickCtx.fill();
      }
      // Route is illustrative, not a road route.
      const a=point(start[0],start[1],heightAt(...start)+.045),b=point(end[0],end[1],heightAt(...end)+.045);
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2 - clamp(Math.abs(a[0]-b[0])*.10+30,25,80)];
      for(const [stroke,width,dash] of [['#fff',6,[]],['#187c87',3,[8,6]]]){
        ctx.beginPath();ctx.moveTo(...a);ctx.quadraticCurveTo(mid[0],mid[1],b[0],b[1]);ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);
      }
      // Twelve local landmarks. Labels use a reduced set for readability.
      landmarksOnScreen=[];
      const showLabels=new Set(['Central Park','JFK','LaGuardia','Wall Street']);
      for(const landmark of landmarks){
        const [name,lon,lat]=landmark;const screen=point(lon,lat,heightAt(lon,lat)+.025);
        landmarksOnScreen.push({name,lon,lat,x:screen[0],y:screen[1]});
        ctx.beginPath();ctx.arc(screen[0],screen[1],3.8,0,Math.PI*2);ctx.fillStyle='#527d89';ctx.fill();ctx.lineWidth=1.5;ctx.strokeStyle='#fff';ctx.stroke();
        if(showLabels.has(name)){
          ctx.font='600 10px Segoe UI,Arial';ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=3;
          ctx.strokeText(name,screen[0]+5,screen[1]-8);ctx.fillStyle='#3d6171';ctx.fillText(name,screen[0]+5,screen[1]-8);
        }
      }
      for(const [pos,color,name] of [[a,'#009d97','Điểm đón'],[b,'#ec8055','Điểm đến']]){
        ctx.beginPath();ctx.arc(pos[0],pos[1],13,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.78)';ctx.fill();
        ctx.beginPath();ctx.arc(pos[0],pos[1],8,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#fff';ctx.stroke();
        label(ctx,pos[0],pos[1],name,name==='Điểm đón'?'#007a78':'#ae5634');
      }
      ctx.fillStyle='#486b7e';ctx.font='600 11px Segoe UI, Arial';
      ctx.fillText('CẢNH 3D MẬT ĐỘ CHUYẾN XE',14,25);
      ctx.font='10px Segoe UI,Arial';ctx.fillStyle='#738b9a';ctx.fillText('Dữ liệu tổng hợp theo ô 0,01°',14,42);
    }
    function requestDraw(){if(!raf)raf=requestAnimationFrame(draw)}
    function coordinate(ev){const rect=canvas.getBoundingClientRect();return{x:ev.clientX-rect.left,y:ev.clientY-rect.top}}
    function pickedCell(x,y){
      const X=Math.floor(x),Y=Math.floor(y);if(X<0||Y<0||X>=pick.width||Y>=pick.height)return null;
      const v=pickCtx.getImageData(X,Y,1,1).data, id=v[0]+(v[1]<<8)+(v[2]<<16)-1;
      if(id<0||id>=rows*cols)return null;
      const r=Math.floor(id/cols),c=id%cols;
      return{lon:round2(minX+c*(maxX-minX)/cols),lat:round2(minY+r*(maxY-minY)/rows),r,c};
    }
    function selectAt(x,y){
      let location=pickedCell(x,y);
      const near=landmarksOnScreen.find(p=>Math.hypot(p.x-x,p.y-y)<10);
      if(near)location={lon:near.lon,lat:near.lat};
      if(location){onSelect(location.lon,location.lat);return true;}return false;
    }
    function onPointerDown(ev){cursorDown=coordinate(ev);dragging=false;canvas.setPointerCapture(ev.pointerId)}
    function onPointerMove(ev){
      const p=coordinate(ev);
      if(cursorDown&&(ev.buttons&1)){
        const dx=p.x-cursorDown.x,dy=p.y-cursorDown.y;
        if(Math.abs(dx)>2||Math.abs(dy)>2){dragging=true;angle+=dx*.008;pitch=clamp(pitch+dy*.003,.27,.73);cursorDown=p;requestDraw();}
        tooltip.classList.add('hidden');return;
      }
      const cell=pickedCell(p.x,p.y);
      const near=landmarksOnScreen.find(q=>Math.hypot(q.x-p.x,q.y-p.y)<12);
      if(!cell&&!near){tooltip.classList.add('hidden');return;}
      const place=near?`<strong>${near.name}</strong><br>`:'';
      const lon=near?near.lon:cell.lon,lat=near?near.lat:cell.lat;
      tooltip.innerHTML=`${place}Kinh độ ${lon.toFixed(2)}<br>Vĩ độ ${lat.toFixed(2)}<br>Nhấp để chọn vị trí`;
      tooltip.style.left=`${clamp(p.x+16,7,W-160)}px`;tooltip.style.top=`${clamp(p.y-72,7,H-75)}px`;
      tooltip.classList.remove('hidden');
    }
    function onPointerUp(ev){const p=coordinate(ev);if(!dragging)selectAt(p.x,p.y);cursorDown=null;dragging=false;}
    function onWheel(ev){ev.preventDefault();zoom=clamp(zoom*(ev.deltaY>0?.92:1.08),.67,1.8);requestDraw()}
    canvas.addEventListener('pointerdown',onPointerDown);
    canvas.addEventListener('pointermove',onPointerMove);
    canvas.addEventListener('pointerup',onPointerUp);
    canvas.addEventListener('pointercancel',()=>{cursorDown=null;dragging=false});
    canvas.addEventListener('pointerleave',()=>tooltip.classList.add('hidden'));
    canvas.addEventListener('wheel',onWheel,{passive:false});
    if(typeof ResizeObserver!=='undefined'){
      resizeObserver=new ResizeObserver(()=>requestDraw());resizeObserver.observe(canvas);
    }
    requestDraw();
    return {
      setPoints(a,b){start=[...a];end=[...b];requestDraw()},
      spin(on){spinning=on;if(timer)clearInterval(timer);timer=null;
        if(on)timer=setInterval(()=>{if(!document.hidden){angle+=.014;requestDraw()}},80)},
      resize:requestDraw,
      destroy(){if(timer)clearInterval(timer);if(raf)cancelAnimationFrame(raf);if(resizeObserver)resizeObserver.disconnect();
        canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointermove',onPointerMove);
        canvas.removeEventListener('pointerup',onPointerUp);canvas.removeEventListener('wheel',onWheel)}
    };
  }
  window.UNETI06Terrain3D=setup;
})();
