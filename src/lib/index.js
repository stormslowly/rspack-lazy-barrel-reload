// Same shape as zustand/esm/index.mjs: own code plus `export *`.
import { createStore } from './vanilla.js';

export * from './vanilla.js';
export const create = (init) => createStore(init);
