// dsh-ipv6-gate 客户端 bundle —— 设置页「手机 IPv6 远程访问」
// 格式要求：
//   1. window.__ModuleLoader__.load({id, factory}) 普通脚本（非 ESM）
//   2. factory 返回带 apply + inject 的对象
//   3. inject 用短服务名 "slots"
window.__ModuleLoader__.load({
  id: "dsh-ipv6-gate",
  factory: (require) => {
    var React = require("react");
    var h = React.createElement;
    var module = { exports: {} };

    /* ═══ CSS（ra- 前缀，不污染宿主） ═══ */
    var CSS = `
.ra-root{--ra-bg:oklch(100% 0 0);--ra-surface:oklch(100% 0 0);--ra-raised:oklch(100% 0 0);--ra-inset:oklch(97.9% 0 0);--ra-fg:oklch(21% 0 0);--ra-muted:oklch(49% 0 0);--ra-border:oklch(91.5% 0 0);--ra-accent:oklch(58% .16 145);--ra-danger:oklch(56% .19 25);--ra-warn:oklch(62% .14 68);--ra-knob:oklch(100% 0 0);--ra-panel-shadow:0 1px 2px oklch(0% 0 0/.05);--ra-font-display:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',system-ui,sans-serif;--ra-font-mono:'JetBrains Mono','IBM Plex Mono',Consolas,ui-monospace,Menlo,monospace;--ra-accent-soft:color-mix(in oklch,var(--ra-accent) 13%,transparent);--ra-accent-line:color-mix(in oklch,var(--ra-accent) 30%,transparent);--ra-ok-ink:color-mix(in oklch,var(--ra-accent) 52%,var(--ra-fg));--ra-danger-soft:color-mix(in oklch,var(--ra-danger) 11%,transparent);--ra-danger-ink:color-mix(in oklch,var(--ra-danger) 58%,var(--ra-fg));--ra-warn-soft:color-mix(in oklch,var(--ra-warn) 14%,transparent);--ra-warn-line:color-mix(in oklch,var(--ra-warn) 34%,transparent);--ra-warn-ink:color-mix(in oklch,var(--ra-warn) 62%,var(--ra-fg));--ra-fg-soft:color-mix(in oklch,var(--ra-fg) 6%,transparent);--ra-fg-faint:color-mix(in oklch,var(--ra-fg) 3%,transparent);--ra-muted-ink:color-mix(in oklch,var(--ra-muted) 74%,var(--ra-fg));--ra-radius:8px;--ra-radius-lg:12px;--ra-ease:cubic-bezier(.2,.7,.3,1);container-type:inline-size;container-name:ra;width:100%;background:var(--ra-bg);color:var(--ra-fg);font-size:15px;line-height:1.55;color-scheme:light;-webkit-font-smoothing:antialiased}
.ra-root[data-theme="dark"]{--ra-bg:oklch(19% 0 0);--ra-surface:oklch(23.5% 0 0);--ra-raised:oklch(30.5% 0 0);--ra-inset:oklch(16.5% 0 0);--ra-fg:oklch(95% 0 0);--ra-muted:oklch(70% 0 0);--ra-border:oklch(36% 0 0);--ra-accent:oklch(72% .15 145);--ra-danger:oklch(70% .17 25);--ra-warn:oklch(80% .13 75);--ra-panel-shadow:0 1px 2px oklch(0% 0 0/.45);color-scheme:dark}
.ra-root *,.ra-root *::before,.ra-root *::after{box-sizing:border-box}
.ra-root [hidden]{display:none!important}
.ra-root h1,.ra-root h2,.ra-root p{margin:0}
.ra-root p{text-wrap:pretty}
.ra-root button{font:inherit;color:inherit;cursor:pointer}
.ra-root code{font-family:var(--ra-font-mono)}
.ra-wrap{width:100%;max-width:clamp(600px,44vw,700px);margin-inline:auto;padding:clamp(18px,3.4vw,28px) clamp(16px,4vw,24px) 16px}
.ra-head{padding-bottom:15px;border-bottom:1px solid var(--ra-border)}
.ra-eyebrow{display:flex;align-items:center;gap:8px;font-family:var(--ra-font-mono);font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--ra-muted-ink);margin-bottom:7px}
.ra-eyebrow-mark{width:6px;height:6px;border-radius:1px;background:color-mix(in oklch,var(--ra-fg) 42%,transparent);flex:none}
.ra-h1{font-family:var(--ra-font-display);font-size:20px;font-weight:600;line-height:1.25;letter-spacing:-.016em;margin-bottom:4px}
.ra-lede{color:var(--ra-muted-ink);font-size:12.5px;line-height:1.55}
.ra-row{padding-block:20px}
.ra-row+.ra-row{border-top:1px solid var(--ra-border)}
.ra-row-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start}
.ra-row-body{min-width:0}
.ra-row-title{font-size:14.5px;font-weight:600;letter-spacing:-.005em;line-height:1.4}
.ra-row-desc{margin-top:3px;font-size:13px;line-height:1.5;color:var(--ra-muted-ink)}
.ra-pill{display:inline-flex;align-items:center;gap:6px;height:23px;padding:0 9px;border-radius:6px;border:1px solid transparent;font-family:var(--ra-font-mono);font-size:11px;letter-spacing:.04em;white-space:nowrap;margin-top:1px}
.ra-pill .ra-dot{width:5px;height:5px;border-radius:50%;background:currentColor;flex:none}
.ra-pill[data-state="ok"]{background:var(--ra-accent-soft);border-color:var(--ra-accent-line);color:var(--ra-ok-ink)}
.ra-pill[data-state="checking"]{background:var(--ra-fg-soft);color:var(--ra-muted-ink)}
.ra-pill[data-state="checking"] .ra-dot{animation:ra-pulse 1.1s ease-in-out infinite}
.ra-pill[data-state="error"]{background:var(--ra-danger-soft);border-color:color-mix(in oklch,var(--ra-danger) 28%,transparent);color:var(--ra-danger-ink)}
.ra-pill[data-state="idle"]{background:var(--ra-fg-faint);border-color:var(--ra-border);color:var(--ra-muted-ink)}
.ra-pill[data-state="idle"] .ra-dot{background:color-mix(in oklch,var(--ra-fg) 32%,transparent)}
.ra-pill[data-state="set"]{background:var(--ra-fg-soft);border-color:color-mix(in oklch,var(--ra-fg) 16%,var(--ra-border));color:var(--ra-fg)}
@keyframes ra-pulse{0%,100%{opacity:.3}50%{opacity:1}}
.ra-addr-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:12px}
.ra-code{font-size:12.5px;line-height:1.5;color:var(--ra-fg);background:var(--ra-surface);border:1px solid var(--ra-border);border-radius:6px;padding:4px 8px;overflow-wrap:anywhere}
.ra-quiet{font-family:var(--ra-font-mono);font-size:12px;color:var(--ra-muted-ink)}
.ra-err-text{font-size:12.5px;line-height:1.5;color:var(--ra-danger-ink);flex:1 1 240px;min-width:0}
.ra-link{background:none;border:0;padding:3px 7px;margin:0;border-radius:6px;font-family:var(--ra-font-mono);font-size:11.5px;letter-spacing:.04em;color:var(--ra-muted-ink);transition:color .15s ease,background .15s ease}
.ra-link:hover{color:var(--ra-fg);background:var(--ra-fg-soft)}
.ra-link.is-flash{color:var(--ra-fg);background:var(--ra-fg-soft)}
.ra-link-end{margin-left:auto}
.ra-inline-link{color:var(--ra-fg);text-decoration:underline;text-decoration-color:color-mix(in oklch,var(--ra-fg) 42%,transparent);text-decoration-thickness:1px;text-underline-offset:2px;border-radius:3px}
.ra-link:focus-visible,.ra-switch:focus-visible,.ra-btn:focus-visible,.ra-input:focus-visible{outline:2px solid var(--ra-accent);outline-offset:2px}
.ra-switch{width:44px;height:44px;display:grid;place-items:center;padding:0;margin:-11px -4px -11px 0;border:0;background:none;border-radius:8px;flex:none}
.ra-switch .ra-track{width:42px;height:24px;border-radius:999px;background:color-mix(in oklch,var(--ra-fg) 12%,var(--ra-surface));border:1px solid var(--ra-border);display:block;position:relative;transition:background .18s ease,border-color .18s ease}
.ra-switch .ra-knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:var(--ra-knob);box-shadow:0 1px 2px color-mix(in oklch,var(--ra-fg) 22%,transparent);transition:transform .2s var(--ra-ease)}
.ra-switch:hover .ra-track{border-color:color-mix(in oklch,var(--ra-fg) 30%,var(--ra-border))}
.ra-switch[aria-checked="true"] .ra-track{background:var(--ra-accent);border-color:var(--ra-accent)}
.ra-switch[aria-checked="true"]:hover .ra-track{background:color-mix(in oklch,var(--ra-accent) 90%,var(--ra-fg))}
.ra-switch[aria-checked="true"] .ra-knob{transform:translateX(18px)}
.ra-switch[aria-disabled="true"]{cursor:not-allowed}
.ra-switch[aria-disabled="true"] .ra-track,.ra-switch[aria-disabled="true"]:hover .ra-track{background:var(--ra-fg-faint);border-color:var(--ra-border)}
.ra-switch[aria-disabled="true"] .ra-knob{box-shadow:none;background:color-mix(in oklch,var(--ra-fg) 26%,var(--ra-surface))}
.ra-note{margin-top:6px;padding:2px 6px;margin-inline-start:-6px;font-size:12.5px;line-height:1.5;color:var(--ra-muted-ink);border-radius:6px}
.ra-note.is-ok{color:var(--ra-fg);background:var(--ra-fg-soft)}
.ra-note.is-nudge{background:var(--ra-fg-soft)}
.ra-warn{display:flex;align-items:flex-start;gap:7px;margin-top:9px;font-size:12.5px;line-height:1.5;color:var(--ra-warn-ink)}
.ra-warn .ra-warn-mark{flex:none;width:14px;height:14px;margin-top:2px;display:grid;place-items:center;border-radius:3px;border:1px solid var(--ra-warn-line);background:var(--ra-warn-soft);font-size:10px;font-weight:600;line-height:1;color:var(--ra-warn-ink)}
.ra-expand{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .28s var(--ra-ease),opacity .2s ease}
.ra-expand.is-open{grid-template-rows:1fr;opacity:1}
.ra-expand-inner{overflow:hidden;min-height:0}
.ra-panel{margin-top:16px;background:var(--ra-surface);border:1px solid var(--ra-border);border-radius:var(--ra-radius-lg);padding:16px;box-shadow:var(--ra-panel-shadow)}
.ra-panel-body{display:grid;grid-template-columns:146px minmax(0,1fr);gap:18px;align-items:start}
.ra-qr-col{display:flex;flex-direction:column;gap:8px;min-width:0}
.ra-qr{width:100%;aspect-ratio:1/1;background:#fff;border:1px solid var(--ra-border);border-radius:var(--ra-radius);padding:4px;display:grid;place-items:center;color:var(--ra-muted-ink);font-size:10px;text-align:center;overflow:hidden}
.ra-qr img{width:100%;height:100%;display:block;object-fit:contain}
.ra-qr-cap{font-family:var(--ra-font-mono);font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ra-muted-ink);text-align:center}
.ra-fields{display:flex;flex-direction:column;gap:16px;min-width:0}
.ra-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.ra-field-label{display:flex;align-items:center;gap:6px;font-family:var(--ra-font-mono);font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ra-muted-ink)}
.ra-field-value{display:flex;align-items:center;gap:4px;min-width:0}
.ra-field-value .ra-value{font-size:12.5px;color:var(--ra-fg);background:var(--ra-inset);border:1px solid var(--ra-border);border-radius:6px;padding:4px 8px;overflow-wrap:anywhere;min-width:0}
.ra-field-value.is-stretch .ra-value{flex:1}
.ra-field-value .ra-value.is-plain{background:transparent;border-color:transparent;padding:4px 0 4px 8px;font-size:13px;letter-spacing:.06em}
.ra-saved{font-size:10px;color:var(--ra-fg);background:var(--ra-fg-soft);border-radius:4px;padding:1px 5px}
.ra-pw-edit{display:flex;flex-direction:column;gap:8px}
.ra-input{width:100%;font-family:var(--ra-font-mono);font-size:13px;color:var(--ra-fg);background:var(--ra-inset);border:1px solid var(--ra-border);border-radius:6px;padding:6px 9px;transition:border-color .15s ease,box-shadow .15s ease}
.ra-input:hover{border-color:color-mix(in oklch,var(--ra-fg) 26%,var(--ra-border))}
.ra-input:focus{outline:none;border-color:var(--ra-accent);box-shadow:0 0 0 3px var(--ra-accent-soft)}
.ra-input[aria-invalid="true"]{border-color:var(--ra-danger);box-shadow:0 0 0 3px var(--ra-danger-soft)}
.ra-pw-actions{display:flex;align-items:center;gap:8px}
.ra-field-hint{font-family:var(--ra-font-mono);font-size:10.5px;color:var(--ra-muted-ink);margin-right:auto}
.ra-field-err{font-size:12px;color:var(--ra-danger-ink)}
.ra-form{display:flex;flex-direction:column;gap:14px}
.ra-form-field{display:flex;flex-direction:column;gap:6px;min-width:0}
.ra-input-group{display:flex;align-items:center;min-width:0;background:var(--ra-inset);border:1px solid var(--ra-border);border-radius:6px}
.ra-input-group:hover{border-color:color-mix(in oklch,var(--ra-fg) 26%,var(--ra-border))}
.ra-input-group:focus-within{border-color:var(--ra-accent);box-shadow:0 0 0 3px var(--ra-accent-soft)}
.ra-input-group[data-invalid="true"]{border-color:var(--ra-danger);box-shadow:0 0 0 3px var(--ra-danger-soft)}
.ra-input-flat{flex:1 1 auto;min-width:0;height:34px;padding:0 4px 0 10px;border:0;background:none;font-family:var(--ra-font-mono);font-size:13px;color:var(--ra-fg)}
.ra-input-flat:focus{outline:none}
.ra-input-flat::placeholder{color:color-mix(in oklch,var(--ra-muted) 86%,var(--ra-fg))}
.ra-input-suffix{flex:none;padding-right:10px;font-family:var(--ra-font-mono);font-size:12px;color:var(--ra-muted-ink);user-select:none}
.ra-hint{font-family:var(--ra-font-mono);font-size:10.5px;line-height:1.5;color:var(--ra-muted-ink)}
.ra-form-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:2px}
.ra-alert{display:flex;align-items:baseline;gap:7px;padding:8px 10px;border-radius:7px;background:var(--ra-danger-soft);border:1px solid color-mix(in oklch,var(--ra-danger) 26%,transparent);font-size:12.5px;color:var(--ra-danger-ink)}
.ra-alert::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;flex:none;transform:translateY(-2px)}
.ra-btn{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 12px;border-radius:7px;border:1px solid var(--ra-border);background:var(--ra-raised);color:var(--ra-fg);font-size:12.5px;font-weight:500;transition:background .15s ease,border-color .15s ease;flex:none}
.ra-btn:hover{background:var(--ra-fg-faint);border-color:color-mix(in oklch,var(--ra-fg) 32%,var(--ra-border))}
.ra-btn:active{background:color-mix(in oklch,var(--ra-fg) 10%,var(--ra-raised))}
.ra-root .ra-btn-solid{background:var(--ra-fg);border-color:var(--ra-fg);color:var(--ra-surface)!important}
.ra-root .ra-btn-solid:hover{background:color-mix(in oklch,var(--ra-fg) 88%,var(--ra-bg));border-color:transparent}
.ra-root .ra-btn-solid:active{background:color-mix(in oklch,var(--ra-fg) 80%,var(--ra-bg));border-color:transparent}
@container ra (max-width:560px){.ra-panel-body{grid-template-columns:1fr;gap:18px}.ra-qr-col{flex-direction:column;align-items:center;gap:9px}.ra-qr{width:min(240px,100%);flex:none;padding:10px;border-radius:10px}.ra-qr-cap{text-align:center}}
@container ra (max-width:520px){.ra-h1{font-size:19px}.ra-input-flat{font-size:16px}.ra-input-suffix{font-size:11.5px;padding-right:8px}.ra-addr-row{gap:4px 8px}.ra-code{font-size:12px}.ra-field-hint{display:none}.ra-pw-actions{justify-content:flex-end}.ra-input{font-size:16px}}
@media (pointer:coarse){.ra-btn{height:40px;padding-inline:14px}.ra-link{display:inline-flex;align-items:center;min-height:44px;padding:0 8px}.ra-field-value .ra-link{min-height:40px}.ra-input-group .ra-link{min-height:40px}.ra-input-flat{height:40px}}
@container ra (max-width:380px){.ra-pill{font-size:10.5px;padding:0 7px}.ra-btn{padding-inline:10px}}
@media (prefers-reduced-motion:reduce){.ra-root *,.ra-root *::before,.ra-root *::after{transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}
`;

    /* ═══ 工具 ═══ */
    var PW_RE = /^[A-Za-z0-9_-]{8,24}$/;
    var DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
    var TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /* ═══ DSH 主题检测：跟随宿主深/浅色 ═══ */
    function useDshTheme() {
      var themeSt = React.useState('light');
      var theme = themeSt[0]; var setTheme = themeSt[1];

      React.useEffect(function() {
        var detect = function() {
          // 1) DSH 的 data-theme 属性
          var el = document.documentElement || document.body;
          var dt = el.getAttribute && (el.getAttribute('data-theme') || el.getAttribute('data-color-mode'));
          if (dt === 'dark') return setTheme('dark');
          if (dt === 'light') return setTheme('light');
          // 2) CSS color-scheme 属性（DSH 设置了它跟随主题）
          try {
            var cs = getComputedStyle(el).colorScheme || '';
            if (cs.includes('dark')) return setTheme('dark');
            if (cs.includes('light')) return setTheme('light');
          } catch(e) {}
          // 3) prefers-color-scheme
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return setTheme('dark');
          }
          setTheme('light');
        };
        detect();
        // 监听系统主题变化
        var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        if (mq && mq.addEventListener) mq.addEventListener('change', detect);
        // 监听 DOM 属性变化（DSH 切换主题时改属性）
        var observer = new MutationObserver(detect);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-color-mode', 'class', 'style'] });
        return function() {
          if (mq && mq.removeEventListener) mq.removeEventListener('change', detect);
          observer.disconnect();
        };
      }, []);

      return theme;
    }

    function normaliseDomain(v) {
      return String(v || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase()
        .replace(/^https?:\/\//, '').replace(/\/.*$/, '')
        .replace(/\.duckdns\.org\.?$/, '').replace(/\.+$/, '');
    }
    function normaliseToken(v) {
      var t = String(v || '').normalize('NFKC').replace(/\s+/g, '')
        .replace(/^["'`]|["'`]$/g, '').toLowerCase();
      if (/^[0-9a-f]{32}$/.test(t)) {
        t = t.slice(0,8)+'-'+t.slice(8,12)+'-'+t.slice(12,16)+'-'+t.slice(16,20)+'-'+t.slice(20);
      }
      return t;
    }
    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function(){});
      }
      return Promise.resolve();
    }

    /* ═══ 小组件 ═══ */
    function Pill(props) {
      return h('span', {className:'ra-pill','data-state':props.state,role:'status'},
        h('i',{className:'ra-dot'}), h('span',null,props.children));
    }
    function CopyButton(props) {
      var feedback = React.useState('');
      var fb = feedback[0]; var setFb = feedback[1];
      var timer = React.useRef(0);
      React.useEffect(function(){ return function(){ clearTimeout(timer.current); }; },[]);
      return h('button',{type:'button',className:'ra-link'+(fb?' is-flash':''),
        onClick:function(){
          copyText(props.getText()).then(function(){setFb('已复制');clearTimeout(timer.current);timer.current=setTimeout(function(){setFb('');},1500);},
          function(){setFb('复制失败');clearTimeout(timer.current);timer.current=setTimeout(function(){setFb('');},1500);});
        }}, fb || '复制');
    }
    function Switch(props) {
      return h('button',{type:'button',role:'switch',className:'ra-switch',
        'aria-checked':props.checked?'true':'false','aria-disabled':props.disabled?'true':'false',
        'aria-labelledby':props.titleId,'aria-controls':props.panelId,
        onClick:props.onToggle},
        h('span',{className:'ra-track'},h('span',{className:'ra-knob'})));
    }
    function Expand(props) {
      return h('div',{className:'ra-expand'+(props.open?' is-open':'')},
        h('div',{className:'ra-expand-inner'},props.children));
    }
    function WarnLine(props) {
      return h('p',{className:'ra-warn'},
        h('span',{className:'ra-warn-mark','aria-hidden':'true'},'!'),
        h('span',{className:'ra-warn-text'},props.text));
    }

    /* ═══ 密码编辑器 ═══ */
    function PasswordField(props) {
      var st = React.useState({editing:false,draft:props.value,invalid:false});
      var s = st[0]; var setS = st[1];
      var savedT = React.useRef(0);
      var savedSt = React.useState(false);
      var showSaved = savedSt[0]; var fireSaved = savedSt[1];
      var inputRef = React.useRef(null);

      React.useEffect(function(){
        if (s.editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
      },[s.editing]);
      React.useEffect(function(){ return function(){ clearTimeout(savedT.current); }; },[]);

      var commit = function() {
        var next = s.draft.trim();
        if (!PW_RE.test(next)) { setS(function(p){return Object.assign({},p,{invalid:true});}); return; }
        setS({editing:false,draft:next,invalid:false});
        if (props.onSave) props.onSave(next);
        fireSaved(true); clearTimeout(savedT.current);
        savedT.current = setTimeout(function(){ fireSaved(false); },2400);
      };

      if (!s.editing) {
        return h('div',{className:'ra-field'},
          h('span',{className:'ra-field-label'},'访问密码', showSaved?h('span',{className:'ra-saved'},'已保存'):null),
          h('div',{className:'ra-field-value'},
            h('code',{className:'ra-value is-plain'},props.value),
            h('button',{type:'button',className:'ra-link ra-link-end',
              onClick:function(){ setS({editing:true,draft:props.value,invalid:false}); }},'自定义')));
      }
      return h('div',{className:'ra-field'},
        h('span',{className:'ra-field-label'},'访问密码', showSaved?h('span',{className:'ra-saved'},'已保存'):null),
        h('div',{className:'ra-pw-edit'},
          h('input',{className:'ra-input',type:'text',value:s.draft,maxLength:24,
            spellCheck:false,autoComplete:'off',ref:inputRef,
            'aria-invalid':s.invalid?'true':'false',
            onChange:function(e){ var v=e.target.value; setS(function(p){return Object.assign({},p,{draft:v,invalid:p.invalid&&!PW_RE.test(v)});}); },
            onKeyDown:function(e){ if(e.key==='Enter'){e.preventDefault();commit();} if(e.key==='Escape'){e.preventDefault();setS({editing:false,draft:props.value,invalid:false});} }}),
          h('div',{className:'ra-pw-actions'},
            h('span',{className:'ra-field-hint'},'8–24 位 · 字母 数字 - _'),
            h('button',{type:'button',className:'ra-btn',onClick:function(){setS({editing:false,draft:props.value,invalid:false});}},'取消'),
            h('button',{type:'button',className:'ra-btn ra-btn-solid',onClick:commit},'保存')),
          s.invalid?h('p',{className:'ra-field-err'},'至少 8 位，仅支持字母、数字、- 和 _'):null));
    }

    /* ═══ 连接面板 ═══ */
    function ConnectorPanel(props) {
      return h('div',{className:'ra-panel',id:props.panelId},
        h('div',{className:'ra-panel-body'},
          h('div',{className:'ra-qr-col'},
            h('div',{className:'ra-qr'}, props.qrDataUrl
              ? h('img',{src:props.qrDataUrl,alt:'扫码连接'})
              : (props.emptyQrLabel||'等待地址')),
            h('p',{className:'ra-qr-cap'},'扫码连接')),
          h('div',{className:'ra-fields'},
            h('div',{className:'ra-field'},
              h('span',{className:'ra-field-label'},'地址'),
              h('div',{className:'ra-field-value is-stretch'},
                h('code',{className:'ra-value'},props.url||'—'),
                props.url?h(CopyButton,{getText:function(){return props.url;}}):null)),
            h(PasswordField,{value:props.password,onSave:props.onSavePassword}))));
    }

    function ConnectorSection(props) {
      var uid = React.useId();
      var titleId = 'ra-'+uid+'-title';
      var panelId = 'ra-'+uid+'-panel';
      var nudgeT = React.useRef(0);
      var nudgeSt = React.useState(false);
      var nudging = nudgeSt[0]; var fireNudge = nudgeSt[1];
      React.useEffect(function(){ return function(){ clearTimeout(nudgeT.current); }; },[]);

      // gate 只阻止"打开"，"关闭"始终允许
      var gateActive = props.gate && props.gate.active && !props.desired;

      return h('section',{className:'ra-row'},
        h('div',{className:'ra-row-head'},
          h('div',{className:'ra-row-body'},
            h('h2',{className:'ra-row-title',id:titleId},props.title),
            h('p',{className:'ra-row-desc'},props.description),
            props.warn?h(WarnLine,{text:props.warn}):null,
            props.gate&&props.gate.active&&!props.desired?h('p',{className:'ra-note'+(nudging?' is-nudge':'')},props.gate.message):null,
            props.readyNote?h('p',{className:'ra-note is-ok',role:'status'},props.readyNote):null),
          h(Switch,{titleId:titleId,panelId:panelId,checked:props.open,
            disabled:gateActive,
            onToggle:function(){
              if(gateActive){fireNudge(true);clearTimeout(nudgeT.current);nudgeT.current=setTimeout(function(){fireNudge(false);},900);return;}
              props.onToggle(!props.desired);
            }})),
        h(Expand,{open:props.open},
          h(ConnectorPanel,{panelId:panelId,url:props.url,
            password:props.password,onSavePassword:props.onSavePassword,
            qrDataUrl:props.qrDataUrl,emptyQrLabel:props.emptyQrLabel})));
    }

    /* ═══ IPv6 行 ═══ */
    function Ipv6Section(props) {
      var uid = React.useId();
      var text = props.status==='ok'?'已获取':props.status==='checking'?'检测中':'获取失败';
      return h('section',{className:'ra-row'},
        h('div',{className:'ra-row-head'},
          h('div',{className:'ra-row-body'},
            h('h2',{className:'ra-row-title',id:'ra-'+uid+'-ipv6'},'IPv6 地址'),
            h('p',{className:'ra-row-desc'},'外网设备访问本机所需的公网地址。')),
          h(Pill,{state:props.status},text)),
        props.status==='ok'?h('div',{className:'ra-addr-row'},
          h('code',{className:'ra-code'},props.address),
          h(CopyButton,{getText:function(){return props.address;}}),
          h('button',{type:'button',className:'ra-link ra-link-end',onClick:props.onRetry},'重新检测')):null,
        props.status==='checking'?h('div',{className:'ra-addr-row'},
          h('span',{className:'ra-quiet'},'正在向网络请求 IPv6 前缀…')):null,
        props.status==='error'?h('div',{className:'ra-addr-row'},
          h('span',{className:'ra-err-text'},'未检测到全局 IPv6 地址，外网设备暂时无法访问本机。'),
          h('button',{type:'button',className:'ra-link',onClick:props.onRetry},'重新检测')):null);
    }

    /* ═══ 域名表单 ═══ */
    function DomainSection(props) {
      var uid = React.useId();
      var domainId='ra-'+uid+'-dn'; var tokenId='ra-'+uid+'-tk';
      return h('section',{className:'ra-row'},
        h('div',{className:'ra-row-head'},
          h('div',{className:'ra-row-body'},
            h('h2',{className:'ra-row-title'},'域名'),
            h('p',{className:'ra-row-desc'},'用 DuckDNS 把当前 IPv6 地址映射成固定域名，',
              h('a',{className:'ra-inline-link',href:'https://www.duckdns.org',target:'_blank',rel:'noopener noreferrer'},'新注册点这里'),'。')),
          h(Pill,{state:props.host?'set':'idle'},props.host?'已设置':'未设置')),
        !props.editing?h('div',{className:'ra-addr-row'},
          props.host?h('code',{className:'ra-code'},props.host):null,
          props.saved?h('span',{className:'ra-saved'},'已保存'):null,
          h('button',{type:'button',className:'ra-btn ra-link-end',onClick:props.onOpen},props.host?'修改':'配置')):null,
        props.domainStatus==='configuring'?h('div',{className:'ra-addr-row'},
          h('span',{className:'ra-quiet'},'正在配置域名（DDNS + 证书签发）…')):null,
        props.domainStatus==='error'?h('div',{className:'ra-addr-row'},
          h('span',{className:'ra-err-text'},'配置失败：'+(props.domainError||'未知错误')),
          h('button',{type:'button',className:'ra-link',onClick:props.onOpen},'重试')):null,
        h(Expand,{open:props.editing},
          h('div',{className:'ra-panel'},
            h('form',{className:'ra-form',noValidate:true,
              onSubmit:function(e){e.preventDefault();props.onSubmit();}},
              h('div',{className:'ra-form-field'},
                h('label',{className:'ra-field-label',htmlFor:domainId},'DuckDNS 域名'),
                h('div',{className:'ra-input-group','data-invalid':props.errors.name?'true':'false'},
                  h('input',{className:'ra-input-flat',id:domainId,type:'text',value:props.draft.name,
                    placeholder:'your-name',maxLength:96,spellCheck:false,autoComplete:'off',autoCapitalize:'none',
                    onChange:function(e){props.onChangeDraft('name',e.target.value);}}),
                  h('span',{className:'ra-input-suffix'},'.duckdns.org')),
                h('p',{className:'ra-hint'},'子域名，只填前半段'),
                props.errors.name?h('p',{className:'ra-field-err'},'域名格式不正确'):null),
              h('div',{className:'ra-form-field'},
                h('label',{className:'ra-field-label',htmlFor:tokenId},'DuckDNS Token'),
                h('div',{className:'ra-input-group','data-invalid':props.errors.token?'true':'false'},
                  h('input',{className:'ra-input-flat',id:tokenId,type:props.revealed?'text':'password',
                    value:props.draft.token,placeholder:'00000000-…',maxLength:64,
                    spellCheck:false,autoComplete:'off',autoCapitalize:'none',
                    onChange:function(e){props.onChangeDraft('token',e.target.value);}}),
                  h('button',{type:'button',className:'ra-link','aria-pressed':props.revealed?'true':'false',
                    onClick:props.onToggleReveal},props.revealed?'隐藏':'显示')),
                h('p',{className:'ra-hint'},'36 位 UUID · 在 DuckDNS 账户页复制'),
                props.errors.token?h('p',{className:'ra-field-err'},'Token 应为 36 位 UUID 格式'):null),
              props.alert?h('p',{className:'ra-alert',role:'alert'},props.alert):null,
              h('div',{className:'ra-form-actions'},
                h('button',{type:'button',className:'ra-btn',onClick:props.onCancel},'取消'),
                h('button',{type:'submit',className:'ra-btn ra-btn-solid'},'保存'))))));
    }

    /* ═══ 主组件：数据对接层 ═══ */
    function GateSettingsTab(props) {
      var st = React.useState({loading:true, error:'', data:null});
      var s = st[0]; var setS = st[1];
      var httpOnSt = React.useState(false); var httpOn = httpOnSt[0]; var setHttpOn = httpOnSt[1];
      var httpsOnSt = React.useState(false); var httpsOn = httpsOnSt[0]; var setHttpsOn = httpsOnSt[1];
      var httpPwSt = React.useState(''); var httpPw = httpPwSt[0]; var setHttpPw = httpPwSt[1];
      var httpsPwSt = React.useState(''); var httpsPw = httpsPwSt[0]; var setHttpsPw = httpsPwSt[1];
      var domainNameSt = React.useState(''); var domainName = domainNameSt[0]; var setDomainName = domainNameSt[1];
      var dEditSt = React.useState(false); var dEdit = dEditSt[0]; var setDEdit = dEditSt[1];
      var dDraftSt = React.useState({name:'',token:''}); var dDraft = dDraftSt[0]; var setDDraft = dDraftSt[1];
      var dErrorsSt = React.useState({name:false,token:false}); var dErrors = dErrorsSt[0]; var setDErrors = dErrorsSt[1];
      var dAlertSt = React.useState(''); var dAlert = dAlertSt[0]; var setDAlert = dAlertSt[1];
      var dRevealSt = React.useState(false); var dReveal = dRevealSt[0]; var setDReveal = dRevealSt[1];
      var dSavedT = React.useRef(0);
      var dSavedSt = React.useState(false); var dSaved = dSavedSt[0]; var fireDSaved = dSavedSt[1];
      var checkingSt = React.useState(false); var checking = checkingSt[0]; var setChecking = checkingSt[1];

      var refresh = React.useCallback(function() {
        return fetch('/__gate-config').then(function(r){return r.json();}).then(function(d){
          setS({loading:false,error:'',data:d});
          if (d.http) { setHttpOn(Boolean(d.http.enabled)); setHttpPw(d.http.password||''); }
          if (d.https) { setHttpsOn(Boolean(d.https.enabled)); setHttpsPw(d.https.password||''); }
          if (d.domain) setDomainName(d.domain.name||'');
        }).catch(function(e){
          setS(function(p){return Object.assign({},p,{loading:false,error:e.message||'加载失败'});});
        });
      },[]);

      React.useEffect(function(){
        refresh();
        var t = setInterval(refresh, 15000);
        return function(){ clearInterval(t); };
      },[refresh]);

      var post = function(action, extra) {
        return fetch('/__gate-config',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify(Object.assign({action:action},extra||{}))
        }).then(function(r){return r.json();});
      };

      if (s.loading) {
        return h('div',{className:'ra-root'},h('style',null,CSS),
          h('div',{className:'ra-wrap'},h('p',{style:{color:'var(--ra-muted-ink)',padding:'24px 0'}},'加载中…')));
      }
      if (s.error) {
        return h('div',{className:'ra-root'},h('style',null,CSS),
          h('div',{className:'ra-wrap'},h('p',{style:{color:'var(--ra-danger-ink)',padding:'24px 0'}},'加载失败：'+s.error)));
      }

      var d = s.data || {};
      var ipv6Status = checking ? 'checking' : (d.ipv6 ? 'ok' : 'error');
      var v6ok = Boolean(d.ipv6);
      var domainHost = (d.domain && d.domain.host) || (domainName ? domainName+'.duckdns.org' : '');
      var hasDomain = Boolean(domainName);
      var httpOpen = v6ok && httpOn;
      var httpsOpen = v6ok && hasDomain && httpsOn;
      var httpUrl = d.http ? d.http.url : '';
      var httpsUrl = d.https ? d.https.url : '';
      var domainStatus = d.domain ? d.domain.status : '';

      var httpGate = !v6ok ? {active:true,message:checking?'正在检测 IPv6 地址…':'未获取到 IPv6 地址。'} : {active:false};
      var httpsGate = !v6ok ? {active:true,message:checking?'正在检测 IPv6 地址…':'未获取到 IPv6 地址。'}
        : !hasDomain ? {active:true,message:'尚未设置域名，先配置域名后才能开启。'}
        : domainStatus === 'configuring' ? {active:true,message:'正在配置域名（DDNS + 证书签发）…完成后即可开启。'}
        : domainStatus === 'error' ? {active:true,message:'域名配置失败，请修改后重试。'}
        : !d.https || !d.https.hasCert ? {active:true,message:'证书尚未就绪。'}
        : {active:false};

      var openDomain = function(){
        setDDraft({name:domainName,token:(d.domain&&d.domain.token)||''});
        setDErrors({name:false,token:false}); setDAlert(''); setDReveal(false); setDEdit(true);
      };
      var commitDomain = function(){
        var name = normaliseDomain(dDraft.name);
        var token = normaliseToken(dDraft.token);
        var nameOK = DOMAIN_RE.test(name);
        var tokenOK = TOKEN_RE.test(token);
        setDErrors({name:!nameOK,token:!tokenOK});
        if (!nameOK||!tokenOK) {
          setDAlert(!nameOK&&!tokenOK?'域名和 Token 都需要修正':!nameOK?'域名格式不正确':'Token 格式不正确');
          return;
        }
        setDomainName(name); setDEdit(false); setDAlert(''); fireDSaved(true);
        clearTimeout(dSavedT.current); dSavedT.current=setTimeout(function(){fireDSaved(false);},2400);
        post('setDomain',{name:name,token:token}).then(refresh);
      };

      var dshTheme = useDshTheme();

      return h('div',{className:'ra-root','data-theme':dshTheme},h('style',null,CSS),
        h('div',{className:'ra-wrap'},
          h('header',{className:'ra-head'},
            h('p',{className:'ra-eyebrow'},h('span',{className:'ra-eyebrow-mark'}),'手机 IPv6 远程访问'),
            h('h1',{className:'ra-h1'},'远程访问'),
            h('p',{className:'ra-lede'},'允许手机或其他设备通过 IPv6 访问本机。修改即时生效，仅保存在本机。')),
          h('div',null,
            h(Ipv6Section,{status:ipv6Status,address:d.ipv6||'',
              onRetry:function(){setChecking(true);post('recheckIpv6').then(function(){setTimeout(function(){setChecking(false);refresh();},1500);});}}),
            h(ConnectorSection,{title:'HTTP 连接',
              description:'在局域网内启动明文 Web 服务。',
              warn:'HTTP 是明文传输，密码与数据可能被截获。建议改用 HTTPS。',
              gate:httpGate,readyNote:null,desired:httpOn,open:httpOpen,
              onToggle:function(on){setHttpOn(on);post('toggleHttp',{enabled:on}).then(refresh);},
              url:httpUrl,password:httpPw,qrDataUrl:d.httpQr||'',emptyQrLabel:'等待地址',
              onSavePassword:function(pw){setHttpPw(pw);post('setHttpPassword',{password:pw});}}),
            h(DomainSection,{host:domainHost,editing:dEdit,draft:dDraft,errors:dErrors,alert:dAlert,
              saved:dSaved,revealed:dReveal,domainStatus:domainStatus,
              domainError:d.domain?d.domain.error:'',
              onOpen:openDomain,
              onCancel:function(){setDEdit(false);setDErrors({name:false,token:false});setDAlert('');},
              onSubmit:commitDomain,
              onChangeDraft:function(f,v){setDDraft(function(p){var n=Object.assign({},p);n[f]=v;return n;});setDAlert('');
                setDErrors(function(p){var n=Object.assign({},p);n[f]=false;return n;});},
              onToggleReveal:function(){setDReveal(function(p){return !p;});}}),
            h(ConnectorSection,{title:'HTTPS 连接',
              description:'用域名访问加密通道，地址固定指向 DuckDNS 域名。',
              warn:null,gate:httpsGate,
              readyNote:domainStatus==='ok'&&hasDomain?'域名已就绪，可以开启 HTTPS。':null,
              desired:httpsOn,open:httpsOpen,
              onToggle:function(on){setHttpsOn(on);post('toggleHttps',{enabled:on}).then(refresh);},
              url:httpsUrl,password:httpsPw,qrDataUrl:d.httpsQr||'',emptyQrLabel:'等待域名',
              onSavePassword:function(pw){setHttpsPw(pw);post('setHttpsPassword',{password:pw});}}))));
    }

    /* ═══ apply ═══ */
    function apply(ctx) {
      try {
        if (ctx && ctx.slots && typeof ctx.slots.inject === 'function') {
          ctx.slots.inject('settings.section', function() {
            return ctx.slots.register({
              name: 'settings.section',
              id: 'dsh-ipv6-gate',
              order: 50,
              label: function() { return '手机 IPv6 远程访问'; }
            }, GateSettingsTab);
          });
        }
      } catch (e) { /* 静默失败 */ }
    }

    module.exports = { apply: apply, inject: ['slots'] };
    return module.exports;
  }
});
