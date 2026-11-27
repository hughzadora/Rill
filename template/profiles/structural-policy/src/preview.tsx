import { previewExport } from "./export";

export function ExportPreview({ title }: { title: string }) {
  return <output>{previewExport(title)}</output>;
}
