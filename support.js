/*!
 * support.js — compatibility shim for the "Design Component" (.dc.html) prototype format.
 *
 * This is a reconstruction, not the original prototyping tool's runtime (which was not
 * included in the design handoff). It implements just enough of the observed template
 * language to make the six .dc.html files in this repo render and behave as designed:
 *   - {{ expr }} mustache bindings (simple dot-path lookups) in text, attributes, and
 *     inline style strings.
 *   - <sc-for list="{{ expr }}" as="name"> ... </sc-for> loops.
 *   - <sc-if value="{{ expr }}"> ... </sc-if> conditionals.
 *   - style-hover="..." attributes (applied on mouseenter, reverted on mouseleave).
 *   - onClick / onChange bindings to real JS function references (not stringified code).
 *   - <helmet> — moves its <link>/<style> children into <head> once, resolving any
 *     {{ }} in <style> text against the initial render scope.
 *   - <x-import> — a no-op placeholder in the original tool; removed here since the
 *     custom elements it referenced (image-slot, doc-page) are implemented natively
 *     below instead of being dynamically loaded.
 *   - <image-slot> — a stand-in for the original drag/drop image component: click or
 *     drag a file onto it to preview a photo (in-memory only, per the prototype's own
 *     "resets on reload" behavior noted in the handoff README).
 *   - <doc-page size="letter" margin="0.75in"> — a stand-in for the original paged
 *     document component: a page-shaped container sized for screen/print.
 *   - class Component extends DCLogic { state = {...}; renderVals() {...} } — a small
 *     React-like base class providing this.state / this.setState / this.props and a
 *     renderVals() contract that returns the current template scope.
 *
 * Intentionally NOT a general-purpose framework — the expression language only
 * supports bare identifiers and dot paths (a.b.c), which is all six source files use.
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
   * 0. Avoid a flash of unstyled/unbound content while we boot.
   * ------------------------------------------------------------------- */
  var bootHideStyle = document.createElement('style');
  bootHideStyle.id = '__dc_boot_hide';
  bootHideStyle.textContent = 'html{visibility:hidden}';
  document.head.appendChild(bootHideStyle);

  function revealPage() {
    var el = document.getElementById('__dc_boot_hide');
    if (el) el.remove();
  }

  /* ---------------------------------------------------------------------
   * 1. Custom elements standing in for the prototyping tool's own
   *    image-slot.js / doc-page.js (neither of which shipped in this
   *    handoff bundle — see README.md).
   * ------------------------------------------------------------------- */
  var IMAGE_STORE = new Map();

  function ImageSlotElement() {
    return Reflect.construct(HTMLElement, [], ImageSlotElement);
  }
  ImageSlotElement.prototype = Object.create(HTMLElement.prototype);
  ImageSlotElement.prototype.constructor = ImageSlotElement;
  ImageSlotElement.prototype.connectedCallback = function () {
    if (this.__built) return;
    this.__built = true;

    var shape = this.getAttribute('shape') || 'rect';
    var radius = this.getAttribute('radius') || (shape === 'rounded' ? '10' : '0');
    var placeholder = this.getAttribute('placeholder') || 'Photo';
    var fit = this.getAttribute('fit') || 'cover';
    var id = this.getAttribute('id') || ('slot-' + Math.random().toString(36).slice(2));

    this.style.display = 'block';

    var wrap = document.createElement('div');
    wrap.style.cssText =
      'width:100%;height:100%;border-radius:' + (shape === 'rect' ? '0px' : radius + 'px') +
      ';overflow:hidden;background:oklch(95% 0.006 250);display:flex;align-items:center;justify-content:center;' +
      'cursor:pointer;position:relative;border:1px dashed oklch(83% 0.01 250);box-sizing:border-box;';

    var label = document.createElement('div');
    label.textContent = placeholder;
    label.style.cssText =
      'font-size:11px;color:oklch(55% 0.02 250);font-weight:600;text-align:center;padding:6px;pointer-events:none;';

    var img = document.createElement('img');
    img.style.cssText = 'width:100%;height:100%;object-fit:' + fit + ';display:none;';
    img.alt = placeholder;

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';

    wrap.appendChild(label);
    wrap.appendChild(img);
    wrap.appendChild(input);
    this.appendChild(wrap);

    var setImage = function (dataUrl) {
      IMAGE_STORE.set(id, dataUrl);
      img.src = dataUrl;
      img.style.display = 'block';
      label.style.display = 'none';
    };

    var stored = IMAGE_STORE.get(id);
    if (stored) setImage(stored);

    wrap.addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { setImage(reader.result); };
      reader.readAsDataURL(file);
    });

    ['dragover', 'dragenter'].forEach(function (evt) {
      wrap.addEventListener(evt, function (e) {
        e.preventDefault();
        wrap.style.borderColor = '#0F766E';
      });
    });
    ['dragleave'].forEach(function (evt) {
      wrap.addEventListener(evt, function (e) {
        e.preventDefault();
        wrap.style.borderColor = 'oklch(83% 0.01 250)';
      });
    });
    wrap.addEventListener('drop', function (e) {
      e.preventDefault();
      wrap.style.borderColor = 'oklch(83% 0.01 250)';
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { setImage(reader.result); };
      reader.readAsDataURL(file);
    });
  };
  customElements.define('image-slot', ImageSlotElement);

  function DocPageElement() {
    return Reflect.construct(HTMLElement, [], DocPageElement);
  }
  DocPageElement.prototype = Object.create(HTMLElement.prototype);
  DocPageElement.prototype.constructor = DocPageElement;
  DocPageElement.prototype.connectedCallback = function () {
    if (this.__built) return;
    this.__built = true;
    this.style.display = 'block';
    this.style.maxWidth = '8.5in';
    this.style.width = '100%';
    this.style.boxSizing = 'border-box';
    this.style.margin = '28px auto';
    this.style.background = 'white';
    this.style.padding = this.getAttribute('margin') || '0.75in';
    this.style.minHeight = '11in';
    this.style.boxShadow = '0 1px 3px rgba(20,20,30,0.08), 0 0 0 1px rgba(20,20,30,0.05)';
  };
  customElements.define('doc-page', DocPageElement);

  var printStyle = document.createElement('style');
  printStyle.textContent =
    '@media print { doc-page { box-shadow:none!important; margin:0!important; width:auto!important; max-width:none!important; } .no-print{display:none!important;} }' +
    'x-dc,x-import,helmet,sc-for,sc-if{display:contents;}';
  document.head.appendChild(printStyle);

  /* ---------------------------------------------------------------------
   * 2. Tiny expression language: bare identifiers / dot paths only.
   * ------------------------------------------------------------------- */
  function resolvePath(scope, path) {
    if (!path) return undefined;
    var parts = path.trim().split('.');
    var cur = scope;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function hasMustache(str) {
    return typeof str === 'string' && str.indexOf('{{') !== -1;
  }

  function isSingleMustache(str) {
    if (typeof str !== 'string') return null;
    var m = str.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    return m ? m[1] : null;
  }

  function compileTemplateString(str) {
    var single = isSingleMustache(str);
    if (single !== null) return { kind: 'single', expr: single };
    var parts = [];
    var re = /\{\{\s*([^}]+?)\s*\}\}/g;
    var lastIndex = 0;
    var match;
    while ((match = re.exec(str))) {
      if (match.index > lastIndex) parts.push({ text: str.slice(lastIndex, match.index) });
      parts.push({ expr: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < str.length) parts.push({ text: str.slice(lastIndex) });
    return { kind: 'multi', parts: parts };
  }

  function evalCompiled(compiled, scope) {
    if (compiled.kind === 'single') return resolvePath(scope, compiled.expr);
    return compiled.parts.map(function (p) {
      if (p.text !== undefined) return p.text;
      var v = resolvePath(scope, p.expr);
      return v === undefined || v === null ? '' : String(v);
    }).join('');
  }

  function resolveMustachesInText(str, scope) {
    return evalCompiled(compileTemplateString(str), scope);
  }

  /* ---------------------------------------------------------------------
   * 3. Reactive-ish tree binder.
   *    Walks a real DOM subtree once, wiring up bindings that can be
   *    re-applied against a fresh scope via instance.update(scope).
   *    <sc-for> children are rebuilt fully on every update (none of the
   *    six templates keep focusable inputs inside a loop, so this is
   *    safe). <sc-if> children are only rebuilt when the condition's
   *    truthiness actually changes, so a live input inside an sc-if
   *    (e.g. Product Detail's remark textarea) keeps focus while typing.
   * ------------------------------------------------------------------- */
  var BOOL_ATTRS = { disabled: 1, checked: 1, readonly: 1, selected: 1, hidden: 1, multiple: 1 };

  function domEventFor(reactName, tagName) {
    var lower = reactName.toLowerCase();
    if (lower === 'change') return tagName === 'SELECT' ? 'change' : 'input';
    return lower;
  }

  function bindTree(root, scope) {
    var bindings = [];

    function walk(node, sc) {
      if (!node) return;

      if (node.nodeType === Node.TEXT_NODE) {
        if (!hasMustache(node.textContent)) return;
        var compiled = compileTemplateString(node.textContent);
        var updateText = function (s) {
          var val = evalCompiled(compiled, s);
          var str = val === undefined || val === null ? '' : String(val);
          if (node.textContent !== str) node.textContent = str;
        };
        updateText(sc);
        bindings.push(updateText);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      var tag = node.tagName.toLowerCase();

      if (tag === 'helmet') {
        Array.prototype.slice.call(node.childNodes).forEach(function (child) {
          if (child.nodeType !== Node.ELEMENT_NODE) return;
          if (child.tagName === 'STYLE' && hasMustache(child.textContent)) {
            child.textContent = resolveMustachesInText(child.textContent, sc);
          }
          document.head.appendChild(child);
        });
        node.remove();
        return;
      }

      if (tag === 'x-import') {
        node.remove();
        return;
      }

      // <sc-for> works everywhere EXCEPT inside elements with a restricted HTML
      // content model (<table>/<tbody>/<tr>/<select>/<optgroup>) — browsers foster-
      // parent or silently drop unrecognized tags in those contexts, before any JS
      // ever runs. In the handful of spots where a loop sits inside a table or
      // <select>, the source markup uses a native <template data-for="{{ expr }}"
      // data-as="name"> instead, since <template> content is exempt from the
      // parent's content-model rules. Both spellings are handled identically here.
      var isForTag = tag === 'sc-for';
      var isForTemplate = tag === 'template' && node.hasAttribute('data-for');
      if (isForTag || isForTemplate) {
        var listExpr = isSingleMustache(node.getAttribute(isForTag ? 'list' : 'data-for') || '');
        var asName = node.getAttribute(isForTag ? 'as' : 'data-as');
        var template;
        if (isForTemplate) {
          template = node.content;
        } else {
          template = document.createDocumentFragment();
          while (node.firstChild) template.appendChild(node.firstChild);
        }
        var anchor = document.createComment('for:' + (listExpr || ''));
        node.parentNode.replaceChild(anchor, node);

        var currentNodes = [];
        var updateFor = function (s) {
          var list = resolvePath(s, listExpr) || [];
          currentNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
          currentNodes = [];
          list.forEach(function (item) {
            var clone = template.cloneNode(true);
            var itemScope = Object.assign({}, s);
            itemScope[asName] = item;
            bindTree(clone, itemScope);
            var nodesForThisItem = Array.prototype.slice.call(clone.childNodes);
            anchor.parentNode.insertBefore(clone, anchor);
            currentNodes = currentNodes.concat(nodesForThisItem);
          });
        };
        updateFor(sc);
        bindings.push(updateFor);
        return;
      }

      var isIfTag = tag === 'sc-if';
      var isIfTemplate = tag === 'template' && node.hasAttribute('data-if');
      if (isIfTag || isIfTemplate) {
        var condExpr = isSingleMustache(node.getAttribute(isIfTag ? 'value' : 'data-if') || '');
        var ifTemplate;
        if (isIfTemplate) {
          ifTemplate = node.content;
        } else {
          ifTemplate = document.createDocumentFragment();
          while (node.firstChild) ifTemplate.appendChild(node.firstChild);
        }
        var ifAnchor = document.createComment('if:' + (condExpr || ''));
        node.parentNode.replaceChild(ifAnchor, node);

        var mountedInstance = null;
        var mountedNodes = [];
        var lastCond;
        var updateIf = function (s) {
          var cond = !!resolvePath(s, condExpr);
          if (cond !== lastCond) {
            mountedNodes.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
            mountedNodes = [];
            mountedInstance = null;
            if (cond) {
              var clone = ifTemplate.cloneNode(true);
              mountedInstance = bindTree(clone, s);
              mountedNodes = Array.prototype.slice.call(clone.childNodes);
              ifAnchor.parentNode.insertBefore(clone, ifAnchor);
            }
            lastCond = cond;
          } else if (cond && mountedInstance) {
            mountedInstance.update(s);
          }
        };
        updateIf(sc);
        bindings.push(updateIf);
        return;
      }

      // Normal element: process attributes, then recurse into children.
      var hoverCompiled = null;
      var hoverCurrentText = '';

      Array.prototype.slice.call(node.attributes).forEach(function (attr) {
        var name = attr.name;
        var raw = attr.value;

        if (name === 'style-hover') {
          hoverCompiled = compileTemplateString(raw);
          node.removeAttribute('style-hover');
          return;
        }

        if (!hasMustache(raw)) return;

        var evMatch = name.match(/^on([a-z]+)$/i);
        if (evMatch) {
          node.removeAttribute(name);
          var exprPath = isSingleMustache(raw);
          var ref = { current: null };
          var domEventName = domEventFor(evMatch[1], node.tagName);
          node.addEventListener(domEventName, function (ev) {
            if (typeof ref.current === 'function') ref.current(ev);
          });
          var updateEvent = function (s) { ref.current = resolvePath(s, exprPath); };
          updateEvent(sc);
          bindings.push(updateEvent);
          return;
        }

        var compiled = compileTemplateString(raw);
        var lname = name.toLowerCase();
        var isFormValue = lname === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select');
        var isBool = !!BOOL_ATTRS[lname];
        node.removeAttribute(name);

        var updateAttr = function (s) {
          var val = evalCompiled(compiled, s);
          if (isFormValue) {
            var str = val === undefined || val === null ? '' : String(val);
            if (node.value !== str) node.value = str;
            return;
          }
          if (isBool) {
            if (val) node.setAttribute(lname, '');
            else node.removeAttribute(lname);
            return;
          }
          var out = val === undefined || val === null ? '' : String(val);
          node.setAttribute(name, out);
        };
        updateAttr(sc);
        bindings.push(updateAttr);
      });

      if (hoverCompiled) {
        var updateHover = function (s) { hoverCurrentText = evalCompiled(hoverCompiled, s); };
        updateHover(sc);
        bindings.push(updateHover);
        node.addEventListener('mouseenter', function () {
          node.__dcBaseStyle = node.getAttribute('style') || '';
          node.setAttribute('style', node.__dcBaseStyle + ';' + hoverCurrentText);
        });
        node.addEventListener('mouseleave', function () {
          node.setAttribute('style', node.__dcBaseStyle || '');
        });
      }

      Array.prototype.slice.call(node.childNodes).forEach(function (child) { walk(child, sc); });
    }

    if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      Array.prototype.slice.call(root.childNodes).forEach(function (child) { walk(child, scope); });
    } else {
      walk(root, scope);
    }

    return {
      update: function (s) { bindings.forEach(function (fn) { fn(s); }); }
    };
  }

  /* ---------------------------------------------------------------------
   * 4. DCLogic base class.
   * ------------------------------------------------------------------- */
  function DCLogic() {
    this.props = {};
    this.state = this.state || {};
  }
  DCLogic.prototype.setState = function (update) {
    var patch = typeof update === 'function' ? update(this.state) : update;
    this.state = Object.assign({}, this.state, patch);
    if (typeof this.__render === 'function') this.__render();
  };

  /* ---------------------------------------------------------------------
   * 5. Boot.
   * ------------------------------------------------------------------- */
  function boot() {
    var xdc = document.querySelector('x-dc');
    var script = document.querySelector('script[data-dc-script]');
    if (!xdc || !script) { revealPage(); return; }

    var propsSchema = {};
    try { propsSchema = JSON.parse(script.getAttribute('data-props') || '{}'); } catch (e) {}

    var props = {};
    Object.keys(propsSchema).forEach(function (key) {
      if (key === '$preview') return;
      var def = propsSchema[key];
      if (def && typeof def === 'object' && 'default' in def) props[key] = def.default;
      else props[key] = def;
    });

    var ComponentClass;
    try {
      var factory = new Function('DCLogic', script.textContent + '\n;return Component;');
      ComponentClass = factory(DCLogic);
    } catch (err) {
      console.error('support.js: failed to evaluate component script', err);
      revealPage();
      return;
    }

    var component = new ComponentClass();
    component.props = props;

    var vals = component.renderVals();
    var rootInstance = bindTree(xdc, vals);

    component.__render = function () {
      vals = component.renderVals();
      rootInstance.update(vals);
    };

    if (typeof component.componentDidMount === 'function') {
      try { component.componentDidMount(); } catch (err) { console.error(err); }
    }

    revealPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
