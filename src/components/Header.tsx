import { HelpIcon, PlusIcon } from './icons';
import logo from '../assets/lenovo-logo.png';
import landscapeBackground from '../assets/header-mountain-lake.jpg';
import type { ReactNode } from 'react';
import { LOCAL_EDITING_HINT } from '../lib/localEditing';
export function Header({
  onHome,
  onHelp,
  onAdd,
  editable,
  readOnlyTitle = LOCAL_EDITING_HINT,
  databaseStatus,
}: {
  onHome: () => void;
  onHelp: () => void;
  onAdd: () => void;
  editable: boolean;
  readOnlyTitle?: string;
  databaseStatus?: ReactNode;
}) {
  return (
    <header className="app-header">
      <div className="header-landscape" aria-hidden="true">
        <img src={landscapeBackground} width={5600} height={630} alt="" />
      </div>
      <div className="brand">
        <button type="button" className="brand-home" onClick={onHome} aria-label="回到材料庫首頁" title="回到材料庫首頁">
          <img className="logo-img" src={logo} alt="Lenovo" />
        </button>
        <div>
          <span className="brand-title">CAE Material Library</span>
          <span className="brand-subtitle">CAE 材料資料庫</span>
        </div>
      </div>
      <div className="header-actions">
        {databaseStatus}
        <button className="header-help" onClick={onHelp}>
          <HelpIcon size={17} /> 使用說明
        </button>
        <button className="btn primary" onClick={onAdd} title={editable ? '新增材料' : readOnlyTitle}>
          <PlusIcon size={15} /> 新增材料
        </button>
      </div>
    </header>
  );
}
