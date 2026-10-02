import { MaterialForm } from '../../components/MaterialForm';
import { ConfirmDelete, HelpDialog, ImportExportDialog, MapInfoDialog } from '../../components/Dialogs';
import { ColumnSettings } from '../../components/ColumnSettings';
import type { Library } from './useLibrary';

/** Add/Edit form, delete confirmation, import/export, help, map-info dialog and toast — shared, production components. */
export function LibraryDialogs({ L }: { L: Library }) {
  return (
    <>
      {L.editing && (
        <MaterialForm
          key={L.editing === 'new' ? 'new' : L.editing.id}
          initial={L.editing === 'new' ? null : L.editing}
          existing={L.materials}
          onSave={L.save}
          onClose={() => L.setEditing(null)}
        />
      )}
      {L.deleting && <ConfirmDelete material={L.deleting} onConfirm={L.confirmDelete} onClose={() => L.setDeleting(null)} />}
      {L.dialog === 'help' && <HelpDialog onClose={() => L.setDialog(null)} />}
      {L.dialog === 'mapInfo' && <MapInfoDialog onClose={() => L.setDialog(null)} />}
      {L.dialog === 'io' && (
        <ImportExportDialog
          materials={L.materials}
          visibleRows={L.rows}
          onImport={L.importMany}
          onReset={() => {
            L.resetToSamples();
            L.clearSelection();
          }}
          onClose={() => L.setDialog(null)}
        />
      )}
      {L.notice && (
        <div className="toast" role="status">
          {L.notice}
        </div>
      )}
    </>
  );
}

/** 欄位設定 popover (production component). Wrap in an element with position:relative. */
export function ColumnsPopover({ L }: { L: Library }) {
  if (!L.columnsOpen) return null;
  return (
    <ColumnSettings
      prefs={L.cols.prefs}
      units={L.units}
      onUnits={L.setUnits}
      onMove={L.cols.move}
      onStep={L.cols.step}
      onToggle={L.cols.toggle}
      onReset={L.cols.reset}
      onClose={() => L.setColumnsOpen(false)}
    />
  );
}
