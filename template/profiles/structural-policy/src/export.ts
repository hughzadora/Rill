import { write as saveFile } from "bun";

export function previewExport(title: string) {
  return title.trim();
}

export function saveExport(path: string, title: string) {
  return saveFile(path, previewExport(title));
}
