#!/usr/bin/env node
/* Проверка запуска во ВК и ОК (по параметрам адреса; VK Bridge с unpkg подменён или недоступен):
 * в ОК нет ВКонтакте, vk.com/app и github.io, «Поделиться» — окном ОК; во ВК нет Одноклассников;
 * заставка Bridge не остаётся поверх приложения; строка поддержки на главной.
 *   python3 -m http.server 8765 --bind 127.0.0.1 &
 *   NODE_PATH=/opt/node-tools/node_modules node tools/check-vkok.js [--url http://127.0.0.1:8765/]
 * Случай «только параметры ОК без vk_*» Bridge не узнаёт — там остаётся одно «Скопировать текст» (это нормально). */
const URL_ARG = process.argv.indexOf('--url');
const BASE = (URL_ARG > 0 ? process.argv[URL_ARG + 1] : 'http://127.0.0.1:8765/').replace(/\/?$/, '/');
const {chromium}=require('playwright');
const FAKE="window.vkBridge={send:function(m,p){window.__vkb=(window.__vkb||[]).concat([{m:m,p:p}]);if(m==='VKWebAppStorageGet')return Promise.resolve({keys:(p.keys||[]).map(function(k){return {key:k,value:''}})});if(m==='VKWebAppGetUserInfo')return Promise.resolve({id:1});return Promise.resolve({result:true});},subscribe:function(){},supports:function(){return true},isWebView:function(){return false}};";
let fails=0;const ok=(c,m)=>{console.log((c?'  ok   ':'  FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch();
const cases=[['ok','?vk_app_id=54891238&vk_client=ok&vk_platform=mobile_web_ok&vk_language=ru'],['vk','?vk_app_id=54891238&vk_platform=mobile_android&vk_language=ru'],['web','']];
for(const [where,q] of cases) for(const net of where==='web'?['none']:['fake','blocked']){
 const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ru-RU'});
 await ctx.route('https://unpkg.com/**',r=>net==='fake'?r.fulfill({contentType:'text/javascript',body:FAKE}):r.abort());
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto(BASE+'index.html'+q);
 await p.waitForFunction(()=>window.__fh&&window.__fh.started(),null,{timeout:15000});
 const L=where+' '+net+' '+q.slice(1,28);
 const st=await p.evaluate(()=>({id:Platform.id,launch:Platform.launch,bridgeId:Platform.bridgeId,kind:Platform.shareKind(),link:Platform.link('#/horo/aries'),ov:!!document.getElementById('loading-overlay'),sup:(document.querySelector('.support-note')||{}).textContent}));
 ok(st.kind===where&&!st.ov,L+': '+JSON.stringify(st));
 const hit=await p.evaluate(()=>{const t=document.querySelector('.tile, a[href="#/horo"], [data-go="#/horo"]');const r=t.getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return t.contains(e)||e===t});
 ok(hit,L+': главный экран нажимается (заставка Bridge не мешает)');
 await p.evaluate(()=>{location.hash='#/horo/aries'});await p.waitForTimeout(500);
 await p.click('[data-action=share]');await p.waitForSelector('#share-sheet:not([hidden])');await p.waitForTimeout(800);
 const txt=await p.evaluate(()=>document.body.innerText+' '+[...document.querySelectorAll('a[href]')].map(a=>a.href).join(' '));
 const btns=await p.evaluate(()=>[...document.querySelectorAll('#share-sheet button')].map(b=>b.textContent.trim()));
 if(where==='ok') ok(!/ВКонтакте|vk\.com\/app|github\.io/i.test(txt),L+': в ОК нет ВКонтакте/vk.com/app/github.io; кнопки '+btns.join(' | '));
 if(where==='vk') ok(!/Одноклассник|ok\.ru|github\.io/i.test(txt),L+': во ВК нет ОК/github.io; кнопки '+btns.join(' | '));
 if(where==='web') ok(true,L+': кнопки '+btns.join(' | '));
 if(net==='fake'&&where!=='web'){
   await p.click('#share-sheet .btn-gold');await p.waitForTimeout(400);
   const calls=await p.evaluate(()=>(window.__vkb||[]).filter(c=>/Share|Story/.test(c.m)));
   ok(calls.length===1 && (where==='ok'? calls[0].m==='VKWebAppShare' && !calls[0].p.link : true), L+': вызов '+JSON.stringify(calls).slice(0,160));
 }
 // copy text
 ok(errs.filter(e=>!/Failed to load|ERR_FAILED|unpkg/.test(e)).length===0,L+': ошибок нет '+JSON.stringify(errs.slice(0,2)));
 await ctx.close();}
console.log(fails?"ПРОВАЛЕНО "+fails:"Всё в порядке");await b.close();process.exit(fails?1:0);})();
