'use strict';

const { ipcRenderer } = require('electron');

function isTextComposer(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    if (element.type !== 'text') return false;
    const label = ['aria-label', 'placeholder', 'data-placeholder', 'data-testid', 'name']
      .map((attribute) => element.getAttribute(attribute) || '')
      .join(' ')
      .toLowerCase();
    return element.getAttribute('role') === 'textbox' || /\b(chat|message|prompt|ask|reply|composer)\b/.test(label);
  }
  return element.matches('[contenteditable]:not([contenteditable="false"]), [role="textbox"]');
}

function findTextComposer(event) {
  const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
  return eventPath.find(isTextComposer) || null;
}

function getComposerText(composer) {
  if (composer instanceof HTMLInputElement || composer instanceof HTMLTextAreaElement) return composer.value;
  return composer.innerText || composer.textContent || '';
}

function clearComposer(composer) {
  if (composer instanceof HTMLInputElement || composer instanceof HTMLTextAreaElement) {
    const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(composer), 'value')?.set;
    if (valueSetter) valueSetter.call(composer, '');
    else composer.value = '';
  } else {
    composer.replaceChildren();
  }

  const inputEvent = typeof InputEvent === 'function'
    ? new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' })
    : new Event('input', { bubbles: true });
  composer.dispatchEvent(inputEvent);
}

window.addEventListener('keydown', (event) => {
  if (!event.isTrusted || event.defaultPrevented || event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  const composer = findTextComposer(event);
  if (!composer || getComposerText(composer).trim() !== '/btw') return;

  event.preventDefault();
  event.stopImmediatePropagation();
  clearComposer(composer);
  ipcRenderer.send('arena:open-btw-window');
}, true);
