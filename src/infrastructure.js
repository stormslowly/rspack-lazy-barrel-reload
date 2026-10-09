// No HMR boundary: an update reaching this module reloads the page.
import { create } from './lib/index.js';

export const infra = create('infra').state;
