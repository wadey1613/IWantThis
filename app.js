(function(){
'use strict';

/* ================= settings ================= */
var CFG=window.IWT_CONFIG||{};
var BASE=String(CFG.SUPABASE_URL||'').trim().replace(/\/+$/,'');
var KEY=String(CFG.SUPABASE_KEY||'').trim();
var CONFIGURED=/^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1))/i.test(BASE)&&BASE.indexOf('PASTE')<0&&KEY.length>20&&KEY.indexOf('PASTE')<0;
var SESSION_KEY='iwt.session.v1',NAME_KEY='iwt.name';
var POLL_MS=20000;

var PALETTE=['#C2364A','#2F7D5B','#2D6CB5','#A5650F','#7A4BB8','#0E7C86'];
var COLOUR_NAMES=['Cranberry','Pine','Blue','Amber','Plum','Teal'];
var OCC=[['anytime','Anytime'],['birthday','Birthday'],['christmas','Christmas']];
var P={
  tag:'<path d="M9 3h6l3 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7z"/><circle cx="12" cy="8" r="1.4"/>',
  gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M7.5 8a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 1 1 0 5"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  family:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2c2.4.2 4.5 2 4.5 4.8"/>',
  chevron:'<path d="M9 6l6 6-6 6"/>',
  back:'<path d="M15 6l-6 6 6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="M6 6l12 12M18 6L6 18"/>',
  external:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  camera:'<path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
  link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
};
function ic(n,s){s=s||20;return '<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+P[n]+'</svg>';}
function $(s){return document.querySelector(s);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
function lsDel(k){try{localStorage.removeItem(k);}catch(e){}}

var S={
  uid:null,members:new Map(),items:[],itemMap:new Map(),claims:new Map(),photos:new Map(),
  tab:'mine',viewing:null,filter:'all',sheet:null,draft:null,shown:'',lastFocus:null,armDelete:false,
  authMode:'signin',sig:'',online:true,busy:false,loading:false,photoBusy:false,
  joinCode:null,inviteMsg:''
};

/* ================= helpers ================= */
function nm(m){return String((m&&m.name)||'Someone').slice(0,30);}
function ci(m){var i=PALETTE.indexOf(m&&m.color);return i<0?0:i;}
function avatar(m,size){var ch=Array.from(nm(m))[0]||'?';return '<span class="av c'+ci(m)+' '+(size||'')+'" aria-hidden="true">'+esc(ch.toUpperCase())+'</span>';}
function okPhoto(p){return typeof p==='string'&&p.length<400000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(p);}
function safeUrl(u){
  u=String(u||'').trim(); if(!u) return '';
  try{var x=new URL(/^https?:\/\//i.test(u)?u:'https://'+u);return (x.protocol==='https:'||x.protocol==='http:')&&x.hostname.indexOf('.')>0?x.href:'';}catch(e){return '';}
}
function guessTitle(href){
  try{
    var segs=new URL(href).pathname.split('/').filter(Boolean).map(function(s){try{return decodeURIComponent(s);}catch(e){return s;}});
    var stop={dp:1,gp:1,product:1,products:1,p:1,item:1,itm:1,ip:1,buy:1,pd:1,s:1,sch:1,shop:1,detail:1,details:1,prod:1};
    var best='';
    segs.forEach(function(seg){
      var t=seg.replace(/\.(html?|php|aspx?)$/i,'');
      if(stop[t.toLowerCase()]||/^\d+$/.test(t)) return;
      if(/^[A-Z0-9]{8,14}$/.test(t)&&t.indexOf('-')<0) return;
      var words=t.split(/[-_+]/).filter(function(w){return w&&!/^\d{6,}$/.test(w);});
      if(words.length>=2&&t.length>best.length) best=words.join(' ');
    });
    return best.replace(/\b\w/g,function(c){return c.toUpperCase();}).slice(0,100);
  }catch(e){return '';}
}
function fmtPrice(n){return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',minimumFractionDigits:n%1?2:0,maximumFractionDigits:2}).format(n);}
function hasPrice(i){return typeof i.price==='number'&&isFinite(i.price)&&i.price>=0;}
function occKey(i){return OCC.some(function(o){return o[0]===i.occasion;})?i.occasion:'anytime';}
function occLabel(k){return (OCC.filter(function(o){return o[0]===k;})[0]||OCC[0])[1];}
function byNewest(a,b){return (b.createdAt||0)-(a.createdAt||0);}
function getItem(id){return S.itemMap.get(id);}
function photoOf(i){return i&&i.photo_hash?(S.photos.get(i.photo_hash)||''):'';}
function plural(n,w){return n+' '+w+(n===1?'':'s');}
function searchLinks(title){
  var q=encodeURIComponent(String(title||'').trim());
  return {
    primary:{name:'Google Shopping',href:'https://www.google.co.uk/search?tbm=shop&q='+q+'&tbs=p_ord:p'},
    compare:[
      {name:'PriceSpy',href:'https://pricespy.co.uk/search?search='+q},
      {name:'idealo',href:'https://www.idealo.co.uk/results.html?q='+q}
    ],
    shops:[
      {name:'Amazon',href:'https://www.amazon.co.uk/s?k='+q+'&s=price-asc-rank'},
      {name:'eBay',href:'https://www.ebay.co.uk/sch/i.html?_nkw='+q+'&_sop=15'},
      {name:'Argos',href:'https://www.argos.co.uk/search/'+q+'/'},
      {name:'Currys',href:'https://www.currys.co.uk/search?q='+q},
      {name:'John Lewis',href:'https://www.johnlewis.com/search?search-term='+q}
    ]
  };
}
var toastTimer;
function toast(m){var t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){t.hidden=true;},4200);}

var AUTH_ERR={
  wrong_code:"That family code isn't right. Ask whoever set up the app for it.",
  locked:'Too many wrong tries. Please wait about 15 minutes and try again.',
  bad_credentials:'That name and PIN don\'t match. Check them and try again.',
  name_taken:'Someone in the family already has that name. Try adding an initial.',
  invalid_pin:'The PIN needs to be at least 6 characters long.',
  invalid_name:'Please enter a name (up to 30 characters).',
  not_signed_in:'Your phone lost its connection to the app. Reload the page and try again.',
  not_allowed:'Only the person who set the family up can do that.',
  no_such_member:'That person could not be found.'
};
function authMsg(code){return AUTH_ERR[code]||"That didn't work. Try again.";}

/* ================= server connection (Supabase over plain fetch) ================= */
function readSession(){try{var s=JSON.parse(lsGet(SESSION_KEY)||'null');return s&&s.access_token&&s.refresh_token?s:null;}catch(e){return null;}}
function saveSession(j){
  var now=Math.floor(Date.now()/1000);
  var s={access_token:j.access_token,refresh_token:j.refresh_token,expires_at:j.expires_at||(now+(j.expires_in||3600))};
  lsSet(SESSION_KEY,JSON.stringify(s));S.session=s;return s;
}
function fail(status,body,network){
  var e=new Error((body&&(body.message||body.msg||body.error_description||body.error))||('HTTP '+status));
  e.status=status;e.body=body;e.code=body&&(body.error_code||body.code)||'';e.network=!!network;return e;
}
function rawFetch(path,opts){
  opts=opts||{};
  var h=Object.assign({apikey:KEY,'Content-Type':'application/json'},opts.headers||{});
  return fetch(BASE+path,{method:opts.method||'GET',headers:h,body:opts.body==null?undefined:JSON.stringify(opts.body)})
    .then(function(r){
      return r.text().then(function(t){
        var j=null;if(t){try{j=JSON.parse(t);}catch(e){j=t;}}
        if(!r.ok) throw fail(r.status,j&&typeof j==='object'?j:{message:String(j||'')},false);
        S.online=true;return j;
      });
    },function(){S.online=false;throw fail(0,null,true);});
}
function anonSignIn(){
  return rawFetch('/auth/v1/signup',{method:'POST',body:{data:{},gotrue_meta_security:{}}}).then(function(j){
    if(!j||!j.access_token) throw fail(500,{message:'No session returned'});
    return saveSession(j);
  });
}
function refreshSession(s){
  return rawFetch('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:s.refresh_token}}).then(saveSession);
}
var tokenP=null;
function ensureToken(force){
  if(tokenP) return tokenP;
  var s=S.session||readSession();S.session=s;
  var now=Math.floor(Date.now()/1000);
  if(s&&!force&&s.expires_at-now>60) return Promise.resolve(s);
  tokenP=(s?refreshSession(s).catch(function(e){if(e.network) throw e;return anonSignIn();}):anonSignIn())
    .then(function(r){tokenP=null;return r;},function(e){tokenP=null;throw e;});
  return tokenP;
}
function api(path,opts,retried){
  return ensureToken().then(function(s){
    opts=Object.assign({},opts);
    opts.headers=Object.assign({Authorization:'Bearer '+s.access_token},opts.headers||{});
    return rawFetch(path,opts).catch(function(e){
      if(e.status===401&&!retried) return ensureToken(true).then(function(){return api(path,opts,true);});
      throw e;
    });
  });
}
function rest(method,path,body,prefer){
  return api('/rest/v1/'+path,{method:method,body:body,headers:prefer?{Prefer:prefer}:{}});
}
function rpc(name,args){return api('/rest/v1/rpc/'+name,{method:'POST',body:args||{}});}

/* ================= full-screen states ================= */
function gate(html){$('#gate').innerHTML=html;$('#gate').hidden=false;$('#shell').hidden=true;}
function gateMsg(t,b,extra){gate('<div class="gate"><div class="gate-mark">'+ic('tag',28)+'</div><h1>'+esc(t)+'</h1><p>'+esc(b)+'</p>'+(extra||'')+'</div>');}
function gateLoading(){gate('<div class="gate"><div class="gate-mark pulse">'+ic('tag',28)+'</div><h1>Opening the family lists</h1></div>');}
function setupScreen(){
  gateMsg('Nearly there','This app isn\'t connected to its database yet. Open the file called config.js in the app folder and paste in your Supabase project URL and publishable key, then upload the folder to Netlify again.');
}
function swatchesHTML(idPrefix,cur){
  return '<div class="swatches">'+PALETTE.map(function(c,i){return '<input class="sr-only" type="radio" name="'+idPrefix+'-color" id="'+idPrefix+i+'" value="'+c+'"'+(i===cur?' checked':'')+'><label class="sw c'+i+'" for="'+idPrefix+i+'" aria-label="'+COLOUR_NAMES[i]+'">'+ic('check',20)+'</label>';}).join('')+'</div>';
}
function authHTML(err){
  var join=S.authMode==='join',last=lsGet(NAME_KEY)||'';
  return '<div class="onboard"><div class="gate-mark">'+ic('tag',28)+'</div><h1>'+(join?'Join the family':'Welcome back')+'</h1>'+
    '<p class="lead">'+(join?'Everyone keeps a wish list. Add your name so the family knows whose is whose. Others can tick things on your list as bought, and you never see those ticks.':'Sign in with your name and PIN.')+'</p>'+
    '<div class="segs two" role="group" aria-label="Sign in or join" style="width:100%">'+
    '<button type="button" class="chip" style="min-height:48px;border-radius:12px" data-act="authmode" data-mode="signin" aria-pressed="'+(!join)+'">Sign in</button>'+
    '<button type="button" class="chip" style="min-height:48px;border-radius:12px" data-act="authmode" data-mode="join" aria-pressed="'+join+'">I\'m new</button></div>'+
    '<form id="authForm" class="form" autocomplete="off" data-mode="'+S.authMode+'">'+
    (join?'<div class="field"><label for="a-code">Family code</label><input id="a-code" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" required></div>':'')+
    '<div class="field"><label for="a-name">Your name</label><input id="a-name" type="text" maxlength="30" required autocomplete="off" value="'+esc(join?'':last)+'"></div>'+
    '<div class="field"><label for="a-pin">'+(join?'Choose a PIN':'Your PIN')+'</label><input id="a-pin" type="password" maxlength="64" required autocomplete="off">'+(join?'<span class="hint">At least 6 characters. Numbers are fine. Remember it, you\'ll need it on a new phone.</span>':'')+'</div>'+
    (join?'<fieldset class="field"><legend>Your colour</legend>'+swatchesHTML('a-',0)+'</fieldset>':'')+
    (err?'<div class="form-error" role="alert">'+esc(err)+'</div>':'')+
    '<button class="btn primary wide" type="submit">'+(join?'Join the family':'Sign in')+'</button></form></div>';
}
function showAuth(err){S.shown='auth';gate(authHTML(err));var f=$('#a-code')||$('#a-name');if(f&&!(f.value))f.focus({preventScroll:true});else{var p=$('#a-pin');if(p)p.focus({preventScroll:true});}}

/* ================= rendering ================= */
function render(force){
  if(!S.uid){return;}
  var me=S.members.get(S.uid);
  if(!me){return;}
  S.shown='main';
  $('#gate').hidden=true;$('#shell').hidden=false;
  paintChrome(me);paintMain();syncSheet();
}
function paintChrome(me){
  $('.brand').innerHTML=ic('tag',22)+'<span>I want <em>this</em></span>';
  $('#me-slot').innerHTML='<button class="me" data-act="profile" aria-label="Your profile">'+avatar(me,'sm')+'</button>';
  $('#tab-mine').innerHTML=ic('list',22)+'<span>My list</span>';
  $('#tab-family').innerHTML=ic('family',22)+'<span>Family</span>';
}
function paintMain(){
  $('#tab-mine').setAttribute('aria-current',S.tab==='mine'?'page':'false');
  $('#tab-family').setAttribute('aria-current',S.tab==='family'?'page':'false');
  var h='';
  if(!S.online) h+='<p class="banner offline" role="status">You\'re offline. What you see may be out of date. Changes won\'t save until you\'re back online.</p>';
  if(S.tab==='mine') h+=mineHTML();
  else if(S.viewing&&S.viewing!==S.uid&&S.members.has(S.viewing)) h+=personHTML(S.viewing);
  else {S.viewing=null;h+=familyHTML();}
  $('#app').innerHTML=h;
}
function effFilter(list){
  if(S.filter==='all') return 'all';
  return list.some(function(i){return occKey(i)===S.filter;})?S.filter:'all';
}
function filterBar(list){
  var counts={all:list.length};
  OCC.forEach(function(o){counts[o[0]]=list.filter(function(i){return occKey(i)===o[0];}).length;});
  var kinds=OCC.filter(function(o){return counts[o[0]]>0;});
  if(kinds.length<2) return '';
  var f=effFilter(list);
  return '<div class="filters" role="group" aria-label="Filter by occasion">'+[['all','All']].concat(kinds).map(function(k){
    return '<button class="chip" data-act="filter" data-f="'+k[0]+'" aria-pressed="'+(f===k[0])+'">'+k[1]+'<span class="n">'+counts[k[0]]+'</span></button>';
  }).join('')+'</div>';
}
function applyFilter(list){var f=effFilter(list);return f==='all'?list:list.filter(function(i){return occKey(i)===f;});}
function tagHTML(i){return '<span class="tag">'+esc(occLabel(occKey(i)))+'</span>';}
function thumbHTML(i){var p=photoOf(i);return okPhoto(p)?'<img class="thumb" src="'+p+'" alt="">':'<span class="thumb">'+ic('gift',30)+'</span>';}
function statusHTML(i){
  var c=S.claims.get(i.id),id=esc(i.id);
  if(!c) return '<span class="pill open">Still to buy</span><button class="btn small ghost" data-act="bought" data-id="'+id+'">'+ic('check',16)+" I've bought this</button>";
  if(c.buyer===S.uid) return '<span class="pill bought">'+ic('check',14)+' You bought this</span><button class="btn small linkish" data-act="unbought" data-id="'+id+'">Undo</button>';
  return '<span class="pill bought">'+ic('check',14)+' Bought by '+esc(nm(S.members.get(c.buyer)))+'</span>';
}
function cardHTML(i,mine){
  return '<li class="card"><button class="card-main" data-act="open" data-id="'+esc(i.id)+'">'+thumbHTML(i)+
    '<div style="min-width:0"><div class="card-title">'+esc(i.title)+'</div><div class="card-meta">'+tagHTML(i)+(hasPrice(i)?'<span class="price">about '+fmtPrice(i.price)+'</span>':'')+(safeUrl(i.link)?ic('link',15):'')+'</div></div>'+
    '<span class="chev">'+ic('chevron',20)+'</span></button>'+
    (mine?'':'<div class="card-foot">'+statusHTML(i)+'</div>')+'</li>';
}
function mineHTML(){
  var list=S.items.filter(function(i){return i.owner===S.uid;}).sort(byNewest);
  var shown=applyFilter(list);
  var body;
  if(!list.length) body='<div class="empty"><h2>Nothing on your list yet</h2><p>See something you like? Add its name, a link or a photo. Your family will see it and can pick it up for Christmas or your birthday.</p></div>';
  else body='<ul class="items">'+shown.map(function(i){return cardHTML(i,true);}).join('')+'</ul>';
  return '<div class="page-head"><h1>Your list</h1><p class="sub">'+(list.length?plural(list.length,'thing')+'. ':'')+"The family can see this list. You won't see who has bought what.</p></div>"+
    '<button class="add" data-act="add">'+ic('plus',20)+' Add something you want</button>'+filterBar(list)+body;
}
function familyHTML(){
  var others=Array.from(S.members.entries()).filter(function(e){return e[0]!==S.uid;}).sort(function(a,b){return nm(a[1]).localeCompare(nm(b[1]));});
  if(!others.length) return '<div class="page-head"><h1>Family</h1></div><div class="empty"><h2>Nobody else is here yet</h2><p>Send the app link and the family code to your family. They show up here once they join.</p></div>';
  return '<div class="page-head"><h1>Family</h1><p class="sub">Tap a name to see what they want.</p></div><ul class="items">'+others.map(function(e){
    var list=S.items.filter(function(i){return i.owner===e[0];});
    var open=list.filter(function(i){return !S.claims.has(i.id);}).length;
    var ct=list.length?plural(list.length,'wish')+', '+open+' still to buy':'Nothing on their list yet';
    return '<li><button class="person" data-act="person" data-uid="'+esc(e[0])+'">'+avatar(e[1])+'<div style="min-width:0"><div class="nm">'+esc(nm(e[1]))+'</div><div class="ct">'+ct+'</div></div><span class="chev">'+ic('chevron',20)+'</span></button></li>';
  }).join('')+'</ul>';
}
function personHTML(uid){
  var m=S.members.get(uid);
  var list=S.items.filter(function(i){return i.owner===uid;}).sort(byNewest);
  var open=list.filter(function(i){return !S.claims.has(i.id);}).length;
  var shown=applyFilter(list);
  var body=list.length?'<ul class="items">'+shown.map(function(i){return cardHTML(i,false);}).join('')+'</ul>':'<div class="empty"><h2>Nothing here yet</h2><p>'+esc(nm(m))+" hasn't added anything. Check back later.</p></div>";
  return '<button class="back" data-act="back">'+ic('back',18)+' Family</button>'+
    '<div class="person-head">'+avatar(m,'lg')+'<div><h1>'+esc(nm(m))+'’s list</h1><p class="sub">'+(list.length?plural(list.length,'thing')+', '+open+' still to buy':'Nothing on it yet')+'</p></div></div>'+
    filterBar(list)+body;
}

/* ================= sheets ================= */
function detailHTML(it){
  var mine=it.owner===S.uid,own=S.members.get(it.owner),L=searchLinks(it.title),saved=safeUrl(it.link),ph=photoOf(it);
  function ext(u){return 'href="'+esc(u)+'" target="_blank" rel="noopener noreferrer"';}
  return '<div class="grab"></div><div class="sheet-head"><h2 id="sheet-title" tabindex="-1">'+esc(it.title)+'</h2><button class="icon-btn" data-act="close" aria-label="Close">'+ic('close')+'</button></div>'+
    (okPhoto(ph)?'<img class="hero" src="'+ph+'" alt="">':'')+
    '<div class="meta">'+tagHTML(it)+(hasPrice(it)?'<span class="price">about '+fmtPrice(it.price)+'</span>':'')+'<span>'+(mine?'On your list':'On '+esc(nm(own))+'’s list')+'</span></div>'+
    (it.note?'<p class="note">'+esc(it.note)+'</p>':'')+
    '<h3 class="sec">Find the best price</h3>'+
    '<a class="btn primary wide" '+ext(L.primary.href)+'>Compare prices, lowest first '+ic('external',18)+'</a>'+
    '<div class="link-grid">'+L.compare.map(function(c){return '<a class="btn ghost small" '+ext(c.href)+'>'+esc(c.name)+' '+ic('external',16)+'</a>';}).join('')+'</div>'+
    '<p class="sec-sub">Or go straight to a shop</p><div class="chips">'+L.shops.map(function(s){return '<a class="shop" '+ext(s.href)+'>'+esc(s.name)+'</a>';}).join('')+'</div>'+
    (saved?'<a class="link-row" '+ext(saved)+'>'+ic('link',18)+'<span>Open the saved link</span>'+ic('external',16)+'</a>':'')+
    '<p class="fine">Each button opens that site’s own results for “'+esc(it.title)+'”, so the prices are always current.</p>'+
    (mine?'<div class="buy"><button class="btn ghost wide" data-act="edit" data-id="'+esc(it.id)+'">Edit this item</button></div>':'<div class="buy" id="buy-slot">'+buyHTML(it)+'</div>');
}
function buyHTML(it){
  var c=S.claims.get(it.id),owner=nm(S.members.get(it.owner)),id=esc(it.id);
  if(!c) return '<button class="btn primary wide" data-act="bought" data-id="'+id+'">'+ic('check',18)+" I've bought this</button><p class=\"fine\">"+esc(owner)+" won't see that it's taken. Everyone else will.</p>";
  if(c.buyer===S.uid) return '<div class="pill bought">'+ic('check',16)+' You bought this</div><button class="btn ghost wide" data-act="unbought" data-id="'+id+'">Undo</button>';
  return '<div class="pill bought">'+ic('check',16)+' Bought by '+esc(nm(S.members.get(c.buyer)))+'</div><p class="fine">Pick something else from '+esc(owner)+'’s list.</p>';
}
function editHTML(it){
  var occ=it?occKey(it):'anytime';
  return '<div class="grab"></div><div class="sheet-head"><h2 id="sheet-title" tabindex="-1">'+(it?'Edit item':'Add to your list')+'</h2><button class="icon-btn" data-act="close" aria-label="Close">'+ic('close')+'</button></div>'+
  '<form id="itemForm" class="form" autocomplete="off" data-id="'+(it?esc(it.id):'')+'">'+
  '<div class="field"><label for="f-title">What do you want?</label><input id="f-title" type="text" maxlength="120" required placeholder="Brand, model, colour" value="'+esc(it&&it.title)+'"></div>'+
  '<div class="field"><label for="f-link">Link <span class="opt">optional</span></label><input id="f-link" type="text" inputmode="url" autocapitalize="none" placeholder="Paste a link from any shop" value="'+esc(it&&it.link)+'"></div>'+
  '<div class="field"><span class="lbl">Photo <span class="opt">optional</span></span><div class="photo-row"><div id="f-prev" class="prev"></div><div class="photo-actions">'+
    '<label class="btn ghost small" for="f-photo">'+ic('camera',18)+'<span id="f-photo-lbl">Add a photo</span></label><input id="f-photo" class="sr-only" type="file" accept="image/*">'+
    '<button type="button" id="f-rm" class="btn small linkish" data-act="rm-photo" hidden>Remove</button></div></div></div>'+
  '<fieldset class="field"><legend>For</legend><div class="segs">'+OCC.map(function(o){return '<input class="sr-only" type="radio" name="f-occ" id="o-'+o[0]+'" value="'+o[0]+'"'+(o[0]===occ?' checked':'')+'><label class="seg" for="o-'+o[0]+'">'+o[1]+'</label>';}).join('')+'</div></fieldset>'+
  '<div class="field"><label for="f-note">Details <span class="opt">optional</span></label><textarea id="f-note" rows="2" maxlength="240" placeholder="Size, colour, which version">'+esc(it&&it.note)+'</textarea></div>'+
  '<div class="field"><label for="f-price">Roughly how much? <span class="opt">optional</span></label><div class="money"><span aria-hidden="true">£</span><input id="f-price" type="text" inputmode="decimal" placeholder="0" value="'+(it&&hasPrice(it)?esc(String(it.price)):'')+'"></div></div>'+
  '<div class="form-actions"><button class="btn primary grow" type="submit">'+(it?'Save changes':'Add to my list')+'</button>'+(it?'<button class="btn danger" type="button" id="f-del" data-act="delete">Delete</button>':'')+'</div></form>';
}
function profileSheetHTML(){
  var me=S.members.get(S.uid),isAdmin=!!(me&&me.is_admin),cur=ci(me);
  var others=Array.from(S.members.entries()).filter(function(e){return e[0]!==S.uid;});
  var ua=navigator.userAgent||'',ios=/iPhone|iPad|iPod/i.test(ua);
  return '<div class="grab"></div><div class="sheet-head"><h2 id="sheet-title" tabindex="-1">'+esc(nm(me))+'</h2><button class="icon-btn" data-act="close" aria-label="Close">'+ic('close')+'</button></div>'+
    '<form id="profileForm" class="form" autocomplete="off">'+
    '<div class="field"><label for="p-name">Your name</label><input id="p-name" type="text" maxlength="30" required value="'+esc(nm(me))+'"></div>'+
    '<fieldset class="field"><legend>Your colour</legend>'+swatchesHTML('p-',cur)+'</fieldset>'+
    '<div id="p-msg"></div><button class="btn primary wide" type="submit">Save</button></form>'+
    '<form id="pinForm" class="box" autocomplete="off"><h3>Change your PIN</h3>'+
    '<div class="field"><label for="n-pin">New PIN</label><input id="n-pin" type="password" maxlength="64" required autocomplete="off"><span class="hint">At least 6 characters.</span></div>'+
    '<div id="n-msg"></div><button class="btn ghost" type="submit">Change PIN</button></form>'+
    (isAdmin?
      '<div class="box"><h3>Invite family</h3><p class="hint">Send them the app link and this family code. They tap “I\'m new” and choose their own name and PIN.</p>'+
      '<div class="codebox"><code id="join-code">…</code><button class="btn small ghost" type="button" data-act="copy-code">Copy</button></div>'+
      '<button class="btn primary" type="button" data-act="invite">Share an invite</button></div>'+
      (others.length?'<form id="resetForm" class="box" autocomplete="off"><h3>Someone forgot their PIN?</h3>'+
        '<div class="field"><label for="r-who">Who</label><select id="r-who">'+others.map(function(e){return '<option value="'+esc(e[0])+'">'+esc(nm(e[1]))+'</option>';}).join('')+'</select></div>'+
        '<div class="field"><label for="r-pin">Give them a new PIN</label><input id="r-pin" type="password" maxlength="64" required autocomplete="off"></div>'+
        '<div id="r-msg"></div><button class="btn ghost" type="submit">Set new PIN</button></form>':''):'')+
    '<div class="tip"><strong>Put it on your home screen.</strong> '+(ios?'In Safari, tap the Share button, then “Add to Home Screen”.':'In Chrome or Samsung Internet, open the ⋮ menu and choose “Add to Home screen” or “Install app”.')+'</div>'+
    '<div class="box"><button class="btn danger wide" type="button" data-act="signout">Sign out on this phone</button></div>';
}
function drawSheet(){
  var sh=$('#sheet'),m=S.sheet;
  if(m.mode==='detail'){var it=getItem(m.id);if(!it){closeSheet();return;}sh.innerHTML=detailHTML(it);var bs=$('#buy-slot');if(bs) bs.dataset.sig=buyHTML(it);}
  else if(m.mode==='edit'){var e=m.id?getItem(m.id):null;if(m.id&&(!e||e.owner!==S.uid)){closeSheet();return;}sh.innerHTML=editHTML(e);wireEdit(e);}
  else if(m.mode==='profile'){sh.innerHTML=profileSheetHTML();loadJoinCode();}
}
function openSheet(mode,id){
  S.lastFocus=document.activeElement;S.sheet={mode:mode,id:id};S.armDelete=false;
  drawSheet();
  if(!S.sheet) return;
  $('#scrim').hidden=false;document.body.classList.add('lock');
  var t=$('#sheet-title');if(t) t.focus({preventScroll:true});
  $('#sheet').scrollTop=0;
}
function closeSheet(){
  S.sheet=null;S.draft=null;S.armDelete=false;
  $('#scrim').hidden=true;$('#sheet').innerHTML='';document.body.classList.remove('lock');
  if(S.lastFocus&&S.lastFocus.isConnected&&S.lastFocus.focus) S.lastFocus.focus({preventScroll:true});
}
function syncSheet(){
  if(!S.sheet||S.sheet.mode!=='detail') return;
  var it=getItem(S.sheet.id);
  if(!it){closeSheet();return;}
  var slot=$('#buy-slot');
  if(slot&&it.owner!==S.uid){
    var next=buyHTML(it);
    if(slot.dataset.sig===next) return;
    var had=slot.contains(document.activeElement);
    slot.innerHTML=next;slot.dataset.sig=next;
    if(had){var b=slot.querySelector('button');if(b) b.focus({preventScroll:true});}
  }
  var hero=$('#sheet .hero'),ph=photoOf(it);
  if(!hero&&okPhoto(ph)){
    var img=document.createElement('img');img.className='hero';img.alt='';img.src=ph;
    var meta=$('#sheet .meta');if(meta) meta.parentNode.insertBefore(img,meta);
  }
}
function loadJoinCode(){
  var me=S.members.get(S.uid);if(!me||!me.is_admin) return;
  rpc('get_join_code').then(function(c){
    S.joinCode=typeof c==='string'?c:null;
    var el=$('#join-code');if(el) el.textContent=S.joinCode||'(not available)';
  }).catch(function(){var el=$('#join-code');if(el) el.textContent='(could not load)';});
}

/* ================= photo handling ================= */
function syncPhotoUI(){
  var has=!!S.draft.photo||(S.draft.hasServerPhoto&&!S.draft.dirty);
  var shown=S.draft.photo;
  $('#f-prev').innerHTML=shown?'<img src="'+shown+'" alt="Photo preview">':ic('gift',30);
  $('#f-photo-lbl').textContent=has?'Change photo':'Add a photo';
  $('#f-rm').hidden=!has;
}
function wireEdit(it){
  var hash=it&&it.photo_hash;
  S.draft={photo:it?photoOf(it):'',dirty:false,hasServerPhoto:!!hash};
  if(hash&&!S.draft.photo){
    // the photo hasn't been fetched yet; fetch it just for this form
    fetchPhotos([it.id]).then(function(){
      if(S.sheet&&S.sheet.mode==='edit'&&S.draft&&!S.draft.dirty){S.draft.photo=photoOf(getItem(it.id));syncPhotoUI();}
    });
  }
  syncPhotoUI();
  $('#f-photo').addEventListener('change',onPhoto);
  $('#f-link').addEventListener('change',function(){
    var t=$('#f-title'),u=safeUrl($('#f-link').value);
    if(u&&!t.value.trim()){var g=guessTitle(u);if(g) t.value=g;}
  });
}
function shrink(file){
  return new Promise(function(res,rej){
    var url=URL.createObjectURL(file),img=new Image();
    img.onload=function(){
      try{
        var k=Math.min(1,480/Math.max(img.naturalWidth,img.naturalHeight));
        var w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k));
        var c=document.createElement('canvas');c.width=w;c.height=h;
        var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);
        var dataUrl=c.toDataURL('image/jpeg',0.72);
        URL.revokeObjectURL(url);res(dataUrl);
      }catch(er){URL.revokeObjectURL(url);rej(er);}
    };
    img.onerror=function(){URL.revokeObjectURL(url);rej(new Error('img'));};
    img.src=url;
  });
}
function onPhoto(e){
  var f=e.target.files&&e.target.files[0];if(!f) return;
  shrink(f).then(function(d){if(!S.draft) return;S.draft.photo=d;S.draft.dirty=true;syncPhotoUI();})
  .catch(function(){toast("That photo couldn't be read. Try another one.");});
}

/* ================= loading data ================= */
function sigOf(){
  var parts=[S.members.size];
  S.members.forEach(function(m,id){parts.push(id+m.name+m.color+m.is_admin);});
  S.items.forEach(function(i){parts.push(i.id+'|'+i.title+'|'+i.link+'|'+i.occasion+'|'+i.note+'|'+i.price+'|'+i.photo_hash+'|'+(S.photos.has(i.photo_hash)?1:0));});
  S.claims.forEach(function(c,id){parts.push(id+c.buyer);});
  parts.push(S.online);
  return parts.join('\n');
}
function loadAll(){
  if(S.loading||!S.uid) return Promise.resolve();
  S.loading=true;
  return Promise.all([
    rpc('current_member'),
    rest('GET','members?select=id,name,color,is_admin&order=name.asc'),
    rest('GET','items?select=id,owner,title,link,occasion,note,price,photo_hash,created_at&order=created_at.desc'),
    rest('GET','claims?select=item_id,buyer')
  ]).then(function(r){
    S.loading=false;
    if(!r[0]){leaveToAuth();return;}
    if(r[0]!==S.uid) S.uid=r[0];
    S.members=new Map(r[1].map(function(m){return [m.id,m];}));
    S.items=r[2].map(function(i){i.createdAt=Date.parse(i.created_at)||0;i.photo_hash=i.photo_hash||'';return i;});
    S.itemMap=new Map(S.items.map(function(i){return [i.id,i];}));
    S.claims=new Map(r[3].map(function(c){return [c.item_id,{buyer:c.buyer}];}));
    var wasOnline=S.online;S.online=true;
    var s=sigOf();
    if(s!==S.sig||!wasOnline||S.shown!=='main'){S.sig=s;render();}
    loadPhotos();
  }).catch(function(e){
    S.loading=false;
    if(window.console&&!(e&&e.network)) console.error('loadAll failed',e&&e.stack||e);
    if(e&&e.network){if(S.shown==='main'){S.sig='';paintMain();}return;}
    if(S.shown!=='main'){gateMsg('Lists unavailable',friendlyErr(e),'<button class="btn primary" data-act="reload">Try again</button>');S.shown='error';}
  });
}
function friendlyErr(e){
  var c=e&&(e.code||'');
  if(c==='anonymous_provider_disabled'||/anonymous/i.test(String(e&&e.message))) return 'Anonymous sign-ins are switched off in Supabase. In your Supabase project go to Authentication, then Sign In / Providers, and turn on Allow anonymous sign-ins.';
  if(e&&(e.status===401||e.status===403)) return 'The app\'s connection details look wrong. Check the URL and publishable key in config.js.';
  if(e&&e.network) return 'No connection. Check your internet and try again.';
  if(e&&(e.status===404||c==='PGRST202'||c==='42P01'||c==='PGRST205')) return 'The database isn\'t set up yet. Run setup.sql in the Supabase SQL Editor.';
  return 'The family lists could not be loaded. Try again in a moment.';
}
function fetchPhotos(ids){
  if(!ids.length) return Promise.resolve();
  return rest('GET','items?select=id,photo,photo_hash&id=in.('+ids.map(encodeURIComponent).join(',')+')').then(function(rows){
    rows.forEach(function(r){if(r.photo_hash&&okPhoto(r.photo)) S.photos.set(r.photo_hash,r.photo);});
  });
}
function loadPhotos(){
  if(S.photoBusy) return;
  var seen={},need=[];
  S.items.forEach(function(i){
    if(i.photo_hash&&!S.photos.has(i.photo_hash)&&!seen[i.photo_hash]){seen[i.photo_hash]=1;need.push(i.id);}
  });
  if(!need.length) return;
  S.photoBusy=true;
  var batches=[];for(var k=0;k<need.length;k+=8) batches.push(need.slice(k,k+8));
  batches.reduce(function(p,b){return p.then(function(){return fetchPhotos(b).then(function(){S.sig=sigOf();if(S.shown==='main') render();});});},Promise.resolve())
    .catch(function(){}).then(function(){S.photoBusy=false;});
}

/* ================= account actions ================= */
function enter(){
  S.shown='loading';gateLoading();
  S.sig='';
  return rpc('current_member').then(function(id){
    if(!id){leaveToAuth();return;}
    S.uid=id;S.loading=false;
    return loadAll();
  }).catch(function(e){S.shown='error';gateMsg('Lists unavailable',friendlyErr(e),'<button class="btn primary" data-act="reload">Try again</button>');});
}
function leaveToAuth(msg){
  S.uid=null;S.tab='mine';S.viewing=null;S.filter='all';S.members=new Map();S.items=[];S.itemMap=new Map();S.claims=new Map();S.sig='';
  if(S.sheet) closeSheet();
  showAuth(msg||'');
}
function submitAuth(form){
  var join=form.dataset.mode==='join',btn=form.querySelector('button[type=submit]');
  var name=$('#a-name').value.trim(),pin=$('#a-pin').value;
  if(!name||!pin) return;
  btn.disabled=true;
  var p;
  if(join){
    var cEl=form.querySelector('input[name="a--color"]:checked');
    p=rpc('join_family',{p_code:$('#a-code').value.trim(),p_name:name,p_pin:pin,p_color:cEl?cEl.value:PALETTE[0]});
  }else p=rpc('sign_in',{p_name:name,p_pin:pin});
  p.then(function(r){
    if(r&&r.ok){lsSet(NAME_KEY,name);return enter();}
    var code=join?$('#a-code').value:'';
    showAuth(authMsg(r&&r.error));
    var n=$('#a-name');if(n) n.value=name;var c=$('#a-code');if(c) c.value=code;
  }).catch(function(e){
    var msg=e&&e.network?'No connection. Check your internet and try again.':friendlyErr(e);
    showAuth(msg);var n=$('#a-name');if(n) n.value=name;
  });
}
function signOut(){
  rpc('sign_out').catch(function(){}).then(function(){leaveToAuth();S.authMode='signin';showAuth('');});
}

/* ================= writes ================= */
function saveItem(form){
  var id=form.dataset.id,title=$('#f-title').value.trim();if(!title) return;
  var cur=id?getItem(id):null;
  if(cur&&cur.owner!==S.uid) return;
  var link=safeUrl($('#f-link').value);
  var occEl=form.querySelector('input[name="f-occ"]:checked'),occ=occEl?occEl.value:'anytime';
  var note=$('#f-note').value.trim().slice(0,240);
  var p=parseFloat($('#f-price').value.replace(',','.')),price=isFinite(p)&&p>=0&&p<100000000?Math.round(p*100)/100:null;
  var body={title:title,link:link,occasion:occ,note:note,price:price};
  if(!id){body.owner=S.uid;body.photo=S.draft.photo||'';}
  else if(S.draft.dirty) body.photo=S.draft.photo||'';
  var btn=form.querySelector('button[type=submit]');btn.disabled=true;
  var req=id?rest('PATCH','items?id=eq.'+encodeURIComponent(id),body,'return=minimal'):rest('POST','items',body,'return=minimal');
  req.then(function(){closeSheet();toast(id?'Saved':'Added to your list');S.sig='';return loadAll();})
  .catch(function(e){toast(e&&e.network?"You're offline. That didn't save.":"That didn't save. Try again.");btn.disabled=false;});
}
function delItem(){
  var form=$('#itemForm'),id=form&&form.dataset.id,b=$('#f-del');if(!id) return;
  var it=getItem(id);if(!it||it.owner!==S.uid) return;
  if(!S.armDelete){
    S.armDelete=true;b.textContent='Tap again to delete';
    setTimeout(function(){if(S.armDelete&&b.isConnected){S.armDelete=false;b.textContent='Delete';}},4000);
    return;
  }
  b.disabled=true;
  rest('DELETE','items?id=eq.'+encodeURIComponent(id),null,'return=minimal')
  .then(function(){closeSheet();toast('Deleted');S.sig='';return loadAll();})
  .catch(function(){toast("That didn't delete. Try again.");b.disabled=false;});
}
function msgBox(sel,cls,text){var el=$(sel);if(el) el.innerHTML=text?'<div class="'+cls+'" role="alert">'+esc(text)+'</div>':'';}
function saveProfile(form){
  var name=$('#p-name').value.trim().slice(0,30);if(!name) return;
  var cEl=form.querySelector('input[name="p--color"]:checked'),color=cEl?cEl.value:PALETTE[0];
  var btn=form.querySelector('button[type=submit]');btn.disabled=true;
  rpc('update_profile',{p_name:name,p_color:color}).then(function(r){
    btn.disabled=false;
    if(r&&r.ok){lsSet(NAME_KEY,name);closeSheet();toast('Saved');S.sig='';return loadAll();}
    msgBox('#p-msg','form-error',authMsg(r&&r.error));
  }).catch(function(){btn.disabled=false;msgBox('#p-msg','form-error',"That didn't save. Check your connection.");});
}
function savePin(form){
  var pin=$('#n-pin').value;if(!pin) return;
  var btn=form.querySelector('button[type=submit]');btn.disabled=true;
  rpc('change_pin',{p_pin:pin}).then(function(r){
    btn.disabled=false;
    if(r&&r.ok){$('#n-pin').value='';msgBox('#n-msg','form-ok','PIN changed. Use the new one next time you sign in.');}
    else msgBox('#n-msg','form-error',authMsg(r&&r.error));
  }).catch(function(){btn.disabled=false;msgBox('#n-msg','form-error',"That didn't save. Check your connection.");});
}
function resetPin(form){
  var who=$('#r-who').value,pin=$('#r-pin').value;if(!who||!pin) return;
  var btn=form.querySelector('button[type=submit]');btn.disabled=true;
  rpc('admin_reset_pin',{p_member:who,p_pin:pin}).then(function(r){
    btn.disabled=false;
    if(r&&r.ok){$('#r-pin').value='';msgBox('#r-msg','form-ok','Done. Tell them their new PIN.');}
    else msgBox('#r-msg','form-error',authMsg(r&&r.error));
  }).catch(function(){btn.disabled=false;msgBox('#r-msg','form-error',"That didn't save. Check your connection.");});
}
function setBought(id,on){
  var it=getItem(id);if(!it||it.owner===S.uid) return;
  var cur=S.claims.get(id);
  if(on){
    if(cur&&cur.buyer!==S.uid){toast(nm(S.members.get(cur.buyer))+' has already marked this as bought');return;}
    rest('POST','claims',{item_id:id,buyer:S.uid},'return=minimal').then(function(){
      S.claims.set(id,{buyer:S.uid});S.sig=sigOf();render();
      toast("Marked as bought. "+nm(S.members.get(it.owner))+" can't see this.");
    }).catch(function(e){
      if(e&&(e.status===409||e.code==='23505')){toast('Someone has just marked this as bought');S.sig='';loadAll();}
      else toast(e&&e.network?"You're offline. That didn't save.":"That didn't save. Try again.");
    });
  }else if(cur&&cur.buyer===S.uid){
    rest('DELETE','claims?item_id=eq.'+encodeURIComponent(id)+'&buyer=eq.'+encodeURIComponent(S.uid),null,'return=minimal').then(function(){
      S.claims.delete(id);S.sig=sigOf();render();toast('Back to still to buy');
    }).catch(function(){toast("That didn't save. Try again.");});
  }else if(cur) toast('Only '+nm(S.members.get(cur.buyer))+' can undo that');
}
function inviteText(){
  var url=location.origin+location.pathname;
  return 'Join our family wish list on I Want This: '+url+'\nFamily code: '+(S.joinCode||'(ask me)')+'\nTap "I\'m new" and pick your own name and PIN.';
}
function copyText(t,ok){
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function(){toast(ok);},function(){toast('Could not copy. Select and copy it by hand.');});
  else toast('Could not copy. Select and copy it by hand.');
}

