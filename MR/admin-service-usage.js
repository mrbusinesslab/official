(function(){
 document.querySelectorAll('iframe[data-usage-page]').forEach(function(frame){
   const button=document.querySelector('[data-page="'+frame.dataset.usagePage+'"]');
   if(!button)return;
   button.addEventListener('click',function(){if(!frame.hasAttribute('src'))frame.src=frame.dataset.src;});
   frame.addEventListener('load',function(){
     try{
       const doc=frame.contentDocument;if(!doc||frame.contentWindow.location.origin!==location.origin)return;
       const style=doc.createElement('style');style.textContent='html,body{background:transparent!important}main{padding:0!important;max-width:none!important}header h1,header a,#logout{display:none!important}header{justify-content:flex-end!important}';doc.head.appendChild(style);
       const main=doc.querySelector('main');if(!main)return;
       const resize=function(){const h=Math.ceil(main.getBoundingClientRect().height)+24;if(h>0&&h<20000)frame.style.height=Math.max(650,h)+'px';};new ResizeObserver(resize).observe(main);resize();
     }catch(_){}
   });
 });
})();