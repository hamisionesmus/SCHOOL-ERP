'use client';

import { useRef, useState } from 'react';
import { Download, FileDown, Upload } from 'lucide-react';
import { Button } from './button';
import { downloadFile, uploadExcelFile, type ExcelImportResult } from '@/lib/download-file';
import { notifyError, notifySuccess } from '@/lib/notify';

/** Template/Export/Import toolbar for a module's Excel offline-sync flow — same three-endpoint shape
 * across every module that supports it (see docs/IMPORT_EXPORT.md). Row errors render inline so staff
 * can see exactly what to fix without leaving the page; a clean import calls onImported() to refetch. */
export function ExcelImportExportBar({
  exportUrl,
  templateUrl,
  importUrl,
  entityLabel,
  onImported,
}: {
  exportUrl: string;
  templateUrl: string;
  importUrl: string;
  entityLabel: string;
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ExcelImportResult | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await uploadExcelFile(importUrl, file);
      setResult(res);
      if (res.errors.length === 0) {
        notifySuccess(`Imported: ${res.created} created, ${res.updated} updated`);
        onImported();
      } else {
        notifyError(new Error(`${res.errors.length} row(s) had errors`), 'Nothing was imported — fix the errors below and re-upload');
      }
    } catch (err) {
      notifyError(err, 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => downloadFile(templateUrl, `${entityLabel}-template.xlsx`)}
        >
          <FileDown size={14} /> Template
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => downloadFile(exportUrl, `${entityLabel}-export.xlsx`)}
        >
          <Download size={14} /> Export
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" disabled={importing} onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> {importing ? 'Importing...' : 'Import'}
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
      </div>
      {result && result.errors.length > 0 && (
        <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <p className="mb-1 font-medium">{result.errors.length} row error(s) — nothing was imported. Fix these and re-upload the whole file:</p>
          <ul className="space-y-0.5">
            {result.errors.map((e, i) => (
              <li key={i}>
                Row {e.row}
                {e.field ? ` (${e.field})` : ''}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {result && result.errors.length === 0 && (
        <div className="mt-2">
          <p className="text-xs text-emerald-600">
            Imported: {result.created} created, {result.updated} updated
            {result.skipped ? `, ${result.skipped} already recorded (skipped)` : ''}.
          </p>
          {result.notes && result.notes.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-1 font-medium">Save this information — it won&apos;t be shown again:</p>
              <ul className="space-y-0.5">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