/* ================= events ================= */
document.addEventListener('click',function(e){
  var el=e.target.closest('[data-act]');if(!el) return;
  var a=el.dataset.act,id=el.dataset.id;
  if(a==='tab'){S.tab=el.dataset.tab;S.viewing=null;S.filter='all';paintMain();window.scrollTo(0,0);}
  else if(a==='person'){S.viewing=el.dataset.uid;S.filter='all';paintMain();window.scrollTo(0,0);}
  else if(a==='back'){S.viewing=null;S.filter='all';paintMain();window.scrollTo(0,0);}
  else if(a==='filter'){S.filter=el.dataset.f;paintMain();}
  else if(a==='add') openSheet('edit',null);
  else if(a==='open') openSheet('detail',id);
  else if(a==='edit') openSheet('edit',id);
  else if(a==='close') closeSheet();
  else if(a==='profile') openSheet('profile');
  else if(a==='bought') setBought(id,true);
  else if(a==='unbought') setBought(id,false);
  else if(a==='rm-photo'){S.draft.photo='';S.draft.dirty=true;S.draft.hasServerPhoto=false;syncPhotoUI();}
  else if(a==='delete') delItem();
  else if(a==='authmode'){S.authMode=el.dataset.mode;showAuth('');}
  else if(a==='signout') signOut();
  else if(a==='reload') location.reload();
  else if(a==='copy-code'){if(S.joinCode) copyText(S.joinCode,'Code copied');}
  else if(a==='invite'){
    var t=inviteText();
    if(navigator.share) navigator.share({title:'I Want This',text:t}).catch(function(){});
    else copyText(t,'Invite copied. Paste it into a message.');
  }
});
document.addEventListener('submit',function(e){
  e.preventDefault();var f=e.target;
  if(f.id==='itemForm') saveItem(f);
  else if(f.id==='profileForm') saveProfile(f);
  else if(f.id==='authForm') submitAuth(f);
  else if(f.id==='pinForm') savePin(f);
  else if(f.id==='resetForm') resetPin(f);
});
$('#scrim').addEventListener('click',function(e){if(e.target.id==='scrim') closeSheet();});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&S.sheet) closeSheet();});
window.addEventListener('online',function(){if(S.uid) loadAll();});
window.addEventListener('offline',function(){S.online=false;if(S.shown==='main'){S.sig='';paintMain();}});
document.addEventListener('visibilitychange',function(){if(!document.hidden&&S.uid) loadAll();});
setInterval(function(){if(!document.hidden&&S.uid&&!S.busy) loadAll();},POLL_MS);

/* ================= boot ================= */
function boot(){
  if(!CONFIGURED){setupScreen();return;}
  S.shown='loading';gateLoading();
  S.session=readSession();
  if(!lsGet(NAME_KEY)) S.authMode='join';
  ensureToken().then(function(){return enter();}).catch(function(e){
    S.shown='error';
    gateMsg('Can\'t connect',friendlyErr(e),'<button class="btn primary" data-act="reload">Try again</button>');
  });
  // wait for the "enter" promise path: if not signed in, enter() shows the auth screen
}
boot();
})();
