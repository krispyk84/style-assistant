import { useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { closetExportService } from '@/services/closet-export/closet-export-service';

export function useClosetExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  async function exportCloset() {
    setIsExporting(true);
    setExportMessage(null);
    try {
      const response = await closetExportService.downloadArchive();
      if (!response.success || !response.data) {
        setExportMessage(response.error?.message ?? 'Could not export your closet.');
        return;
      }

      const fileName = `vesture-closet-export-${new Date().toISOString().slice(0, 10)}.zip`;
      const file = new File(Paths.cache, fileName);
      if (file.exists) file.delete();
      file.create();
      file.write(new Uint8Array(response.data));

      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setExportMessage(`Saved to ${file.uri}`);
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', dialogTitle: 'Export Closet' });
      setExportMessage('Export ready — choose where to save it.');
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : 'Could not export your closet.');
    } finally {
      setIsExporting(false);
    }
  }

  return { isExporting, exportMessage, exportCloset };
}
