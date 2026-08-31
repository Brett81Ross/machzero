(() => {
  const APK_URL = 'https://github.com/Brett81Ross/cactusbyte-studios/releases/download/android-latest/MachZero.apk';
  const APP_NAME = 'MachZero';
  const isNative = () => /CactusByteNative\/1\.0/i.test(navigator.userAgent);
  const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);
  window.addEventListener('beforeinstallprompt', event => event.preventDefault());

  function notice(message) {
    let toast = document.getElementById('cactusbyte-native-install-toast');
    if (!toast) {
      toast = document.createElement('div'); toast.id = 'cactusbyte-native-install-toast';
      Object.assign(toast.style,{position:'fixed',left:'50%',bottom:'86px',transform:'translateX(-50%)',zIndex:'2147483647',maxWidth:'min(92vw,420px)',padding:'10px 14px',borderRadius:'999px',background:'#080808',border:'1px solid rgba(255,160,70,.55)',color:'#fff',font:'700 12px/1.35 system-ui,sans-serif',boxShadow:'0 12px 32px rgba(0,0,0,.45)',textAlign:'center'});
      document.body.appendChild(toast);
    }
    toast.textContent=message; toast.hidden=false; clearTimeout(notice.timer); notice.timer=setTimeout(()=>toast.hidden=true,3200);
  }

  function install(){
    if(isNative()) return notice(`${APP_NAME} is already running as the installed Android app.`);
    if(isIOS()) return notice('Native iPhone/iPad installation will use TestFlight or the App Store — no browser shortcut.');
    notice(`Downloading the real ${APP_NAME} Android app…`); window.location.assign(APK_URL);
  }

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest('button,a'):null;if(!target)return;
    const label=(target.textContent||'').trim().replace(/\s+/g,' ');
    if(!/^(?:⬇\s*)?(?:install(?: app)?|android install)$/i.test(label))return;
    event.preventDefault();event.stopImmediatePropagation();install();
  },true);

  function mount(){
    const controls=[...document.querySelectorAll('button,a')];
    const existing=controls.find(el=>/^(?:⬇\s*)?(?:install(?: app)?|android install)$/i.test((el.textContent||'').trim().replace(/\s+/g,' ')));
    if(existing){existing.hidden=false;existing.removeAttribute('hidden');return;}
    const button=document.createElement('button');button.type='button';button.textContent='⬇ Install App';button.setAttribute('aria-label',`Install ${APP_NAME} Android app`);
    Object.assign(button.style,{position:'fixed',left:'14px',bottom:'14px',zIndex:'2147483000',minHeight:'44px',padding:'10px 14px',borderRadius:'14px',border:'1px solid rgba(255,160,70,.65)',background:'linear-gradient(180deg,#3d2512,#15100b)',color:'#fff',font:'850 12px/1 system-ui,sans-serif',boxShadow:'0 8px 24px rgba(0,0,0,.35)',cursor:'pointer'});
    button.addEventListener('click',install);document.body.appendChild(button);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
