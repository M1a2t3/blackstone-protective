/**
 * cms-fetch.js
 * Fetches JSON data from /data/ and populates DOM via data-cms-* attributes.
 *
 * Attribute API:
 *   data-cms-src="global"          → fetches /data/global.json
 *   data-cms-bind="site_name"      → sets element.textContent
 *   data-cms-html="footer_tagline" → sets element.innerHTML
 *   data-cms-attr="src:logo_image" → sets element.setAttribute('src', val)
 *   data-cms-bg="hero_image"       → sets element.style.backgroundImage
 *   data-cms-repeat="services"     → clones template for each array item
 *   data-cms-template              → marks the child template inside a repeat
 *
 * Path syntax: use dot notation, e.g. "hero.title_line1"
 */

const CMS = (() => {
  const _cache = {};

  const _fetch = async (name) => {
    if (_cache[name]) return _cache[name];
    try {
      const res = await fetch(`/data/${name}.json?v=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _cache[name] = data;
      return data;
    } catch (e) {
      console.warn(`[CMS] Could not load /data/${name}.json`, e);
      return null;
    }
  };

  const _get = (obj, path) => {
    if (!obj || !path) return undefined;
    return path.split('.').reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
  };

  const _renderText = (el, val) => {
    if (val == null) return;
    el.textContent = String(val);
    el.classList.remove('skeleton');
  };

  const _renderHtml = (el, val) => {
    if (val == null) return;
    el.innerHTML = String(val);
    el.classList.remove('skeleton');
  };

  const _renderAttr = (el, spec, val) => {
    if (val == null) return;
    const [attr] = spec.split(':');
    el.setAttribute(attr, String(val));
    el.classList.remove('skeleton');
  };

  const _renderBg = (el, val) => {
    if (val == null) return;
    el.style.backgroundImage = `url('${val}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.classList.remove('skeleton');
  };

  const _renderRepeat = (el, items, tplEl) => {
    if (!Array.isArray(items)) return;
    // Remove existing clones (not the template itself)
    [...el.children].forEach(c => { if (c !== tplEl) c.remove(); });
    items.forEach((item, i) => {
      const clone = tplEl.cloneNode(true);
      clone.removeAttribute('data-cms-template');
      clone.style.display = '';
      // Bind child elements within clone
      clone.querySelectorAll('[data-cms-item]').forEach(child => {
        const field = child.getAttribute('data-cms-item');
        const fieldAttr = child.getAttribute('data-cms-item-attr');
        const val = _get(item, field);
        if (fieldAttr) {
          const [attr] = fieldAttr.split(':');
          child.setAttribute(attr, String(val ?? ''));
        } else {
          child.textContent = String(val ?? '');
        }
      });
      // Also bind data-cms-item-html
      clone.querySelectorAll('[data-cms-item-html]').forEach(child => {
        const field = child.getAttribute('data-cms-item-html');
        const val = _get(item, field);
        child.innerHTML = String(val ?? '');
      });
      // Set a data-index for CSS animations
      clone.setAttribute('data-index', i);
      clone.classList.add('fade-up', `delay-${Math.min(i % 4, 3) + 1}`);
      el.appendChild(clone);
    });
    tplEl.style.display = 'none';
  };

  const _bindAll = async (scope = document) => {
    // Gather all container sources declared in this scope
    const sources = new Set();
    scope.querySelectorAll('[data-cms-src]').forEach(el => sources.add(el.getAttribute('data-cms-src')));

    // Fetch all needed JSON files
    const dataMap = {};
    await Promise.all([...sources].map(async name => {
      dataMap[name] = await _fetch(name);
    }));

    // Apply bindings
    scope.querySelectorAll('[data-cms-src]').forEach(container => {
      const src = container.getAttribute('data-cms-src');
      const data = dataMap[src];
      if (!data) return;

      // Bind direct children and nested elements
      const bind = (el, ctx) => {
        if (el.hasAttribute('data-cms-bind')) {
          const val = _get(ctx, el.getAttribute('data-cms-bind'));
          _renderText(el, val);
        }
        if (el.hasAttribute('data-cms-html')) {
          const val = _get(ctx, el.getAttribute('data-cms-html'));
          _renderHtml(el, val);
        }
        if (el.hasAttribute('data-cms-attr')) {
          const spec = el.getAttribute('data-cms-attr');
          const [, path] = spec.split(':');
          const val = _get(ctx, path);
          _renderAttr(el, spec, val);
        }
        if (el.hasAttribute('data-cms-bg')) {
          const val = _get(ctx, el.getAttribute('data-cms-bg'));
          _renderBg(el, val);
        }
        if (el.hasAttribute('data-cms-repeat')) {
          const items = _get(ctx, el.getAttribute('data-cms-repeat'));
          const tpl = el.querySelector('[data-cms-template]');
          if (tpl) _renderRepeat(el, items, tpl);
        }
      };

      // Walk all elements inside this cms-src container
      bind(container, data);
      container.querySelectorAll('*').forEach(el => bind(el, data));
    });

    // Trigger fade-in observer after render
    _observeFade(scope);
  };

  const _observeFade = (scope = document) => {
    if (!('IntersectionObserver' in window)) {
      scope.querySelectorAll('.fade-up').forEach(el => el.classList.add('in-view'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); } });
    }, { threshold: 0.12 });
    scope.querySelectorAll('.fade-up').forEach(el => obs.observe(el));
  };

  return { fetch: _fetch, get: _get, bindAll: _bindAll, observeFade: _observeFade };
})();
