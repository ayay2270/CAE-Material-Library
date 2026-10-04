import { HelpIcon, PlusIcon } from './icons';
import logo from '../assets/lenovo-logo.png';
export function Header({
  onHelp,
  onAdd,
}: {
  onHelp: () => void;
  onAdd: () => void;
}) {
  return (
    <header className="app-header">
      <div className="header-horizon" aria-hidden="true">
        <svg viewBox="0 0 1600 100" preserveAspectRatio="none">
          <path
            d="M0 69L95 63 160 68 246 60 340 62 420 52 516 56 590 49 670 53 780 42 886 47 980 31 1050 36 1130 25 1250 30 1360 19 1480 24 1600 14V100H0Z"
            fill="#b6cbd7"
          />
          <path
            d="M0 87L150 84 290 86 410 81 540 82 670 77 830 81 980 74 1120 77 1260 70 1400 72 1600 65V100H0Z"
            fill="#91adb5"
          />
          <path
            d="M0 96L220 93 450 94 670 90 880 91 1110 87 1340 89 1600 83V100H0Z"
            fill="#668a8c"
          />
        </svg>
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
