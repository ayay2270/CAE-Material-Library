# CAE 材料資料庫（CAE Material Library）

CAE 分析用的線上材料資料庫：瀏覽、搜尋、比較材料性質，並提供 OptiStruct 與 LS-DYNA 之間的塑性參數換算。

- 線上網站：https://ayay2270.github.io/CAE-Material-Library/
- 目前正式版本：**v2.0.0**（`main`）

## 主要功能

### 材料庫
- **表格 / 卡片** 兩種瀏覽方式，可依任一欄位排序。
- **搜尋**：材料名稱、關鍵字或來源（按 `/` 快速聚焦搜尋框）。
- **篩選**：材料分類、Source 來源、更新時間，以及 Material Model（只看 Isotropic / 只看 Orthotropic）。
- **欄位設定**：調整欄位順序、顯示或隱藏欄位（設定保存在瀏覽器）。
- **單位切換**：密度 t/mm³ ↔ kg/m³，應力 MPa ↔ GPa。顯示單位不影響儲存值。
- 左側索引列出材料分類與 Source 來源及其數量。

### 材料詳細頁
點選材料開啟完整詳細頁，分為四個分頁：
- **基本性質**：Density、Young's Modulus、Poisson's Ratio、Yield Stress、Ultimate Stress、Elongation，以及自動計算的 H / ETAN。
- **材料曲線**：理想化應力–應變曲線；若有儲存完整應力–應變曲線，會一併顯示所有資料點。
- **來源與備註**
- **歷史記錄**：建立、編輯、匯入的時間與摘要。

### 材料比較
勾選兩個以上的材料並排比較，數值不同的項目會特別標示。Isotropic 與 Orthotropic 材料可混合比較，不適用的欄位顯示「—」。

### Material Map
以 Density（X 軸）與 Young's Modulus（Y 軸）的對數座標散佈圖呈現材料分布，左上方為「輕量 + 高剛性」區域。Orthotropic 材料沒有單一 E 值，因此不會繪製在圖上。

### ETAN 計算（Solver Bridge）
- **H（OptiStruct MATS1 work hardening slope）**由 Young's Modulus、Yield Stress、Ultimate Stress 與 Elongation 自動計算（雙線性、真應力–真應變）。
- **ETAN（LS-DYNA MAT_003 tangent modulus）**由 E 與 H 換算：`ETAN = E × H / (E + H)`；反向換算：`H = ETAN / (1 − ETAN / E)`。
- 詳細頁並列顯示 OptiStruct 與 LS-DYNA 的對應參數（E/E、NU/PR、RHO/RO、LIMIT1/SIGY），缺少輸入時會列出缺少哪些欄位。

### Density Tuner
在幾何不變的前提下，依目標質量反推所需的材料密度，可指定質量單位（ton / kg / g）與數量。

### Orthotropic 複合材料
- Composite 類別可選擇 Material Model：**Isotropic** 或 **Orthotropic**。
- Orthotropic 材料儲存 Density 與九個彈性常數：E1、E2、E3、G12、G13、G23、ν12、ν13、ν23。
- 卡片顯示 ρ、E1、E2、E3、G12；詳細頁與比較顯示全部九個常數。
- 線上範例：在網址後加上 `?example=fr4-orthotropic`，可開啟獨立的 FR4 Orthotropic 範例（只存在目前分頁，不會寫入正式資料）。

## 資料來源與權限

正式網站使用 **Supabase** 作為材料資料來源（schema `material_library`）。

| 角色 | 可以做的事 |
|---|---|
| 所有人 | 瀏覽、搜尋、篩選、比較、Material Map、ETAN 計算、Density Tuner；匯出 CSV（全部或目前列表）與完整 JSON 備份 |
| Material Library Admin（已登入並通過權限確認） | 新增 / 編輯 / 刪除材料；新增 / 編輯 / 刪除完整應力–應變曲線（刪除曲線不會刪除材料）；新增分類或修改分類名稱；新增 Source 或修改 Source 名稱 |

- Admin 的寫入會直接存入 Supabase，不需要另外按「儲存資料庫」。
- 寫入權限由 Supabase Row Level Security 控管；介面隱藏按鈕只是輔助。
- Supabase 模式目前**尚未開放**：刪除分類、刪除 Source、CSV 匯入寫入、JSON 匯入 / 復原寫入、儲存資料庫、舊版 GitHub 寫入。

不設定 Supabase 時，程式會使用舊版（legacy）資料來源：`src/data/materials.json`，搭配本機編輯與「儲存資料庫」流程。

## 已知限制

- CSV 匯出的 H 欄位仍是舊版儲存值（legacy stored `etan`），而介面顯示的是自動計算的 H，兩者可能略有差異（例如 Al7050：介面 1196.42 MPa，匯出 1205.42 MPa）。
- 資料中沒有 MAT ID 等求解器卡片欄位，也尚未提供 LS-DYNA / OptiStruct 材料卡匯出。
- Orthotropic 的 Composite Strength（Xt、Xc、Yt、Yc、S12）目前只保留在資料中，介面不顯示也不能編輯。

## 本機開發

需要 Node.js 22。

```sh
npm ci
npm run dev        # 開發伺服器（legacy 資料來源）
npm test           # 單元與整合測試
npm run build      # 型別檢查 + 正式建置
```

若要在本機使用 Supabase，請建立 `.env.local`（已列入 `.gitignore`，不要提交）：

```text
VITE_MATERIAL_DATA_SOURCE=supabase
VITE_SUPABASE_URL=<project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

只能使用 publishable key，不可使用 service-role key 或資料庫密碼。

## 部署

推送到 `main` 時，GitHub Actions（`.github/workflows/pages.yml`）會執行測試、以 Supabase 模式建置並部署到 GitHub Pages。建置需要在 repository 的 Actions variables 設定 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`；缺少任何一個時，workflow 會停止，不會部署。

## 技術架構

React 18、TypeScript、Vite 6、`@supabase/supabase-js`，樣式為純 CSS。

## 其他文件

`docs/` 目錄內有各功能的設計與驗證記錄（英文）：

- `orthotropic-support.md`：Orthotropic 資料欄位、CSV 與未來求解器對應
- `supabase-readonly-integration.md`：Supabase 資料讀取與 Pages 部署設定
- `supabase-material-crud.md`、`supabase-material-write-rls.md`：材料寫入與權限
- `supabase-admin-auth-design.md`、`supabase-admin-login.md`：Admin 登入與權限確認
- `storage-architecture.md`、`storage-verification.md`：legacy 儲存架構
