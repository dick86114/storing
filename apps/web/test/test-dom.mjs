import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

export function 安装浏览器环境() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:1050' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.InputEvent = dom.window.InputEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.ShadowRoot = dom.window.ShadowRoot;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  dom.window.HTMLElement.prototype.attachEvent = () => {};
  dom.window.HTMLElement.prototype.detachEvent = () => {};
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.React = React;
  return dom;
}

export function 创建根容器() {
  const container = document.createElement('div');
  document.body.append(container);
  return createRoot(container);
}

export function 修改输入(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

export async function 等待异步更新() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

export { React, act };
