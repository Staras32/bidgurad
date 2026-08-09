import type { BoqRow, WorkPackage } from '@/lib/boq/types';

export interface StoredBoqProject {
  id: string;
  name: string;
  source_file_name: string;
  source_file_size: number;
  packages: WorkPackage[];
  rows: BoqRow[];
  created_at: string;
  updated_at: string;
}

export interface ProjectSaveInput {
  name: string;
  sourceFileName: string;
  sourceFileSize: number;
  packages: WorkPackage[];
  rows: BoqRow[];
}
