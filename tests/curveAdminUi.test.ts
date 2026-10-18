import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { curveWriteEnabledFor, materialCrudEnabledFor } from '../src/lib/localEditing';
import { isSupabaseAdminCapability } from '../src/lib/useMaterialAuth';
import type { MaterialAdminStatus } from '../src/lib/supabaseAuth';
import { StressStrainSection } from '../src/components/StressStrainSection';
import type { Material, StressStrainData } from '../src/types';

const units = { density: 't/mm³' as const, stress: 'MPa' as const };
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
const storedCurve: StressStrainData = {
  points: [{ strain: 0.2, stress: 20 }, { strain: 0, stress: 0 }, { strain: -0.1, stress: -5 }],
  definition: 'engineering',
  strainKind: 'total',
  source: '原始來源',
  notes: '原始備註',
};

test('curve capability follows admin in Supabase and editable in legacy', () => {
  const blocked: MaterialAdminStatus[] = ['signed_out', 'checking', 'non_admin', 'error'];
  for (const status of blocked) {
    const admin = isSupabaseAdminCapability('supabase', status);
    assert.equal(curveWriteEnabledFor('supabase', true, admin), false, status);
    assert.equal(materialCrudEnabledFor('supabase', true, admin), false, status);
  }
  const admin = isSupabaseAdminCapability('supabase', 'admin');
  assert.equal(curveWriteEnabledFor('supabase', false, admin), true);
  assert.equal(materialCrudEnabledFor('supabase', false, admin), true);
  assert.equal(curveWriteEnabledFor('legacy', false, true), false);
  assert.equal(curveWriteEnabledFor('legacy', true, false), true);
});

test('curve editor markup follows its own capability and does not sort points', () => {
  const closed = renderToStaticMarkup(createElement(StressStrainSection, {
    material: { ...material, stressStrainCurve: storedCurve },
    units,
    editable: false,
    onSave: () => null,
  }));
  const open = renderToStaticMarkup(createElement(StressStrainSection, { material, units, editable: true, onSave: () => null }));
  assert.equal(closed.includes('編輯完整曲線'), false);
  assert.match(closed, /匯出曲線 CSV/);
  assert.match(open, /加入完整曲線/);
  assert.match(closed, /0\.2/);
});

