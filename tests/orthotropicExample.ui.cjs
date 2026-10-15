// Production browser test: no file picker mocks or storage injection.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const seedPath = path.join(__dirname, '../src/data/materials.json');
  const before = await fs.readFile(seedPath, 'utf8');
  const master = JSON.parse(before);
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`); });
    const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4190/CAE-Material-Library-V2-Preview/';
    await page.goto(base);
    await page.getByRole('link', { name: '開啟 FR4 Orthotropic 獨立範例', exact: true }).click();
    await page.getByRole('region', { name: 'FR4 獨立範例', exact: true }).waitFor();
    const outputDir = process.env.OUTPUT_DIR;
    const screenshot = async name => { if (outputDir) { await fs.mkdir(outputDir, { recursive: true }); await page.screenshot({ path: path.join(outputDir, name) }); } };
    await page.getByRole('button', { name: '查看範例', exact: true }).click();
    let dialog = page.getByRole('dialog');
    assert.match(await dialog.innerText(), /4,400/);
    assert.equal(await dialog.getByText('Yield Stress', { exact: true }).count(), 0);
    await screenshot('example-drawer.png');
    await dialog.getByRole('button', { name: '關閉', exact: true }).click();
    await page.getByRole('button', { name: '編輯範例', exact: true }).click();
    dialog = page.getByRole('dialog');
    assert.equal(await dialog.getByLabel(/^Density/).inputValue(), '1.8e-9');
    for (const [label, value] of Object.entries({ E1: 22000, E2: 22000, E3: 4400, G12: 8595, G13: 1720, G23: 1720, 'ν12': 0.28, 'ν13': 0.28, 'ν23': 0.4 })) {
      assert.equal(await dialog.getByLabel(new RegExp(`^${label}(?: |$)`)).inputValue(), String(value));
    }
    await screenshot('example-edit.png');
    await dialog.getByLabel(/^E3 /).fill('4500');
    await dialog.getByRole('button', { name: '儲存變更', exact: true }).click();
    await page.getByRole('button', { name: '儲存範例', exact: true }).click();
    await page.getByText('獨立範例 · 已儲存在此分頁', { exact: true }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: '編輯範例', exact: true }).click();
    dialog = page.getByRole('dialog');
    assert.equal(await dialog.getByLabel(/^E3 /).inputValue(), '4500');
    await dialog.getByLabel(/^E3 /).fill('4400');
    await dialog.getByRole('button', { name: '儲存變更', exact: true }).click();
    await page.getByRole('button', { name: '儲存範例', exact: true }).click();
    await page.getByText('獨立範例 · 已儲存在此分頁', { exact: true }).waitFor();
    const stored = await page.evaluate(() => JSON.parse(sessionStorage.getItem('cae-material-library:fr4-example:v1')));
    assert.deepEqual(stored.materials.slice(0, master.materials.length), master.materials);
    await page.getByRole('button', { name: '新增材料', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Material Name *', { exact: true }).fill('FR4 New Example');
    await dialog.getByLabel('Category', { exact: true }).selectOption('Composite');
    await dialog.getByLabel('Material Model', { exact: true }).selectOption('Orthotropic');
    assert.equal(await dialog.getByLabel(/^Yield Stress/).count(), 0);
    assert.equal(await dialog.getByLabel(/^H \(MATS1\)/).count(), 0);
    await screenshot('example-add.png');
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await page.getByRole('button', { name: 'Mixed Compare', exact: true }).click();
    const comparison = page.getByTestId('compare-table');
    await comparison.waitFor();
    assert.match(await comparison.innerText(), /SGCC/);
    assert.match(await comparison.innerText(), /FR4 Orthotropic Example/);
    assert.match(await comparison.innerText(), /ν23/);
    const e1row = comparison.locator('tr').filter({ has: page.locator('td.prop-col', { hasText: /^E1 / }) });
    assert.equal(await e1row.locator('td.missing').count(), 1);
    await screenshot('example-mixed-compare.png');
    await page.getByRole('link', { name: '離開範例', exact: true }).click();
    assert.equal(await page.getByRole('region', { name: 'FR4 獨立範例', exact: true }).count(), 0);
    assert.equal(await page.getByRole('cell', { name: 'FR4 Orthotropic Example', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '全部材料 11', exact: true }).count(), 1);
    assert.deepEqual(writes, [], 'sandbox does not write to any HTTP service');
    assert.deepEqual(errors, []);
    assert.equal(await fs.readFile(seedPath, 'utf8'), before);
    console.log('PASS: real production example link; Drawer, Edit nine constants, save/reload, Add, Mixed Compare; exit restores original 11 records; no HTTP writes, no runtime errors; seed unchanged.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
