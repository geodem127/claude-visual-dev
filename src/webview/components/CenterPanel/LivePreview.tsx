import React, { useRef, useEffect } from 'react';
import { useStore } from '../../store';
import type { ElementContext } from '../../../host/types';

const VIEWPORT_WIDTHS = { desktop: 1440, tablet: 768, mobile: 375 };

const ANNOTATION_SCRIPT = `
(function() {
  if (window.__claudeAnnotation) return;
  window.__claudeAnnotation = true;
  var overlay = null;
  function getStyles(el) {
    var cs = window.getComputedStyle(el);
    var props = ['color','background-color','font-size','font-weight','padding','margin','border','border-radius','display','flex-direction','align-items','justify-content','width','height'];
    var result = {};
    props.forEach(function(p) { result[p] = cs.getPropertyValue(p); });
    return result;
  }
  function getSelector(el) {
    if (el.id) return '#' + el.id;
    var parts = [];
    var cur = el;
    while (cur && cur !== document.body) {
      var part = cur.tagName.toLowerCase();
      if (cur.className && typeof cur.className === 'string') {
        part += '.' + cur.className.trim().split(/\s+/).join('.');
      }
      parts.unshift(part);
      cur = cur.parentElement;
    }
    return parts.join(' > ');
  }
  function getComponentName(el) {
    var fiberKey = Object.keys(el).find(function(k) {
      return k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance');
    });
    if (fiberKey) {
      var fiber = el[fiberKey];
      while (fiber) {
        if (fiber.type && typeof fiber.type === 'function' && fiber.type.name) return fiber.type.name;
        fiber = fiber.return;
      }
    }
    return el.tagName.toLowerCase();
  }
  document.addEventListener('mouseover', function(e) {
    if (!window.__claudeAnnotationActive) return;
    e.stopPropagation();
    var target = e.target;
    if (overlay) overlay.remove();
    var rect = target.getBoundingClientRect();
    overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;outline:2px solid #007acc;background:rgba(0,122,204,0.08);transition:none;';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    document.body.appendChild(overlay);
  }, true);
  document.addEventListener('mouseleave', function() {
    if (overlay) { overlay.remove(); overlay = null; }
  }, true);
  document.addEventListener('click', function(e) {
    if (!window.__claudeAnnotationActive) return;
    e.preventDefault(); e.stopPropagation();
    var target = e.target;
    var rect = target.getBoundingClientRect();
    window.parent.postMessage({
      type: 'ELEMENT_SELECTED',
      data: {
        selector: getSelector(target),
        componentName: getComponentName(target),
        filePath: '',
        computedStyles: getStyles(target),
        boundingBox: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
      }
    }, '*');
  }, true);
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'SET_ANNOTATION_MODE') {
      window.__claudeAnnotationActive = e.data.active;
      if (!e.data.active && overlay) { overlay.remove(); overlay = null; }
    }
  });
})();
`;

export default function LivePreview(): React.ReactElement {
  const { devServerUrl, viewport, annotationMode, setSelectedElement, setPinnedElement } = useStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const width = VIEWPORT_WIDTHS[viewport];

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    function onLoad() {
      try {
        iframe!.contentWindow?.eval(ANNOTATION_SCRIPT);
      } catch {
        // cross-origin — postMessage only; annotation limited
      }
      iframe!.contentWindow?.postMessage({ type: 'SET_ANNOTATION_MODE', active: annotationMode }, '*');
    }
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [devServerUrl]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'SET_ANNOTATION_MODE', active: annotationMode }, '*');
  }, [annotationMode]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'ELEMENT_SELECTED') {
        const el = e.data.data as ElementContext;
        setSelectedElement(el);
        setPinnedElement(el);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setSelectedElement, setPinnedElement]);

  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'auto', background: '#1a1a1a', padding: 16, minHeight: 0 }}>
      <iframe
        ref={iframeRef}
        src={devServerUrl}
        style={{
          width,
          height: 900,
          border: '1px solid var(--vscode-panel-border)',
          background: '#fff',
          flexShrink: 0,
          cursor: annotationMode ? 'crosshair' : 'default',
        }}
        title="Live Preview"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
