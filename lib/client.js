// dsh-ipv6-gate 客户端 bundle —— 注册设置页「手机访问」分区
// 格式要求（2026-11-04 两次崩溃教训）：
//   1. 必须是 window.__ModuleLoader__.load({id, factory}) 的普通脚本（不是 ESM）
//   2. factory 必须返回带 apply 方法的对象
//   3. apply 内任何异常都不能抛出
window.__ModuleLoader__.load({
  id: "dsh-ipv6-gate",
  factory: (require) => {
    var React = require("react");
    var h = React.createElement;
    var module = { exports: {} };

    // ── 设置页组件：显示当前端口 + 修改输入框 ──
    function GateSettingsTab(props) {
      // props.close = 关闭设置面板（由设置外壳注入）
      var state = React.useState({ loading: true, port: 0, saving: false, message: '', error: '' });
      var data = state[0];
      var setData = state[1];
      var inputRef = React.useRef(null);

      React.useEffect(function() {
        fetch('/__gate-config')
          .then(function(r) { return r.json(); })
          .then(function(cfg) {
            setData({ loading: false, port: cfg.port, saving: false, message: '', error: '' });
          })
          .catch(function(e) {
            setData({ loading: false, port: 0, saving: false, message: '', error: '加载失败: ' + (e.message || e) });
          });
      }, []);

      function handleSave() {
        var newPort = parseInt(inputRef.current ? inputRef.current.value : data.port, 10);
        if (isNaN(newPort) || newPort < 1 || newPort > 65535) {
          setData(function(prev) { return Object.assign({}, prev, { message: '', error: '端口号必须是 1-65535 的整数' }); });
          return;
        }
        setData(function(prev) { return Object.assign({}, prev, { saving: true, message: '', error: '' }); });
        fetch('/__gate-config', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ port: newPort })
        })
          .then(function(r) { return r.json(); })
          .then(function(res) {
            setData(function(prev) {
              return Object.assign({}, prev, {
                saving: false,
                message: res.port || '已保存',
                error: res.ok === false ? (res.error || '保存失败') : ''
              });
            });
          })
          .catch(function(e) {
            setData(function(prev) {
              return Object.assign({}, prev, { saving: false, message: '', error: '保存失败: ' + (e.message || e) });
            });
          });
      }

      if (data.loading) {
        return h('div', { style: { padding: '24px', color: '#6b7280' } }, '加载中…');
      }

      return h('div', { style: { padding: '16px', fontFamily: 'system-ui, sans-serif' } },
        h('h3', { style: { margin: '0 0 16px', fontSize: '15px', fontWeight: 600 } }, 'IPv6 远程访问网关'),
        // 状态行
        h('div', { style: { marginBottom: '16px', fontSize: '13px', color: '#374151' } },
          '当前端口：', h('strong', { style: { color: '#111827' } }, String(data.port)),
          data.message
            ? h('span', { style: { marginLeft: '12px', color: '#059669', fontSize: '12px' } }, '✓ ' + data.message)
            : null,
          data.error
            ? h('span', { style: { marginLeft: '12px', color: '#dc2626', fontSize: '12px' } }, '✗ ' + data.error)
            : null
        ),
        // 输入行
        h('div', { style: { display: 'flex', gap: '8px', marginBottom: '12px' } },
          h('input', {
            ref: inputRef,
            type: 'number',
            defaultValue: data.port,
            min: 1,
            max: 65535,
            placeholder: '输入新端口号',
            style: {
              flex: 1, padding: '8px 12px', border: '1px solid #d1d5db',
              borderRadius: '6px', fontSize: '14px', outline: 'none',
              focusBorderColor: '#2563eb'
            }
          }),
          h('button', {
            onClick: handleSave,
            disabled: data.saving,
            style: {
              padding: '8px 20px', border: 'none', borderRadius: '6px',
              backgroundColor: data.saving ? '#93c5fd' : '#2563eb',
              color: '#fff', fontSize: '14px', fontWeight: 500,
              cursor: data.saving ? 'not-allowed' : 'pointer'
            }
          }, data.saving ? '保存中…' : '保存')
        ),
        h('p', { style: { margin: 0, fontSize: '12px', color: '#9ca3af' } },
          '修改端口后需要重启 DSH 才能生效。'
        )
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
              label: function() { return '手机访问'; }
            }, GateSettingsTab);
          });
        }
      } catch (e) {
        // 静默失败，绝不炸宿主
      }
    }

    module.exports = { apply: apply };
    return module.exports;
  }
});
