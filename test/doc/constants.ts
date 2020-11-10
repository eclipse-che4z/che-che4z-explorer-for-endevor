import * as path from 'path';

export const extensionShortName = 'Explorer for Endevor';
export const extensionId = 'broadcomMFD.explorer-for-endevor';

export const timeout = async (ms = 200) =>
    new Promise((resolve) => setTimeout(resolve, ms));

const testPath = path.join(__dirname, '../../test');
