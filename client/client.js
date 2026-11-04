// dsh-ipv6-gate 客户端 bundle —— 注册设置页「手机 IPv6 远程访问」分区
// 格式要求（2026-11-04 两次崩溃教训）：
//   1. 必须是 window.__ModuleLoader__.load({id, factory}) 的普通脚本（不是 ESM）
//   2. factory 必须返回带 apply 方法的对象
//   3. apply 内任何异常都不能抛出
//   4. 模块导出的 inject 用短服务名（"slots"），不是包名（dsh-pocket 同款）
window.__ModuleLoader__.load({
  id: "dsh-ipv6-gate",
  factory: (require) => {
    var React = require("react");
    var h = React.createElement;
    var module = { exports: {} };

    // ── 设置页组件：标题 + IPv6 地址状态 ──
    function GateSettingsTab(props) {
      var state = React.useState({ status: 'loading', address: '', error: '' });
      var data = state[0];
      var setData = state[1];

      React.useEffect(function() {
        fetch('/__gate-config')
          .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(function(cfg) {
            if (cfg.ipv6) {
              setData({ status: 'ok', address: cfg.ipv6, error: '' });
            } else {
              setData({ status: 'fail', address: '', error: cfg.ipv6Error || '获取 IPv6 地址失败' });
            }
          })
          .catch(function(e) {
            setData({ status: 'fail', address: '', error: '请求失败: ' + (e.message || e) });
          });
      }, []);

      var statusNode;
      if (data.status === 'loading') {
        statusNode = h('span', { style: { color: '#9ca3af', fontSize: '14px' } }, '正在获取 IPv6 地址…');
      } else if (data.status === 'ok') {
        statusNode = h('span', {
          style: {
            color: '#059669', fontSize: '14px', fontWeight: 600,
            fontFamily: 'monospace', wordBreak: 'break-all'
          }
        }, data.address);
      } else {
        statusNode = h('span', { style: { color: '#dc2626', fontSize: '14px' } },
          '获取 IPv6 地址失败' + (data.error ? '（' + data.error + '）' : ''));
      }

      return h('div', { style: { padding: '16px', fontFamily: 'system-ui, sans-serif' } },
        h('h3', { style: { margin: '0 0 16px', fontSize: '15px', fontWeight: 600 } }, '手机 IPv6 远程访问'),
        statusNode
      );
    }

    // ── 插件 apply：注册 settings.section 槽位 ──
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
      } catch (e) {
        // 静默失败，绝不炸宿主
      }
    }

    module.exports = { apply: apply, inject: ['slots'] };
    return module.exports;
  }
});
