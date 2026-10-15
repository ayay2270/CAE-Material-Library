// Run against npm run preview. Only an isolated in-browser file fixture is written.
// PLAYWRIGHT_MODULE / BROWSER_CHANNEL support the same setup as existing UI scripts.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const seedPath = path.join(__dirname, '../src/data/materials.json');
  const seedText = await fs.readFile(seedPath, 'utf8');
  const seed = JSON.parse(seedText);
  const constants = { e1: 22000, e2: 22000, e3: 4400, g12: 8595, g13: 1720, g23: 1720, nu12: 0.28, nu13: 0.28, nu23: 0.4 };
  const name = 'FR4 Orthotropic Example';
  const outputDir = process.env.OUTPUT_DIR || os.tmpdir();
  await fs.mkdir(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(database => {
      const key = 'orthotropic-test-file';
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(database));
      const handle = {
        kind: 'file', name: 'materials.json',
        queryPermission: async () => 'granted', requestPermission: async () => 'granted',
        getFile: async () => new File([sessionStorage.getItem(key)], 'materials.json'),
        async createWritable() {
          let pending;
          return { write: async text => { pending = text; }, close: async () => { sessionStorage.setItem(key, pending); }, abort: async () => {} };
        },
      };
      window.showOpenFilePicker = async () => [handle];
      Object.defineProperty(window, 'indexedDB', { value: {
        open() {
          const request = { result: { close() {}, transaction() {
            const tx = { objectStore: () => ({
              get: () => ({ result: sessionStorage.getItem('orthotropic-remembered') ? handle : undefined }),
              put: () => { sessionStorage.setItem('orthotropic-remembered', 'yes'); return {}; },
              delete: () => { sessionStorage.removeItem('orthotropic-remembered'); return {}; },
            }) };
            setTimeout(() => tx.oncomplete?.(), 0);
            return tx;
          } } };
          setTimeout(() => request.onsuccess?.(), 0);
          return request;
        },
      } });
    }, seed);
    // The app's sync is read-only. Keep this test independent of GitHub/network state.
    await page.route('https://api.github.com/**', route => {
      assert.equal(route.request().method(), 'GET');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route.request().url().includes('/commits/main') ? { sha: 'a'.repeat(40) } : seed) });
    });
    await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:4173/CAE-Material-Library-V2-Preview/');
    const saveDatabase = page.getByRole('button', { name: 'Save Database', exact: true });
    await page.getByRole('button', { name: '連結本機資料庫', exact: true }).click();
    await saveDatabase.waitFor();
    const menu = page.locator('.database-status-menu');
    if (await menu.getAttribute('open') !== null) await menu.locator('summary').click();
    const drawer = page.locator('.drawer .dialog');
    const row = materialName => page.locator('.materials-page tbody tr').filter({ has: page.getByText(materialName, { exact: true }) });
    const stored = async () => page.evaluate(() => JSON.parse(sessionStorage.getItem('orthotropic-test-file')));
    const persist = async () => {
      await saveDatabase.click();
      await page.waitForFunction(() => document.querySelector('.database-status-menu > summary')?.textContent.includes('儲存成功'));
    };
    const screenshot = file => page.screenshot({ path: path.join(outputDir, file), fullPage: true, animations: 'disabled' });

    // Legacy FR4 stays isotropic until a manual selection, and cancelling is reversible.
    await row('FR4').click();
    assert.equal(await drawer.locator('.prop-grid dt').filter({ hasText: /^Yield Stress$/ }).count(), 1);
    await drawer.getByRole('button', { name: '編輯', exact: true }).click();
    let form = page.getByRole('dialog', { name: '編輯 FR4', exact: true });
    await form.waitFor();
    assert.equal(await form.getByLabel('Material Model', { exact: true }).inputValue(), 'Isotropic');
    assert.equal(await form.getByLabel(/^Young's Modulus/).inputValue(), '25000');
    assert.equal(await form.getByLabel(/^Density/).inputValue(), '1.8e-9');
    await form.getByLabel('Material Model', { exact: true }).selectOption('Orthotropic');
    assert.equal(await form.getByLabel(/^Yield Stress/).count(), 0);
    assert.equal(await form.getByLabel(/^Density/).inputValue(), '1.8e-9');
    await form.getByRole('button', { name: '取消', exact: true }).click();
    await drawer.getByRole('button', { name: '關閉', exact: true }).click();

    // Create using the real conditional form, including numeric validation.
    await page.getByRole('button', { name: '新增材料', exact: true }).click();
    form = page.getByRole('dialog', { name: '新增材料', exact: true });
    await form.getByLabel('Material Name *', { exact: true }).fill(name);
    await form.getByLabel('Category', { exact: true }).selectOption('Composite');
    await form.getByLabel('Sub Category', { exact: true }).selectOption('PCB Laminate (FR4)');
    await form.getByLabel('Material Model', { exact: true }).selectOption('Orthotropic');
    await form.getByLabel(/^Density/).fill('1.8E-9');
    for (const [key, value] of Object.entries(constants)) {
      const label = key.startsWith('nu') ? key.replace('nu', 'ν') : key.toUpperCase();
      await form.getByLabel(new RegExp(`^${label}(?: |$)`)).fill(String(value));
    }
    await form.getByLabel(/^Xt /).fill('300');
    await form.getByLabel(/^E1 /).fill('0');
    await form.getByRole('button', { name: '新增', exact: true }).click();
    assert.equal(await form.getByText('必須大於 0。', { exact: true }).count(), 1);
    await form.getByLabel(/^E1 /).fill('22000');
    await form.getByLabel(/^G13 /).fill('-1');
    assert.equal(await form.getByLabel(/^G13 /).getAttribute('aria-invalid'), 'true');
    await form.getByLabel(/^G13 /).fill('1720');
    await form.getByLabel(/^ν13/).fill('bad');
    assert.equal(await form.getByLabel(/^ν13/).getAttribute('aria-invalid'), 'true');
    await form.getByLabel(/^ν13/).fill('0.28');
    // Model switching within the dialog retains constants without imposing isotropic ν rules.
    await form.getByLabel('Material Model', { exact: true }).selectOption('Isotropic');
    assert.equal(await form.getByLabel(/^Yield Stress/).count(), 1);
    await form.getByLabel('Material Model', { exact: true }).selectOption('Orthotropic');
    assert.equal(await form.getByLabel(/^E3 /).inputValue(), '4400');
    assert.equal(await form.getByLabel(/^H \(MATS1\)/).count(), 0);
    await screenshot('orthotropic-form-desktop.png');
    await form.getByRole('button', { name: '新增', exact: true }).click();
    await form.waitFor({ state: 'hidden' });
    await persist();
    let record = (await stored()).materials.find(m => m.name === name);
    assert.deepEqual(record.orthotropic, constants);
    assert.equal(record.compositeStrength.xt, 300);
    assert.equal(record.compositeStrength.yc, null);
    assert.equal(record.density, 1.8e-9);

    await row(name).click();
    assert.equal(await drawer.getByText('Yield Stress', { exact: true }).count(), 0);
    assert.equal(await drawer.getByText('Orthotropic Elastic Properties', { exact: false }).count() >= 1, true);
    assert.ok((await drawer.textContent()).includes('8,595'));
    await screenshot('orthotropic-drawer-desktop.png');
    await drawer.getByRole('button', { name: '編輯', exact: true }).click();
    form = page.getByRole('dialog', { name: `編輯 ${name}`, exact: true });
    for (const [key, value] of Object.entries(constants)) {
      const label = key.startsWith('nu') ? key.replace('nu', 'ν') : key.toUpperCase();
      assert.equal(await form.getByLabel(new RegExp(`^${label}(?: |$)`)).inputValue(), String(value));
    }
    await form.getByLabel(/^E3 /).fill('');
    await form.getByLabel(/^ν12/).fill('0.8'); // no isotropic 0.5 cap
    await form.getByRole('button', { name: '儲存變更', exact: true }).click();
    await drawer.getByRole('button', { name: '關閉', exact: true }).click();
    await persist();
    record = (await stored()).materials.find(m => m.name === name);
    assert.equal(record.orthotropic.e3, null);
    assert.equal(record.orthotropic.nu12, 0.8);
    await page.reload();
    await saveDatabase.waitFor();
    await row(name).click();
    await drawer.getByRole('button', { name: '編輯', exact: true }).click();
    form = page.getByRole('dialog', { name: `編輯 ${name}`, exact: true });
    assert.equal(await form.getByLabel(/^E3 /).inputValue(), '');
    assert.equal(await form.getByLabel(/^ν12/).inputValue(), '0.8');
    await form.getByLabel(/^E3 /).fill('4400');
    await form.getByLabel(/^ν12/).fill('0.28');
    await form.getByRole('button', { name: '儲存變更', exact: true }).click();
    await drawer.getByRole('button', { name: '關閉', exact: true }).click();
    await persist();
    assert.deepEqual((await stored()).materials.find(m => m.name === name).orthotropic, constants);

    // Saving another model must retain inactive constants for a later explicit switch.
    await row(name).click();
    await drawer.getByRole('button', { name: '編輯', exact: true }).click();
    form = page.getByRole('dialog', { name: `編輯 ${name}`, exact: true });
    await form.getByLabel('Material Model', { exact: true }).selectOption('Isotropic');
    await form.getByRole('button', { name: '儲存變更', exact: true }).click();
    await drawer.getByRole('button', { name: '關閉', exact: true }).click();
    await persist();
    await page.reload();
    await saveDatabase.waitFor();
    await row(name).click();
    await drawer.getByRole('button', { name: '編輯', exact: true }).click();
    form = page.getByRole('dialog', { name: `編輯 ${name}`, exact: true });
    await form.getByLabel('Material Model', { exact: true }).selectOption('Orthotropic');
    assert.equal(await form.getByLabel(/^E3 /).inputValue(), '4400');
    assert.equal(await form.getByLabel(/^ν23/).inputValue(), '0.4');
    await form.getByRole('button', { name: '儲存變更', exact: true }).click();
    await drawer.getByRole('button', { name: '關閉', exact: true }).click();
    await persist();
    assert.deepEqual((await stored()).materials.find(m => m.name === name).orthotropic, constants);

    // Actual CSV importMany must detect an E1-only update; old CSV cannot erase constants.
    const openIO = () => page.getByRole('button', { name: '匯入 / 匯出', exact: true }).click();
    await openIO();
    let io = page.getByRole('dialog', { name: '匯入 / 匯出', exact: true });
    const csv = `Name,Category,Density,Material Model,Sub Category,E1,E2,E3,G12,G13,G23,NU12,NU13,NU23,Xt,Xc,Yt,Yc,S12\n${name},Composite,1.8E-9,Orthotropic,PCB Laminate (FR4),23000,22000,4400,8595,1720,1720,0.28,0.28,0.4,300,,,,`;
    await io.getByTestId('csv-input').setInputFiles({ name: 'orthotropic.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await io.getByText(/更新 1 筆/).waitFor();
    await io.getByTestId('csv-input').setInputFiles({ name: 'old.csv', mimeType: 'text/csv', buffer: Buffer.from(`Name,Category,Density\n${name},Composite,1.81E-9`) });
    await io.getByText(/更新 1 筆/).waitFor();
    await io.getByRole('button', { name: 'Close', exact: true }).click();
    await persist();
    await page.reload();
    await saveDatabase.waitFor();
    record = (await stored()).materials.find(m => m.name === name);
    assert.equal(record.orthotropic.e1, 23000);
    assert.equal(record.orthotropic.nu23, 0.4);
    assert.equal(record.compositeStrength.xt, 300);
    assert.equal(record.materialModel, 'Orthotropic');
    assert.match(record.history.map(h => h.summary).join('\n'), /E1: 22,000 → 23,000/);
    assert.deepEqual((await stored()).materials.find(m => m.name === 'FR4'), seed.materials.find(m => m.name === 'FR4'));

    // JSON/CSV downloads retain new data.
    await openIO();
    io = page.getByRole('dialog', { name: '匯入 / 匯出', exact: true });
    const pending = page.waitForEvent('download');
    await io.getByRole('button', { name: '下載完整 JSON 備份', exact: true }).click();
    const downloaded = JSON.parse(await fs.readFile(await (await pending).path(), 'utf8'));
    assert.deepEqual(downloaded.materials.find(m => m.name === name), record);
    await io.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('button', { name: '卡片', exact: true }).click();
    const card = page.getByRole('article', { name: `${name} 材料卡片`, exact: true });
    assert.equal(await card.locator('dt').allTextContents().then(x => x.join(',')), 'ρ,E1,E2,E3,G12');
    await screenshot('orthotropic-cards-desktop.png');
    await card.getByRole('checkbox').check();
    await page.getByRole('article', { name: 'SGCC 材料卡片', exact: true }).getByRole('checkbox').check();
    await page.getByRole('button', { name: /比較材料/ }).click();
    const comparison = page.getByTestId('compare-table');
    assert.ok((await comparison.textContent()).includes('ν23'));
    const e1row = comparison.locator('tr').filter({ has: page.locator('td.prop-col', { hasText: /^E1 / }) });
    assert.equal(await e1row.locator('td.missing').count(), 1);
    await screenshot('orthotropic-mixed-compare.png');

    // Narrow form and drawer layouts, keyboard-accessible engineering tooltip.
    await page.getByRole('button', { name: '返回材料列表', exact: true }).click();
    await card.getByRole('button', { name, exact: true }).click();
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await drawer.evaluate(el => el.scrollWidth > el.clientWidth), false);
    await screenshot('orthotropic-drawer-mobile.png');
    await drawer.getByRole('button', { name: '編輯', exact: true }).click();
    form = page.getByRole('dialog', { name: `編輯 ${name}`, exact: true });
    assert.equal(await form.evaluate(el => el.scrollWidth > el.clientWidth), false);
    await form.getByRole('button', { name: 'Material principal directions information' }).focus();
    assert.equal(await form.getByRole('tooltip').isVisible(), true);
    await screenshot('orthotropic-form-mobile.png');
    await form.getByRole('button', { name: '取消', exact: true }).click();
    await drawer.getByRole('button', { name: '關閉', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Metal's real form stays active; the drawer recalculates H and ETAN from the edited properties.
    await page.getByRole('article', { name: 'SGCC 材料卡片', exact: true }).getByRole('button', { name: 'SGCC', exact: true }).click();
    assert.equal(await page.getByTestId('hardening-h-result').textContent(), '740.07 MPa');
    assert.equal(await page.getByTestId('tangent-etan-result').textContent(), '737.34 MPa');
    await drawer.getByRole('button', { name: '編輯', exact: true }).click();
    form = page.getByRole('dialog', { name: '編輯 SGCC', exact: true });
    await form.getByLabel(/^Yield Stress/).fill('300');
    await form.getByRole('button', { name: '儲存變更', exact: true }).click();
    // Independent bilinear oracle: E = 200000, σy = 300, σu = 356, elongation = 40 %.
    const hardening = (356 * 1.4 - 300 * (1 + 300 / 200000)) / (Math.log1p(0.4) - Math.log1p(300 / 200000));
    assert.equal(await page.getByTestId('hardening-h-result').textContent(), `${hardening.toFixed(2)} MPa`);
    assert.equal(await page.getByTestId('tangent-etan-result').textContent(), `${(200000 * hardening / (200000 + hardening)).toFixed(2)} MPa`);
    assert.equal(await page.getByTestId('mat003-sigy').textContent(), '300');
    assert.deepEqual(errors, []);
    assert.equal(await fs.readFile(seedPath, 'utf8'), seedText, 'UI fixtures must not change Git seed JSON');
    console.log('PASS: legacy FR4 unchanged; create/edit nine constants; blanks/validation/model switching; Save/reload; E1-only CSV updates; old CSV preserves new fields; JSON download; Drawer/Cards/Mixed Compare; desktop/mobile; tooltip; no runtime errors.');
  } catch (error) {
    for (const page of browser.contexts().flatMap(context => context.pages())) {
      console.error('Visible dialogs:', await page.getByRole('dialog').allTextContents());
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
