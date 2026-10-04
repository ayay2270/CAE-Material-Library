import { HelpIcon, PlusIcon } from './icons';
import logo from '../assets/lenovo-logo.png';
import engineeringBackground from '../assets/material-metal-sheet.jpg';
export function Header({
  onHelp,
  onAdd,
}: {
  onHelp: () => void;
  onAdd: () => void;
}) {
  return (
    <header className="app-header">
      <div className="header-engineering" aria-hidden="true">
        <img src={engineeringBackground} width={2400} height={1600} alt="" />
      </div>
      <div className="brand">
        <img className="logo-img" src={logo} alt="Lenovo" />
        <div>
          <span className="brand-title">CAE Material Library</span>
          <span className="brand-subtitle">CAE 材料資料庫</span>
        </div>
      </div>
      <div className="header-actions">
        <button className="header-help" onClick={onHelp}>
          <HelpIcon size={17} /> 使用說明
        </button>
        <button className="btn primary" onClick={onAdd}>
          <PlusIcon size={15} /> 新增材料
        </button>
      </div>
    </header>
  );
}
