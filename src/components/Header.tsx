import { HelpIcon, PlusIcon } from './icons';
import logo from '../assets/lenovo-logo.png';
import landscapeBackground from '../assets/header-mountain-lake.jpg';
import type { ReactNode } from 'react';
export function Header({
  onHelp,
  onAdd,
  editable,
  databaseStatus,
}: {
  onHelp: () => void;
  onAdd: () => void;
  editable: boolean;
  databaseStatus?: ReactNode;
}) {
  return (
    <header className="app-header">
      <div className="header-landscape" aria-hidden="true">
        <img src={landscapeBackground} width={5600} height={630} alt="" />
      </div>
      <div className="brand">
        <img className="logo-img" src={logo} alt="Lenovo" />
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
        <button className="btn primary" onClick={onAdd} title={editable ? '新增材料' : '請先連結本機資料庫'}>
          <PlusIcon size={15} /> 新增材料
        </button>
      </div>
    </header>
  );
}
