import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { IndexManager } from '../src/components/IndexManager';
import { Sidebar } from '../src/components/Sidebar';
import { IndexContext, type MaterialIndexes } from '../src/lib/indexes';
import {
  commitSupabaseIndexWrite,
  indexWriteEnabledFor,
  renamedSourceFilter,
  supabaseIndexNotice,
  type SupabaseIndexMutations,
} from '../src/lib/localEditing';
import { isSupabaseAdminCapability } from '../src/lib/useMaterialAuth';
import type { MaterialAdminStatus } from '../src/lib/supabaseAuth';
import { SupabaseSourceRenameRemoteCommittedError } from '../src/lib/supabaseExtendedWrites';
import type { Material } from '../src/types';

const indexes: MaterialIndexes = {
  categories: [
    { id: 'Metal', label: '金屬', color: '#2563eb' },
    { id: 'Plastic', label: '塑膠', color: '#df8105' },
  ],
  sources: ['Supplier', 'Web'],
};
const material: Material = {
  id: 'm1',
  name: 'ADC12',
  category: 'Metal',
  source: 'Web',
  notes: '',
  density: null,
  youngsModulus: null,
  poissonRatio: null,
  yieldStress: null,
  etan: null,
  ultimateStress: null,
  elongation: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
  history: [{ at: '2026-01-01T00:00:00.000Z', action: 'created', summary: '建立記錄' }],
};

test('index capability follows admin in Supabase and editable in legacy', () => {
  const blocked: MaterialAdminStatus[] = ['signed_out', 'checking', 'non_admin', 'error'];
  for (const status of blocked) {
    const admin = isSupabaseAdminCapability('supabase', status);
    assert.equal(admin, false, status);
    assert.equal(indexWriteEnabledFor('supabase', true, admin), false, status);
  }
  const admin = isSupabaseAdminCapability('supabase', 'admin');
  assert.equal(indexWriteEnabledFor('supabase', false, admin), true);
  assert.equal(indexWriteEnabledFor('legacy', false, true), false);
  assert.equal(indexWriteEnabledFor('legacy', true, false), true);
});

