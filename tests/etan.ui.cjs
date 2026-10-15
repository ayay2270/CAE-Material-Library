const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/CAE-Material-Library-V2-Preview/');
    await page.locator('.materials-page tbody tr').filter({ has: page.getByText('SGCC', { exact: true }) }).click();
    const drawer = page.locator('.drawer .dialog');
    const result = page.getByTestId('hardening-h-result');
    const tangent = page.getByTestId('tangent-etan-result');
    const panel = page.getByRole('region', { name: 'Solver Plasticity', exact: true });
    // Independent oracle for the bilinear H and the H → ETAN conversion (MPa, elongation in %).
    const hardening = (E, sy, su, el) => (su * (1 + el / 100) - sy * (1 + sy / E)) / (Math.log1p(el / 100) - Math.log1p(sy / E));
    const tangentOf = (E, H) => E * H / (E + H);
    assert.equal(await result.textContent(), '740.07 MPa');
    assert.equal(await tangent.textContent(), '737.34 MPa');
    assert.equal(await result.textContent(), `${hardening(200000, 250, 356, 40).toFixed(2)} MPa`);
    assert.equal(await page.getByTestId('mat003-sigy').textContent(), '250');
    assert.equal(await page.getByTestId('mat003-e').textContent(), '200,000');
    assert.equal(await page.getByTestId('mat003-pr').textContent(), '0.3');
    assert.equal(await page.getByTestId('mat003-ro').textContent(), '7.82E-9');
    assert.equal(await panel.getByRole('region', { name: 'OptiStruct MAT1 MATS1 result' }).count(), 1);
    assert.equal(await panel.getByRole('region', { name: 'LS-DYNA MAT_003 result' }).count(), 1);
    assert.equal(await panel.locator('input').count(), 0);
    assert.equal(await panel.locator('details').getAttribute('open'), null);
    assert.ok(!(await panel.textContent()).includes('Stored'));
    assert.equal(await drawer.locator('.prop-grid dt').filter({ hasText: /^H \(MATS1\)/ }).count(), 0);
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'solver-properties-desktop.png'), fullPage: true, animations: 'disabled' });
    await panel.getByText('Show calculation details', { exact: true }).click();
    for (const expected of ['A. H · OptiStruct MATS1', 'Calculated H = 740.07 MPa', 'B. ETAN · LS-DYNA MAT_003', 'ETAN = 737.34 MPa', '200000 × 740.067022', '200000 + 740.067022', 'OptiStruct → LS-DYNA', 'LS-DYNA → OptiStruct']) {
      assert.ok((await panel.locator('details').textContent()).includes(expected), expected);
    }
    assert.equal(await panel.locator('.etan-auto-steps').count(), 1); // H is calculated from the material properties.
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth), false);
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'solver-properties-mobile.png'), fullPage: true, animations: 'disabled' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    // Preserve full curve points while editing the properties that drive H.
    await drawer.getByRole('tab', { name: '材料曲線' }).click();
    await drawer.getByRole('button', { name: '加入完整曲線' }).click();
    await drawer.locator('textarea').first().fill('0,0\n0.00125,250\n0.4,356');
    await drawer.getByRole('button', { name: '儲存完整曲線' }).click();
    await drawer.getByRole('button', { name: '編輯完整曲線' }).waitFor();
    await drawer.getByRole('tab', { name: '基本性質' }).click();
    assert.equal(await result.textContent(), '740.07 MPa');
    const edit = async values => {
      await drawer.getByRole('button', { name: '編輯', exact: true }).click();
      const form = page.getByRole('dialog', { name: '編輯 SGCC' });
      for (const [label, value] of Object.entries(values)) await form.getByLabel(new RegExp(`^${label}`)).fill(value);
      await form.getByRole('button', { name: '儲存變更', exact: true }).click();
      await result.waitFor();
    };
    await edit({ Elongation: '50' });
    const h50 = hardening(200000, 250, 356, 50);
    assert.equal(await result.textContent(), `${h50.toFixed(2)} MPa`); // Recalculated from the edited properties.
    assert.equal(await tangent.textContent(), `${tangentOf(200000, h50).toFixed(2)} MPa`);
    await edit({ Elongation: '40', 'H \\(MATS1\\)': '300' });
    assert.equal(await result.textContent(), '740.07 MPa'); // The legacy stored H field no longer drives the drawer.
    assert.equal(await tangent.textContent(), '737.34 MPa');
    // Clearing the legacy field changes nothing here; the ETAN page below relies on it being empty.
    await edit({ 'H \\(MATS1\\)': '', 'Yield Stress': '300' });
    assert.equal(await result.textContent(), `${hardening(200000, 300, 356, 40).toFixed(2)} MPa`);
    assert.equal(await page.getByTestId('mat003-sigy').textContent(), '300');
    await edit({ 'Yield Stress': '250', "Young's Modulus": '' });
    assert.equal(await result.textContent(), 'Not available');
    assert.equal(await tangent.textContent(), 'Not available');
    assert.ok((await panel.textContent()).includes("Missing: Young's Modulus"));
    await edit({ "Young's Modulus": '200000' });
    await drawer.getByRole('tab', { name: '材料曲線' }).click();
    await drawer.getByRole('button', { name: '編輯完整曲線' }).click();
    assert.equal(await drawer.locator('textarea').first().inputValue(), '0,0\n0.00125,250\n0.4,356');
    await drawer.getByRole('button', { name: '取消曲線編輯' }).click();
    await drawer.getByRole('tab', { name: '基本性質' }).click();
    await edit({ 'Ultimate Stress': '' });
    assert.equal(await result.textContent(), 'Not available');
    assert.equal(await tangent.textContent(), 'Not available');
    for (const text of ['Missing: Ultimate Stress', 'Requires H']) assert.ok((await panel.textContent()).includes(text), text);
    assert.equal(await panel.locator('details').count(), 1);
    await edit({ 'Ultimate Stress': '200' });
    assert.ok((await panel.textContent()).includes('Invalid: Ultimate Stress is below Yield Stress'));
    await edit({ 'Ultimate Stress': '356', Elongation: '40' });
    assert.equal(await result.textContent(), '740.07 MPa');
    assert.equal(await tangent.textContent(), '737.34 MPa');
    assert.equal(await page.getByTestId('mat003-sigy').textContent(), '250');
    for (const [width, height] of [[375, 812], [667, 375], [768, 900]]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      if (await panel.locator('details').getAttribute('open') == null) await panel.getByText('Show calculation details', { exact: true }).click();
      assert.equal(await panel.evaluate(el => el.scrollWidth > el.clientWidth), false);
      assert.equal(await panel.locator('.etan-auto-details-body').evaluate(el => el.scrollWidth > el.clientWidth), false);
    }
    await page.setViewportSize({ width: 375, height: 812 });
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'etan-properties-mobile.png'), fullPage: true });
    await drawer.getByRole('button', { name: '關閉', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: 'ETAN 計算' }).click();
    await page.locator('.etan-pick select').selectOption('seed-7');
    assert.equal(await result.textContent(), '740.07 MPa');
    assert.equal(await tangent.textContent(), '737.34 MPa');
    const details = page.locator('.etan-page details');
    assert.equal(await details.getAttribute('open'), null);
    await details.getByText('Show calculation details', { exact: true }).click();
    assert.notEqual(await details.getAttribute('open'), null);
    for (const expected of ['0.400000', '250.313 MPa', '498.400 MPa', 'Formula Reference']) {
      assert.ok((await details.textContent()).includes(expected));
    }
    await page.screenshot({ path: path.join(process.env.TEMP || '.', 'etan-page-expanded.png'), fullPage: true });
    await page.locator('.etan-inputs input').nth(3).fill('50');
    assert.ok((await details.textContent()).includes('0.500000'));
    await page.locator('.etan-inputs input').nth(3).fill('');
    assert.ok((await details.textContent()).includes('Enter valid material values'));
    assert.equal(await details.locator('.etan-auto-steps').count(), 0);
    await page.locator('.etan-inputs input').nth(3).fill('40');
    for (const width of [375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.locator('.etan-card').evaluate(el => el.scrollWidth > el.clientWidth), false);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await details.getByText('Hide calculation details', { exact: true }).click();
    assert.equal(await details.getAttribute('open'), null);
    await page.getByRole('navigation', { name: 'Workspace', exact: true }).getByRole('button', { name: '材料庫', exact: true }).click();
    await page.locator('.materials-page tbody tr').filter({ has: page.getByText('ChipSet', { exact: true }) }).click();
    assert.equal(await result.textContent(), 'Not available');
    assert.equal(await tangent.textContent(), 'Not available');
    assert.ok((await page.getByRole('region', { name: 'Solver Plasticity', exact: true }).textContent()).includes('Missing: Yield Stress, Ultimate Stress, Elongation'));
    assert.deepEqual(errors, []);
    console.log('PASS: calculated SGCC H/ETAN, legacy stored H ignored, full-precision conversion, SIGY from Yield Stress, collapse/expand, preserved upstream estimate and full curves, missing/inconsistent inputs, responsive layouts, existing calculator, no runtime errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