test('Supabase curve save is direct and legacy curve save stays a local draft', async () => {
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const storage = await readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8');
  const section = await readFile(new URL('../src/components/StressStrainSection.tsx', import.meta.url), 'utf8');
  const sidebar = await readFile(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8');
  const curve = app.slice(app.indexOf('onSaveCurve={async'), app.indexOf('/>', app.indexOf('onSaveCurve={async')));
  assert.match(curve, /extendedMutations\.saveCurve\(\s*detail\.id,\s*data\s*\)/);
  assert.match(curve, /已更新 Supabase 材料曲線：\$\{detail\.name\}。/);
  assert.equal(curve.slice(0, curve.indexOf('const error = setCurve')).includes('setCurve('), false);
  assert.equal(curve.includes('updateMaterial'), false);
  assert.match(curve, /const error = setCurve\(detail\.id, data\)/);
  assert.match(curve, /已更新 \$\{detail\.name\} 的完整曲線草稿；請按 Save Database。/);
  const deleted = app.slice(app.indexOf('onDeleteCurve={async'), app.indexOf('/>', app.indexOf('onDeleteCurve={async')));
  const directDelete = deleted.slice(deleted.indexOf('extendedMutations.clearCurve'), deleted.indexOf('const error = clearCurve'));
  assert.match(deleted, /extendedMutations\.clearCurve\(\s*detail\.id\s*\)/);
  assert.match(deleted, /已刪除 Supabase 材料完整曲線：\$\{detail\.name\}。/);
  assert.equal(directDelete.includes('Save Database'), false);
  assert.equal(directDelete.includes('草稿'), false);
  assert.equal(directDelete.includes('setCurve('), false);
  assert.match(deleted, /const error = clearCurve\(detail\.id\)/);
  assert.match(deleted, /已移除 \$\{detail\.name\} 的完整曲線草稿；請按 Save Database。/);
  assert.equal(curve.slice(curve.indexOf('extendedMutations.saveCurve'), curve.indexOf('const error = setCurve')).includes('Save Database'), false);
  assert.equal(curve.slice(curve.indexOf('extendedMutations.saveCurve'), curve.indexOf('const error = setCurve')).includes('草稿'), false);
  assert.match(app, /curveEditable=\{curveWriteEnabled\}/);
  assert.match(app, /curvePending=\{materialState\.materialWriting\}/);
  assert.match(app, /<MaterialDetailPage[\s\S]*editable=\{editable\}/);
  assert.match(storage, /const editable = !supabaseActive && \(exampleMode \|\| fileStatus === 'linked'/);
  assert.match(app, /<Sidebar[\s\S]*indexManageEnabled=\{indexWriteEnabled && !indexRemoteStale\}/);
  assert.match(app, /<ImportExportDialog[\s\S]*editable=\{editable\}/);
  assert.match(app, /indexWriteEnabledFor\(materialState\.dataSource, editable, supabaseAdmin\)/);
  assert.equal(sidebar.includes('indexWriteEnabledFor'), false);
  assert.equal(section.includes('.sort('), false);
  assert.match(section, /保留原始順序/);
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

function setField(element: HTMLTextAreaElement | HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')?.set?.call(element, value);
  element.dispatchEvent(new element.ownerDocument.defaultView!.Event('input', { bubbles: true }));
}

function fields(root: ParentNode) {
  const textareas = [...root.querySelectorAll('textarea')] as HTMLTextAreaElement[];
  const source = root.querySelector('input[placeholder]') as HTMLInputElement;
  return { points: textareas[0], notes: textareas[1], source };
}

async function flush() {
  const { act } = await import('react');
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

test('curve editor awaits one save and preserves input when the write fails', async () => withDom(async () => {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  let calls = 0;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const saved: StressStrainData[] = [];
  const render = (pending = false, editable = true) => {
    root.render(createElement(StressStrainSection, {
      material: { ...material, stressStrainCurve: storedCurve },
      units,
      editable,
      pending,
      onSave: (data) => {
        calls += 1;
        saved.push(data);
        return gate.then(() => null);
      },
    }));
  };
  await act(async () => { render(); });
  const edit = rootElement.querySelector('button')!;
  assert.match(edit.textContent ?? '', /編輯完整曲線/);
  await act(async () => { edit.click(); });
  const points = fields(rootElement).points;
  const source = fields(rootElement).source;
  const notes = fields(rootElement).notes;
  await act(async () => {
    setField(points, '0.2,20\n0,0\n-0.1,-5');
    setField(source, '試驗報告');
    setField(notes, '負值保留');
  });
  const saveButton = [...rootElement.querySelectorAll('button')].find(button => button.textContent?.includes('儲存完整曲線'))!;
  await act(async () => {
    saveButton.click();
    saveButton.click();
  });
  assert.equal(calls, 1);
  assert.match(saveButton.textContent ?? '', /儲存中…/);
  assert.equal(saveButton.hasAttribute('disabled'), true);
  assert.equal(points.value, '0.2,20\n0,0\n-0.1,-5');
  await act(async () => {
    release();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  assert.match(rootElement.textContent ?? '', /編輯完整曲線/);
  assert.equal(rootElement.textContent?.includes('儲存完整曲線'), false);
  assert.deepEqual(saved[0].points, [
    { strain: 0.2, stress: 20 },
    { strain: 0, stress: 0 },
    { strain: -0.1, stress: -5 },
  ]);
  assert.equal(saved[0].definition, 'engineering');
  assert.equal(saved[0].source, '試驗報告');
  assert.equal(saved[0].notes, '負值保留');

  root.unmount();
  const failureRootElement = installDom();
  const failureRoot = createRoot(failureRootElement);
  let reject = (_error: Error) => {};
  const failure = new Promise<null>((_resolve, rejectPromise) => { reject = rejectPromise; });
  await act(async () => {
    failureRoot.render(createElement(StressStrainSection, {
      material: { ...material, stressStrainCurve: storedCurve },
      units,
      editable: true,
      onSave: () => failure,
    }));
  });
  await act(async () => {
    [...failureRootElement.querySelectorAll('button')].find(button => button.textContent?.includes('編輯完整曲線'))!.click();
  });
  const failedPoints = fields(failureRootElement).points;
  const failedSource = fields(failureRootElement).source;
  const failedNotes = fields(failureRootElement).notes;
  await act(async () => {
    setField(failedPoints, '0.2,20\n0,0');
    setField(failedSource, '保留來源');
    setField(failedNotes, '保留備註');
  });
  await act(async () => {
    [...failureRootElement.querySelectorAll('button')].find(button => button.textContent?.includes('儲存完整曲線'))!.click();
  });
  await act(async () => {
    reject(new Error('Supabase 更新曲線失敗：42501'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  assert.match(failureRootElement.textContent ?? '', /Supabase 更新曲線失敗：42501/);
  assert.match(failureRootElement.textContent ?? '', /儲存完整曲線/);
  assert.equal(fields(failureRootElement).points.value, '0.2,20\n0,0');
  assert.equal(fields(failureRootElement).source.value, '保留來源');
  assert.equal(fields(failureRootElement).notes.value, '保留備註');
  failureRoot.unmount();

  const pendingElement = installDom();
  const pendingRoot = createRoot(pendingElement);
  let pendingCalls = 0;
  await act(async () => {
    pendingRoot.render(createElement(StressStrainSection, {
      material,
      units,
      editable: true,
      pending: true,
      onSave: () => { pendingCalls += 1; return null; },
    }));
  });
  const blocked = [...pendingElement.querySelectorAll('button')].find(button => button.textContent?.includes('加入完整曲線'));
  assert.equal(blocked?.hasAttribute('disabled'), true);
  await act(async () => { blocked?.click(); });
  assert.equal(pendingCalls, 0);
  assert.equal(pendingElement.textContent?.includes('儲存完整曲線'), false);
  pendingRoot.unmount();

  const openElement = installDom();
  const openRoot = createRoot(openElement);
  let openCalls = 0;
  const openSave = () => { openCalls += 1; return null; };
  await act(async () => {
    openRoot.render(createElement(StressStrainSection, {
      material,
      units,
      editable: true,
      onSave: openSave,
    }));
  });
  await act(async () => {
    [...openElement.querySelectorAll('button')].find(button => button.textContent?.includes('加入完整曲線'))!.click();
  });
  await act(async () => { setField(fields(openElement).points, '0,0\n0.1,10'); });
  await act(async () => {
    openRoot.render(createElement(StressStrainSection, {
      material,
      units,
      editable: true,
      pending: true,
      onSave: openSave,
    }));
  });
  const blockedSave = [...openElement.querySelectorAll('button')].find(button => button.textContent?.includes('儲存'))!;
  assert.match(blockedSave.textContent ?? '', /儲存中…/);
  assert.equal(blockedSave.hasAttribute('disabled'), true);
  await act(async () => { blockedSave.click(); });
  assert.equal(openCalls, 0);
  assert.equal(fields(openElement).points.value, '0,0\n0.1,10');
  openRoot.unmount();
}));

test('a synchronous curve error stays open and a synchronous success closes the editor', async () => withDom(async () => {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  await act(async () => {
    root.render(createElement(StressStrainSection, {
      material,
      units,
      editable: true,
      onSave: () => '曲線資料無效，未儲存。',
    }));
  });
  await act(async () => {
    [...rootElement.querySelectorAll('button')].find(button => button.textContent?.includes('加入完整曲線'))!.click();
  });
  const area = rootElement.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(area), 'value')?.set?.call(area, '0,0\n0.1,10');
    area.dispatchEvent(new rootElement.ownerDocument.defaultView!.Event('input', { bubbles: true }));
  });
  await act(async () => {
    [...rootElement.querySelectorAll('button')].find(button => button.textContent?.includes('儲存完整曲線'))!.click();
  });
  await flush();
  assert.match(rootElement.textContent ?? '', /曲線資料無效，未儲存。/);
  assert.equal(area.value, '0,0\n0.1,10');
  assert.match(rootElement.textContent ?? '', /儲存完整曲線/);

  root.unmount();
  const successElement = installDom();
  const successRoot = createRoot(successElement);
  await act(async () => {
    successRoot.render(createElement(StressStrainSection, {
      material: { ...material, stressStrainCurve: storedCurve },
      units,
      editable: true,
      onSave: () => null,
    }));
  });
  await act(async () => {
    [...successElement.querySelectorAll('button')].find(button => button.textContent?.includes('編輯完整曲線'))!.click();
  });
  await act(async () => {
    setField(fields(successElement).points, '0.2,20\n0,0\n-0.1,-5');
  });
  await act(async () => {
    [...successElement.querySelectorAll('button')].find(button => button.textContent?.includes('儲存完整曲線'))!.click();
  });
  await flush();
  assert.match(successElement.textContent ?? '', /編輯完整曲線/);
  assert.match(successElement.textContent ?? '', /匯出曲線 CSV/);
  assert.equal(successElement.textContent?.includes('儲存完整曲線'), false);
  const mode = successElement.querySelector('select') as HTMLSelectElement;
  assert.equal(mode.value, 'full');

  await act(async () => {
    [...successElement.querySelectorAll('button')].find(button => button.textContent?.includes('編輯完整曲線'))!.click();
  });
  assert.match(successElement.textContent ?? '', /儲存完整曲線/);
  await act(async () => {
    successRoot.render(createElement(StressStrainSection, {
      material: { ...material, stressStrainCurve: storedCurve },
      units,
      editable: false,
      onSave: () => null,
    }));
  });
  await flush();
  assert.equal(successElement.textContent?.includes('儲存完整曲線'), false);
  assert.equal(successElement.textContent?.includes('編輯完整曲線'), false);
  assert.match(successElement.textContent ?? '', /匯出曲線 CSV/);
  successRoot.unmount();
}));

const storedMaterial: Material = { ...material, stressStrainCurve: storedCurve };

test('delete curve is visible for an editable stored curve and hidden otherwise', () => {
  const admin = renderToStaticMarkup(createElement(StressStrainSection, {
    material: storedMaterial,
    units,
    editable: true,
    onSave: () => null,
    onDelete: () => null,
  }));
  assert.match(admin, /刪除完整曲線/);
  assert.match(admin, /danger-outline/);
  assert.match(admin, /編輯完整曲線/);
  assert.match(admin, /匯出曲線 CSV/);
  const noCurve = renderToStaticMarkup(createElement(StressStrainSection, {
    material,
    units,
    editable: true,
    onSave: () => null,
    onDelete: () => null,
  }));
  assert.equal(noCurve.includes('刪除完整曲線'), false);
  assert.match(noCurve, /加入完整曲線/);
  const nonAdmin = renderToStaticMarkup(createElement(StressStrainSection, {
    material: storedMaterial,
    units,
    editable: false,
    onSave: () => null,
    onDelete: () => null,
  }));
  assert.equal(nonAdmin.includes('刪除完整曲線'), false);
  assert.equal(nonAdmin.includes('編輯完整曲線'), false);
  assert.match(nonAdmin, /匯出曲線 CSV/);
});

function button(root: ParentNode, text: string) {
  return [...root.querySelectorAll('button')].find(item => item.textContent?.includes(text));
}

test('curve delete asks for confirmation and cancel leaves the stored curve', async () => withDom(async () => {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  let calls = 0;
  await act(async () => {
    root.render(createElement(StressStrainSection, {
      material: storedMaterial,
      units,
      editable: true,
      onSave: () => null,
      onDelete: () => { calls += 1; return null; },
    }));
  });
  await act(async () => { button(rootElement, '刪除完整曲線')!.click(); });
  const dialog = rootElement.querySelector('[role="alertdialog"]');
  assert.ok(dialog);
  assert.match(dialog?.textContent ?? '', /只會刪除這筆材料儲存的完整 Stress–strain 曲線，材料本身與其他材料性質不會刪除。/);
  assert.equal(calls, 0);
  await act(async () => { button(dialog!, '取消')!.click(); });
  assert.equal(calls, 0);
  assert.equal(rootElement.querySelector('[role="alertdialog"]'), null);
  assert.match(rootElement.textContent ?? '', /匯出曲線 CSV/);
  assert.match(rootElement.textContent ?? '', /編輯完整曲線/);
  const mode = rootElement.querySelector('select') as HTMLSelectElement;
  assert.equal(mode.value, 'full');
  root.unmount();
}));

test('confirming curve delete calls onDelete once, blocks a second click, and returns to idealized', async () => withDom(async () => {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  let calls = 0;
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let current: Material = storedMaterial;
  const render = () => {
    root.render(createElement(StressStrainSection, {
      material: current,
      units,
      editable: true,
      onSave: () => null,
      onDelete: () => {
        calls += 1;
        return gate.then(() => {
          current = material;
          render();
          return null;
        });
      },
    }));
  };
  await act(async () => { render(); });
  await act(async () => { button(rootElement, '刪除完整曲線')!.click(); });
  const confirm = button(rootElement.querySelector('[role="alertdialog"]')!, '刪除完整曲線')!;
  const cancel = button(rootElement.querySelector('[role="alertdialog"]')!, '取消')!;
  await act(async () => {
    confirm.click();
    confirm.click();
  });
  assert.equal(calls, 1);
  assert.match(confirm.textContent ?? '', /刪除中…/);
  assert.equal(confirm.hasAttribute('disabled'), true);
  assert.equal(cancel.hasAttribute('disabled'), true);
  await act(async () => {
    release();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  await flush();
  assert.equal(calls, 1);
  assert.equal(rootElement.textContent?.includes('刪除完整曲線'), false);
  assert.equal(rootElement.textContent?.includes('匯出曲線 CSV'), false);
  assert.equal(rootElement.textContent?.includes('編輯完整曲線'), false);
  assert.match(rootElement.textContent ?? '', /加入完整曲線/);
  const mode = rootElement.querySelector('select') as HTMLSelectElement;
  assert.equal(mode.value, 'idealized');
  const full = mode.querySelector('option[value="full"]') as HTMLOptionElement;
  assert.equal(full.disabled, true);
  root.unmount();
}));

test('a failed curve delete keeps the stored curve and shows the error', async () => withDom(async () => {
  const rootElement = installDom();
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const root = createRoot(rootElement);
  let calls = 0;
  await act(async () => {
    root.render(createElement(StressStrainSection, {
      material: storedMaterial,
      units,
      editable: true,
      onSave: () => null,
      onDelete: () => {
        calls += 1;
        return 'Supabase 移除曲線失敗：42501';
      },
    }));
  });
  await act(async () => { button(rootElement, '刪除完整曲線')!.click(); });
  await act(async () => { button(rootElement.querySelector('[role="alertdialog"]')!, '刪除完整曲線')!.click(); });
  await flush();
  assert.equal(calls, 1);
  assert.match(rootElement.textContent ?? '', /Supabase 移除曲線失敗：42501/);
  assert.match(rootElement.textContent ?? '', /匯出曲線 CSV/);
  assert.match(rootElement.textContent ?? '', /編輯完整曲線/);
  const mode = rootElement.querySelector('select') as HTMLSelectElement;
  assert.equal(mode.value, 'full');
  assert.ok(rootElement.querySelector('[role="alertdialog"]'));
  await act(async () => { button(rootElement.querySelector('[role="alertdialog"]')!, '刪除完整曲線')!.click(); });
  await flush();
  assert.equal(calls, 2);
  root.unmount();
}));
