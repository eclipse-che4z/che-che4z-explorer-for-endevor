import * as path from 'path';

export const extensionShortName = 'Explorer for Endevor';
export const extensionId = 'broadcomMFD.explorer-for-endevor';

export const timeout = async (ms = 200) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// eslint-disable-next-line @typescript-eslint/ban-types
export const isObjectEmpty = (o: {} | undefined) =>
  typeof o === 'object' && Object.keys(o).length === 0;

const testPath = path.join(__dirname, '../../test');
