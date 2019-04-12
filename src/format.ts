import { KeyValue } from './ast';

export interface Format {
  printWidth?: number;
  tabWidth?: number;
  useTabs?: boolean;
  trailingComma?: boolean;
  bracketSpacing?: boolean;
}

export function formatTopLevel(body: KeyValue[]) {
  return body;
}

export function formatPrintWidth(body: KeyValue[], format: Format) {
  return body;
}