test('Supabase generic editable stays false while index management is its own gate', async () => {
  const storage = await readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(storage, /const editable = !supabaseActive && \(exampleMode \|\| fileStatus === 'linked'/);
  assert.equal(storage.includes('editable = true'), false);
  assert.match(app, /const indexWriteEnabled = indexWriteEnabledFor\(materialState\.dataSource, editable, supabaseAdmin\)/);
  assert.match(app, /const materialCrudEnabled = materialCrudEnabledFor\(materialState\.dataSource, editable, supabaseAdmin\)/);
  assert.match(app, /const curveWriteEnabled = curveWriteEnabledFor\(materialState\.dataSource, editable, supabaseAdmin\)/);
  assert.equal(storage.match(/createWriteLock\(/g)?.length, 1);
  assert.equal(app.includes('categoryWriting'), false);
  assert.equal(app.includes('sourceWriting'), false);
});

test('sidebar manage buttons follow index capability and filters stay visible', () => {
  const markup = (indexManageEnabled: boolean) => renderToStaticMarkup(createElement(IndexContext.Provider, { value: indexes }, createElement(Sidebar, {
    materials: [material],
    view: 'materials',
    onNavigate: () => {},
    filters: { category: 'all', source: 'all', updated: 'all' },
    onFilters: () => {},
    selectedCount: 0,
    onManage: () => {},
    indexManageEnabled,
  })));
  const hidden = markup(false);
  const shown = markup(true);
  assert.equal(hidden.includes('管理材料分類'), false);
  assert.equal(hidden.includes('管理 SOURCE'), false);
  assert.equal(hidden.includes('全部材料'), true);
  assert.equal(hidden.includes('全部來源'), true);
  assert.equal(hidden.includes('金屬'), true);
  assert.equal(hidden.includes('Web'), true);
  assert.equal(shown.includes('管理材料分類'), true);
  assert.equal(shown.includes('管理 SOURCE'), true);
  assert.equal(shown.includes('刪除'), false);
});

test('index manager hints distinguish direct Supabase writes from legacy drafts', () => {
  const markup = (direct: boolean) => renderToStaticMarkup(createElement(IndexContext.Provider, { value: indexes }, createElement(IndexManager, {
    kind: 'category',
    materials: [material],
    direct,
    directHint: direct ? '變更會直接寫入 Supabase。' : undefined,
    onSave: () => null,
    onClose: () => {},
  })));
  const legacy = markup(false);
  const direct = markup(true);
  assert.equal(legacy.includes('新增項目可立即用於材料表單，尚未使用時顯示 0 筆。'), true);
  assert.equal(legacy.includes('變更會直接寫入 Supabase。'), false);
  assert.equal(direct.includes('變更會直接寫入 Supabase。'), true);
  assert.equal(direct.includes('新增項目可立即用於材料表單'), false);
  assert.equal(direct.includes('草稿'), false);
  assert.equal(direct.includes('Save Database'), false);
  assert.equal(direct.includes('刪除'), false);
});

function trackMutations() {
  const calls: string[] = [];
  const mutations: SupabaseIndexMutations = {
    async addCategory(name) { calls.push(`addCategory:${name}`); },
    async renameCategory(id, name) { calls.push(`renameCategory:${id}:${name}`); },
    async addSource(name) { calls.push(`addSource:${name}`); },
    async renameSource(oldName, newName) { calls.push(`renameSource:${oldName}:${newName}`); },
  };
  return { calls, mutations };
}

test('Supabase index writes route to extended mutations and legacy editIndex stays outside that path', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const editing = await readFile(new URL('../src/lib/localEditing.ts', import.meta.url), 'utf8');
  const manager = await readFile(new URL('../src/components/IndexManager.tsx', import.meta.url), 'utf8');
  const save = app.slice(app.indexOf('onSave={async (id, name) => {'), app.indexOf('const error = editIndex'));
  assert.match(save, /commitSupabaseIndexWrite\(/);
  assert.equal(save.includes('editIndex'), false);
  assert.match(app, /const error = editIndex\(indexManager, id, name\)/);
  assert.match(editing, /await mutations\.addCategory\(name\)/);
  assert.match(editing, /await mutations\.renameCategory\(id, name\)/);
  assert.match(editing, /await mutations\.addSource\(name\)/);
  assert.match(editing, /await mutations\.renameSource\(id, name\)/);
  assert.equal(editing.includes('editIndex'), false);
  assert.equal(manager.includes('刪除'), false);
  assert.equal(manager.includes('extendedMutations'), false);
  const tracked = trackMutations();
  let edited = 0;
  const added = await commitSupabaseIndexWrite({
    stale: false, kind: 'category', id: null, name: ' 陶瓷 ', readActiveSource: () => 'all', mutations: tracked.mutations,
  });
  const renamed = await commitSupabaseIndexWrite({
    stale: false, kind: 'category', id: 'Metal', name: '合金', readActiveSource: () => 'all', mutations: tracked.mutations,
  });
  const source = await commitSupabaseIndexWrite({
    stale: false, kind: 'source', id: null, name: '廠商', readActiveSource: () => 'all', mutations: tracked.mutations,
  });
  assert.equal(added.message, null);
  assert.equal(added.notice, '已新增 Supabase 分類：陶瓷。');
  assert.equal(renamed.notice, '已更新 Supabase 分類名稱：合金。');
  assert.equal(source.notice, '已新增 Supabase 來源：廠商。');
  for (const notice of [added.notice, renamed.notice, source.notice]) {
    assert.equal(notice?.includes('草稿'), false);
    assert.equal(notice?.includes('Save Database'), false);
  }
  assert.deepEqual(tracked.calls, ['addCategory: 陶瓷 ', 'renameCategory:Metal:合金', 'addSource:廠商']);
  assert.equal(edited, 0);
  assert.equal(supabaseIndexNotice('source', 'Web', ' Archive '), '已更新 Supabase 來源：Archive。');
});

test('source filter changes only after a successful rename of the active source', async () => {
  assert.equal(renamedSourceFilter('Web', 'Web', ' Archive '), 'Archive');
  assert.equal(renamedSourceFilter('Supplier', 'Web', 'Archive'), null);
  assert.equal(renamedSourceFilter('all', 'Web', 'Archive'), null);
  const filters = { source: 'Web' };
  let reads = 0;
  const readActiveSource = () => {
    reads += 1;
    return filters.source;
  };
  const success = trackMutations();
  const renamed = await commitSupabaseIndexWrite({
    stale: false, kind: 'source', id: 'Web', name: ' Archive ', readActiveSource, mutations: success.mutations,
  });
  if (renamed.sourceFilter !== null) filters.source = renamed.sourceFilter;
  assert.equal(reads, 1);
  assert.equal(filters.source, 'Archive');
  assert.deepEqual(success.calls, ['renameSource:Web: Archive ']);

  const other = { source: 'Supplier' };
  const kept = await commitSupabaseIndexWrite({
    stale: false, kind: 'source', id: 'Web', name: 'Archive', readActiveSource: () => other.source, mutations: trackMutations().mutations,
  });
  assert.equal(kept.sourceFilter, null);
  assert.equal(other.source, 'Supplier');

  const ordinary = trackMutations();
  let ordinaryReads = 0;
  const failed = await commitSupabaseIndexWrite({
    stale: false,
    kind: 'source',
    id: 'Web',
    name: 'Archive',
    readActiveSource: () => { ordinaryReads += 1; return 'Web'; },
    mutations: {
      ...ordinary.mutations,
      async renameSource() { ordinary.calls.push('renameSource'); throw new Error('RPC 失敗'); },
    },
  });
  assert.equal(failed.message, 'RPC 失敗');
  assert.equal(failed.sourceFilter, null);
  assert.equal(ordinaryReads, 0);
  assert.deepEqual(ordinary.calls, ['renameSource']);

  const remote = trackMutations();
  let remoteReads = 0;
  const active = { source: 'Web' };
  await assert.rejects(() => commitSupabaseIndexWrite({
    stale: false,
    kind: 'source',
    id: 'Web',
    name: 'Archive',
    readActiveSource: () => { remoteReads += 1; return active.source; },
    mutations: {
      ...remote.mutations,
      async renameSource() {
        remote.calls.push('renameSource');
        throw new SupabaseSourceRenameRemoteCommittedError();
      },
    },
  }), (error: unknown) => error instanceof SupabaseSourceRenameRemoteCommittedError && error.remoteCommitted === true);
  assert.equal(active.source, 'Web');
  assert.equal(remoteReads, 0);
  assert.deepEqual(remote.calls, ['renameSource']);
});

test('remote-committed source failure blocks every later index write and ordinary failure stays retryable', async () => {
  const first = trackMutations();
  const remoteMutations: SupabaseIndexMutations = {
    ...first.mutations,
    async renameSource(oldName, newName) {
      first.calls.push(`renameSource:${oldName}:${newName}`);
      throw new SupabaseSourceRenameRemoteCommittedError();
    },
  };
  await assert.rejects(() => commitSupabaseIndexWrite({
    stale: false, kind: 'source', id: 'Web', name: 'Archive', readActiveSource: () => 'Web', mutations: remoteMutations,
  }), (error: unknown) => error instanceof SupabaseSourceRenameRemoteCommittedError);
  const blocked = await commitSupabaseIndexWrite({
    stale: true, kind: 'category', id: null, name: '陶瓷', readActiveSource: () => 'Web', mutations: remoteMutations,
  });
  const blockedRename = await commitSupabaseIndexWrite({
    stale: true, kind: 'source', id: 'Web', name: 'Archive', readActiveSource: () => 'Web', mutations: remoteMutations,
  });
  assert.equal(blocked.message, '索引狀態無法確認，請重新整理頁面。');
  assert.equal(blockedRename.sourceFilter, null);
  assert.deepEqual(first.calls, ['renameSource:Web:Archive']);

  const retry = trackMutations();
  let attempts = 0;
  const flaky: SupabaseIndexMutations = {
    ...retry.mutations,
    async renameSource() {
      attempts += 1;
      if (attempts === 1) throw new Error('網路中斷');
    },
  };
  const failed = await commitSupabaseIndexWrite({
    stale: false, kind: 'source', id: 'Web', name: 'Archive', readActiveSource: () => 'Supplier', mutations: flaky,
  });
  assert.equal(failed.message, '網路中斷');
  assert.equal(failed.sourceFilter, null);
  const again = await commitSupabaseIndexWrite({
    stale: false, kind: 'source', id: 'Web', name: 'Archive', readActiveSource: () => 'Supplier', mutations: flaky,
  });
  assert.equal(again.message, null);
  assert.equal(again.notice, '已更新 Supabase 來源：Archive。');
  assert.equal(attempts, 2);
});

test('App stale flag survives close and auth changes, and index writes share materialWriting', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const editing = await readFile(new URL('../src/lib/localEditing.ts', import.meta.url), 'utf8');
  assert.equal(app.includes('setIndexRemoteStale(false)'), false);
  assert.equal(app.includes('setIndexRemoteStale(true)'), true);
  assert.match(app, /onRemoteCommitted=\{\(\) => setIndexRemoteStale\(true\)\}/);
  assert.match(app, /if \(!indexWriteEnabled \|\| indexRemoteStale\) return;\s*setIndexManager\(kind\);/);
  assert.match(app, /indexManageEnabled=\{indexWriteEnabled && !indexRemoteStale\}/);
  assert.match(app, /\{indexManager && \(indexWriteEnabled \|\| materialState\.materialWriting\) &&/);
  const drop = app.slice(app.indexOf('if (indexWriteEnabled || materialState.materialWriting) return;'), app.indexOf('}, [indexWriteEnabled'));
  assert.match(drop, /setIndexManager\(null\)/);
  assert.equal(drop.includes('indexRemoteStale'), false);
  assert.match(app, /onClose=\{\(\) => setIndexManager\(null\)\}/);
  const manager = app.slice(app.indexOf('<IndexManager'), app.indexOf('/>', app.indexOf('<IndexManager')));
  assert.match(manager, /pending=\{materialState\.materialWriting\}/);
  assert.match(manager, /direct=\{materialState\.dataSource === 'supabase'\}/);
  assert.match(manager, /directHint=\{supabaseIndexDirectHint\}/);
  assert.match(app, /const supabaseIndexDirectHint = supabaseDataSourceEnabled \? '變更會直接寫入 Supabase。' : undefined;/);
  assert.match(app, /<ImportExportDialog[\s\S]*editable=\{editable\}/);
  assert.match(editing, /CSV, JSON, and other deferred Supabase writes stay closed/);
  assert.equal(editing.includes('gating Index'), false);
  assert.equal(app.includes('requestEdit(() => setIndexManager(kind))'), false);
});

let domQueue = Promise.resolve();
function withDom(run: () => Promise<void>): Promise<void> {
  const result = domQueue.then(run, run);
  domQueue = result.then(() => undefined, () => undefined);
  return result;
}

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost' });
  const win = dom.window;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: win.document });
  Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: win.HTMLElement });
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: win.Element });
  Object.defineProperty(globalThis, 'Node', { configurable: true, value: win.Node });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true });
  win.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0) as unknown as number;
  win.cancelAnimationFrame = (id: number) => clearTimeout(id);
  return win.document.getElementById('root')!;
}

