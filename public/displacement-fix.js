/* Displacement fix: Chrome-only interactive text, static on other browsers */
(function(){
/* Mobile logo: proxy scrollLeft to transform for reliable mobile scroll + touch drag */
if(window.innerWidth<=768){document.fonts.ready.then(function(){setTimeout(function(){var c=document.getElementById('gaLogoScroll');var t=document.getElementById('gaLogoTrack');if(c&&t){var p=0;Object.defineProperty(c,'scrollLeft',{get:function(){return p;},set:function(v){p=v;t.style.transform='translateX('+(-v)+'px)';},configurable:true});Object.defineProperty(c,'scrollWidth',{get:function(){return t.scrollWidth;},configurable:true});}},200);});}
var IS_TOUCH=('ontouchstart' in window)||navigator.maxTouchPoints>0;
if(IS_TOUCH){var ts=document.createElement('style');ts.textContent='span.char-span{left:0px!important;}';document.head.appendChild(ts);return;}
var IS_CHROME=/Chrome/.test(navigator.userAgent)&&!/Edg|OPR/.test(navigator.userAgent);
if(!IS_CHROME){var ns=document.createElement('style');ns.textContent='span.char-span{left:0px!important;}';document.head.appendChild(ns);return;}
var GAP=15,LP=0.24,LR=0.04,TMAX=12,TTL=120;
var trail2=[],mx2=-9999,my2=-9999;
document.addEventListener('mousemove',function(e){
mx2=e.clientX;my2=e.clientY;
trail2.push({x:e.clientX,y:e.clientY,t:performance.now()});
if(trail2.length>TMAX) trail2.shift();
});
var blocks2=[];

function rebuildSpans(el){
/* Read text from existing char-spans (original already built them) */
var oldSpans=el.querySelectorAll('span.char-span');
if(oldSpans.length===0) return;
var text='';
var hasBr=el.querySelector('br');
if(hasBr){
/* Reconstruct text with BR markers */
var parts=[];var cur='';
for(var n=0;n<el.childNodes.length;n++){
var nd=el.childNodes[n];
if(nd.nodeName==='BR'){parts.push(cur);cur='';}
else if(nd.nodeType===3){cur+=nd.textContent;}
else if(nd.classList&&nd.classList.contains('line-wrapper')){
var spans=nd.querySelectorAll('span.char-span');
for(var s=0;s<spans.length;s++) cur+=spans[s].textContent;
} else {
var spans=nd.querySelectorAll('span.char-span');
if(spans.length>0) for(var s=0;s<spans.length;s++) cur+=spans[s].textContent;
else cur+=nd.textContent;
}
}
if(cur) parts.push(cur);
el.innerHTML='';
for(var p=0;p<parts.length;p++){
if(p>0) el.appendChild(document.createElement('br'));
var wrapper=document.createElement('span');
wrapper.className='line-wrapper';
wrapper.style.display='inline';
for(var c=0;c<parts[p].length;c++){
var sp=document.createElement('span');
sp.className='char-fx';
sp.textContent=parts[p][c];
wrapper.appendChild(sp);
}
el.appendChild(wrapper);
}
} else {
for(var i=0;i<oldSpans.length;i++) text+=oldSpans[i].textContent;
el.innerHTML='';
for(var i=0;i<text.length;i++){
var sp=document.createElement('span');
sp.className='char-fx';
sp.textContent=text[i];
el.appendChild(sp);
}
}
}

function buildSpansFromText(el){
var text=el.textContent;
el.innerHTML='';
for(var i=0;i<text.length;i++){
var sp=document.createElement('span');
sp.className='char-fx';
sp.textContent=text[i];
el.appendChild(sp);
}
}

function setupBlock2(el){
var spans=el.querySelectorAll('span.char-fx');
if(spans.length===0) return;
/* Ensure all spans at natural position */
for(var i=0;i<spans.length;i++) spans[i].style.left='0px';
var elRect=el.getBoundingClientRect();
var chars=[];
for(var i=0;i<spans.length;i++){
var r=spans[i].getBoundingClientRect();
chars.push({el:spans[i],rx:r.left-elRect.left,ry:r.top-elRect.top,
w:r.width,h:r.height,offset:0,target:0,lastPx:null});
}
var lines=[],cur=[],curY=-99999;
for(var ci=0;ci<chars.length;ci++){
var c=chars[ci];
if(cur.length===0||Math.abs(c.ry-curY)<c.h*0.8){
cur.push(c);if(cur.length===1) curY=c.ry;
} else {lines.push(cur);cur=[c];curY=c.ry;}
}
if(cur.length) lines.push(cur);
var vRange;
if(lines.length>=2){
var ts=0;for(var li=0;li<lines.length-1;li++) ts+=lines[li+1][0].ry-lines[li][0].ry;
vRange=(ts/(lines.length-1))*0.75;
} else {
vRange=(lines.length>0&&lines[0].length>0)?lines[0][0].h*1.2:20;
}
blocks2.push({el:el,chars:chars,lines:lines,cfg:{gap:GAP,vRange:vRange,lerpPush:LP,lerpReturn:LR}});
}

function setupBlockChildren2(el){
var children=el.children;
for(var i=0;i<children.length;i++) children[i].style.left='0px';
var elRect=el.getBoundingClientRect();
var chars=[];
for(var i=0;i<children.length;i++){
var ch=children[i];var r=ch.getBoundingClientRect();
chars.push({el:ch,rx:r.left-elRect.left,ry:r.top-elRect.top,
w:r.width,h:r.height,offset:0,target:0,lastPx:null});
}
var lines=[],cur=[],curY=-99999;
for(var ci=0;ci<chars.length;ci++){
var c=chars[ci];
if(cur.length===0||Math.abs(c.ry-curY)<c.h*0.8){
cur.push(c);if(cur.length===1) curY=c.ry;
} else {lines.push(cur);cur=[c];curY=c.ry;}
}
if(cur.length) lines.push(cur);
var vRange;
if(lines.length>=2){
var ts=0;for(var li=0;li<lines.length-1;li++) ts+=lines[li+1][0].ry-lines[li][0].ry;
vRange=(ts/(lines.length-1))*0.75;
} else {
vRange=(lines.length>0&&lines[0].length>0)?lines[0][0].h*1.2:20;
}
blocks2.push({el:el,chars:chars,lines:lines,cfg:{gap:GAP,vRange:vRange,lerpPush:LP,lerpReturn:LR}});
}

function bestTrail2(lineY,lL,lR,gap,vRange){
var bestInf=0,bestX=mx2,xpad=gap+4;
for(var ti=0;ti<trail2.length;ti++){
var tp=trail2[ti];
if(tp.x>=lL-xpad&&tp.x<=lR+xpad){
var tdy=Math.abs(tp.y-lineY);
var tinf=Math.max(0,1-tdy/vRange);
if(tinf>bestInf){bestInf=tinf;bestX=tp.x;}
}
if(ti>0){
var ta=trail2[ti-1];var dy0=ta.y-lineY;var segDy=tp.y-ta.y;
var tStar=(Math.abs(segDy)<0.5)?0:Math.max(0,Math.min(1,-dy0/segDy));
var crossX=ta.x+tStar*(tp.x-ta.x);var crossY=ta.y+tStar*segDy;
if(crossX>=lL-xpad&&crossX<=lR+xpad){
var cdy=Math.abs(crossY-lineY);
var cinf=Math.max(0,1-cdy/vRange);
if(cinf>bestInf){bestInf=cinf;bestX=crossX;}
}
}
}
return {inf:bestInf,mx:bestX};
}

function tick2(){
var now=performance.now();
while(trail2.length>2&&now-trail2[0].t>TTL) trail2.shift();
for(var bi=0;bi<blocks2.length;bi++){
var block=blocks2[bi];
var rect=block.el.getBoundingClientRect();
var cfg=block.cfg;
for(var li=0;li<block.lines.length;li++){
var line=block.lines[li];var nChar=line.length;
if(nChar<2){if(nChar===1) line[0].target=0;continue;}
var first=line[0];var last=line[nChar-1];
var lL=rect.left+first.rx;
var lR=rect.left+last.rx+last.w;
var firstCC=lL+first.w*0.5;
var lastCC=lR-last.w*0.5;
var lineY=rect.top+first.ry+first.h*0.5;
var best=bestTrail2(lineY,lL,lR,cfg.gap,cfg.vRange);
var inf=best.inf;
if(inf<0.001){for(var n=0;n<nChar;n++) line[n].target=0;
line[0].target=0;line[nChar-1].target=0;continue;}
var mx=Math.max(lL,Math.min(lR,best.mx));
var leftSpan=mx-firstCC;var rightSpan=lastCC-mx;
var desiredGap=cfg.gap*inf;
var gapL=desiredGap;var gapR=desiredGap;
var safeL=leftSpan>0?leftSpan:0;var safeR=rightSpan>0?rightSpan:0;
for(var k=0;k<nChar-1;k++){
var ca=line[k];var cb=line[k+1];
var ccA=rect.left+ca.rx+ca.w*0.5;
var ccB=rect.left+cb.rx+cb.w*0.5;
var adv=ccB-ccA;var minD=(ca.w+cb.w)*0.5;
if(adv<=minD||adv<0.5) continue;
var frac=1-minD/adv;
if(ccB<=mx&&leftSpan>0.5){var capL=leftSpan*frac;if(capL<safeL) safeL=capL;}
else if(ccA>mx&&rightSpan>0.5){var capR=rightSpan*frac;if(capR<safeR) safeR=capR;}
}
gapL=Math.min(gapL,Math.max(0,safeL));
gapR=Math.min(gapR,Math.max(0,safeR));
for(var ci=0;ci<nChar;ci++){
var ch=line[ci];var cc=rect.left+ch.rx+ch.w*0.5;
var newCC;
if(cc<=mx){newCC=(leftSpan>0.5)?firstCC+(cc-firstCC)/leftSpan*(leftSpan-gapL):cc;}
else{newCC=(rightSpan>0.5)?lastCC-(lastCC-cc)/rightSpan*(rightSpan-gapR):cc+gapR;}
ch.target=newCC-cc;
}
/* Edge pinning */
line[0].target=0;
line[nChar-1].target=0;
}
for(var ci2=0;ci2<block.chars.length;ci2++){
var ch2=block.chars[ci2];
var d=ch2.target-ch2.offset;
var ret=(Math.abs(ch2.target)<Math.abs(ch2.offset)-0.08);
var lf=ret?cfg.lerpReturn:cfg.lerpPush;
if(Math.abs(d)>0.04){ch2.offset+=d*lf;}else{ch2.offset=ch2.target;}
var px=Math.round(ch2.offset*100)/100;
if(ch2.lastPx!==px){ch2.el.style.left=px+'px';ch2.lastPx=px;}
}
}
requestAnimationFrame(tick2);
}

var blockChildEls2=[];
var sels=['.ga-headline','.ga-body-text','.ga-quote-text',
'.ga-founder-bio','.ga-capability h3','.ga-capability p',
'.ga-team-group p:not(.ga-team-label)','.ga-cta-body',
'.ga-section-left .ga-label','.ga-trusted-left .ga-label',
'.ga-team-label','.ga-team-group h3'];

document.fonts.ready.then(function(){
/* Build spans for H3s that original missed */
var h3s=document.querySelectorAll('.ga-team-group h3');
for(var i=0;i<h3s.length;i++){
if(!h3s[i].querySelector('span.char-span')&&!h3s[i].querySelector('span.char-fx')){
buildSpansFromText(h3s[i]);
}
}
/* Wait for original to finish setup, then replace its spans */
setTimeout(function(){
var els=document.querySelectorAll(sels.join(', '));
for(var i=0;i<els.length;i++){
var el=els[i];
rebuildSpans(el);
el.classList.add('displacement-active');
setupBlock2(el);
}
var tagsC=document.querySelector('.ga-industries-tags');
if(tagsC){tagsC.classList.add('displacement-active');
var ch=tagsC.children;for(var j=0;j<ch.length;j++) ch[j].style.left='0px';
setupBlockChildren2(tagsC);blockChildEls2.push(tagsC);}
var badgesC=document.querySelector('.ga-badges');
if(badgesC){badgesC.classList.add('displacement-active');
var ch=badgesC.children;for(var j=0;j<ch.length;j++) ch[j].style.left='0px';
setupBlockChildren2(badgesC);blockChildEls2.push(badgesC);}
requestAnimationFrame(tick2);
},600);
});

var resizeT2;
window.addEventListener('resize',function(){
clearTimeout(resizeT2);
resizeT2=setTimeout(function(){
var old=blocks2.splice(0);
for(var i=0;i<old.length;i++){
var isBC=blockChildEls2.indexOf(old[i].el)!==-1;
if(isBC){
var ch=old[i].el.children;for(var j=0;j<ch.length;j++) ch[j].style.left='0';
setupBlockChildren2(old[i].el);
} else {
var sp=old[i].el.querySelectorAll('span.char-fx');
for(var j=0;j<sp.length;j++) sp[j].style.left='0';
setupBlock2(old[i].el);
}
}
},200);
});
}());