function setField(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set?.call(element, value);
  element.dispatchEvent(new element.ownerDocument.defaultView!.Event('input', { bubbles: true }));
}

function button(root: ParentNode, pattern: RegExp) {
  const found = [...root.querySelectorAll('button')].filter(item => pattern.test((item.textContent ?? '').replace(/\s+/g, '')));
  assert.equal(found.length, 1, pattern.source);
  return found[0] as HTMLButtonElement;
}

async function flush() {
  const { act } = await import('react');
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

test('index manager keeps legacy sync success and validation input', async () => withDom(async () => {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  const saved: Array<[string | null, string]> = [];
  const render = (onSave: (id: string | null, name: string) => string | null) => {
    root.render(createElement(IndexContext.Provider, { value: indexes }, createElement(IndexManager, {
      kind: 'category',
      materials: [material],
      onSave,
      onClose: () => {},
    })));
  };
  await act(async () => { render((id, name) => { saved.push([id, name]); return null; }); });
  await act(async () => { button(rootElement, /新增分類/).click(); });
  const input = rootElement.querySelector('input') as HTMLInputElement;
  await act(async () => { setField(input, '陶瓷'); });
  await act(async () => { button(rootElement, /^新增$/).click(); });
  await flush();
  assert.deepEqual(saved, [[null, '陶瓷']]);
  assert.equal(rootElement.querySelector('input'), null);
  assert.match(rootElement.textContent ?? '', /新增分類/);
  assert.match(rootElement.textContent ?? '', /管理材料分類/);

  root.unmount();
  const failureElement = installDom();
  const failureRoot = createRoot(failureElement);
  await act(async () => {
    failureRoot.render(createElement(IndexContext.Provider, { value: indexes }, createElement(IndexManager, {
      kind: 'source',
      materials: [material],
      onSave: () => '請輸入名稱。',
      onClose: () => {},
    })));
  });
  await act(async () => { button(failureElement, /新增來源/).click(); });
  const invalid = failureElement.querySelector('input') as HTMLInputElement;
  await act(async () => { setField(invalid, '保留的名稱'); });
  await act(async () => { button(failureElement, /^新增$/).click(); });
  await flush();
  assert.equal(invalid.value, '保留的名稱');
  assert.match(failureElement.textContent ?? '', /請輸入名稱。/);
  assert.equal(button(failureElement, /^新增$/).disabled, false);
  failureRoot.unmount();
}));

test('index manager awaits one add or rename and blocks a second submit', async () => withDom(async () => {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  let calls = 0;
  let release = (_value: string | null) => {};
  const gate = new Promise<string | null>(resolve => { release = resolve; });
  const render = () => {
    root.render(createElement(IndexContext.Provider, { value: indexes }, createElement(IndexManager, {
      kind: 'category',
      materials: [material],
      direct: true,
      onSave: (id, name) => {
        calls += 1;
        assert.equal(id, null);
        assert.equal(name, '陶瓷');
        return gate;
      },
      onClose: () => {},
    })));
  };
  await act(async () => { render(); });
  await act(async () => { button(rootElement, /新增分類/).click(); });
  const input = rootElement.querySelector('input') as HTMLInputElement;
  await act(async () => { setField(input, '陶瓷'); });
  const saveButton = button(rootElement, /^新增$/);
  await act(async () => {
    saveButton.click();
    saveButton.click();
  });
  assert.equal(calls, 1);
  assert.match(button(rootElement, /新增中…/).textContent ?? '', /新增中…/);
  assert.equal(input.disabled, true);
  assert.equal(button(rootElement, /取消/).disabled, true);
  assert.equal(rootElement.querySelector('button[aria-label="Close"]')?.hasAttribute('disabled'), true);
  await act(async () => {
    release(null);
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  assert.equal(rootElement.querySelector('input'), null);
  assert.match(rootElement.textContent ?? '', /新增分類/);
  root.unmount();

  const renameElement = installDom();
  const renameRoot = createRoot(renameElement);
  let renamed = 0;
  let releaseRename = (_value: string | null) => {};
  const renameGate = new Promise<string | null>(resolve => { releaseRename = resolve; });
  await act(async () => {
    renameRoot.render(createElement(IndexContext.Provider, { value: indexes }, createElement(IndexManager, {
      kind: 'source',
      materials: [material],
      direct: true,
      onSave: (id, name) => {
        renamed += 1;
        assert.equal(id, 'Web');
        assert.equal(name, ' Archive ');
        return renameGate;
      },
      onClose: () => {},
    })));
  });
  await act(async () => { renameElement.querySelector('button[aria-label="編輯來源 Web"]')!.dispatchEvent(new renameElement.ownerDocument.defaultView!.MouseEvent('click', { bubbles: true })); });
  const renameInput = renameElement.querySelector('input') as HTMLInputElement;
  await act(async () => { setField(renameInput, ' Archive '); });
  const renameButton = button(renameElement, /儲存名稱/);
  await act(async () => {
    renameButton.click();
    renameButton.click();
  });
  assert.equal(renamed, 1);
  assert.match(button(renameElement, /儲存中…/).textContent ?? '', /儲存中…/);
  assert.equal(renameInput.value, ' Archive ');
  await act(async () => {
    releaseRename(null);
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  assert.equal(renameElement.querySelector('input'), null);
  assert.match(renameElement.textContent ?? '', /管理 SOURCE/);
  renameRoot.unmount();
}));

test('ordinary index rejection stays retryable and shared pending blocks a new save', async () => withDom(async () => {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  let calls = 0;
  let remoteNotices = 0;
  const render = (pending = false) => {
    root.render(createElement(IndexContext.Provider, { value: indexes }, createElement(IndexManager, {
      kind: 'source',
      materials: [material],
      pending,
      onRemoteCommitted: () => { remoteNotices += 1; },
      onSave: () => {
        calls += 1;
        if (calls === 1) return Promise.reject(new Error('RPC 失敗'));
        return Promise.resolve(null);
      },
      onClose: () => {},
    })));
  };
  await act(async () => { render(); });
  await act(async () => { button(rootElement, /新增來源/).click(); });
  const input = rootElement.querySelector('input') as HTMLInputElement;
  await act(async () => { setField(input, '廠商'); });
  await act(async () => { button(rootElement, /^新增$/).click(); });
  await flush();
  assert.equal(calls, 1);
  assert.equal(remoteNotices, 0);
  assert.equal(input.value, '廠商');
  assert.match(rootElement.textContent ?? '', /RPC 失敗/);
  assert.equal(button(rootElement, /^新增$/).disabled, false);
  await act(async () => { button(rootElement, /^新增$/).click(); });
  await flush();
  assert.equal(calls, 2);
  assert.equal(rootElement.querySelector('input'), null);

  root.unmount();
  const pendingElement = installDom();
  const pendingRoot = createRoot(pendingElement);
  let pendingCalls = 0;
  const renderPending = (pending: boolean) => {
    pendingRoot.render(createElement(IndexContext.Provider, { value: indexes }, createElement(IndexManager, {
      kind: 'category',
      materials: [material],
      pending,
      onSave: () => { pendingCalls += 1; return null; },
      onClose: () => {},
    })));
  };
  await act(async () => { renderPending(false); });
  await act(async () => { button(pendingElement, /新增分類/).click(); });
  await act(async () => { renderPending(true); });
  const pendingInput = pendingElement.querySelector('input') as HTMLInputElement;
  await act(async () => { setField(pendingInput, '陶瓷'); });
  const pendingButton = button(pendingElement, /新增中…/);
  assert.equal(pendingButton.disabled, true);
  assert.equal(pendingInput.disabled, true);
  await act(async () => { pendingButton.click(); });
  assert.equal(pendingCalls, 0);
  pendingRoot.unmount();
}));

test('remote-committed index error locks retry, notifies once, and still lets the dialog close', async () => withDom(async () => {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  let calls = 0;
  const notices: string[] = [];
  let closed = 0;
  await act(async () => {
    root.render(createElement(IndexContext.Provider, { value: indexes }, createElement(IndexManager, {
      kind: 'source',
      materials: [material],
      direct: true,
      onRemoteCommitted: message => { notices.push(message); },
      onSave: () => {
        calls += 1;
        return Promise.reject(new SupabaseSourceRenameRemoteCommittedError());
      },
      onClose: () => { closed += 1; },
    })));
  });
  await act(async () => {
    rootElement.querySelector('button[aria-label="編輯來源 Web"]')!.dispatchEvent(new rootElement.ownerDocument.defaultView!.MouseEvent('click', { bubbles: true }));
  });
  const input = rootElement.querySelector('input') as HTMLInputElement;
  await act(async () => { setField(input, 'Archive'); });
  await act(async () => { button(rootElement, /儲存名稱/).click(); });
  await flush();
  assert.equal(calls, 1);
  assert.match(rootElement.textContent ?? '', /來源已在 Supabase 更新，但本機狀態無法確認；請重新整理頁面確認最新資料。/);
  assert.equal(input.value, 'Archive');
  assert.equal(button(rootElement, /儲存名稱/).disabled, true);
  assert.equal(button(rootElement, /取消/).disabled, true);
  assert.deepEqual(notices, ['來源已在 Supabase 更新，但本機狀態無法確認；請重新整理頁面確認最新資料。']);
  await act(async () => { button(rootElement, /儲存名稱/).click(); });
  await flush();
  assert.equal(calls, 1);
  assert.equal(notices.length, 1);
  const close = rootElement.querySelector('button[aria-label="Close"]') as HTMLButtonElement;
  assert.equal(close.disabled, false);
  await act(async () => { close.click(); });
  assert.equal(closed, 1);
  root.unmount();
}));
