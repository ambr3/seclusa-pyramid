/*
 * Seclusa Games — pyramid entry point.
 *
 * PORT TO JAVASCRIPT (plain ES modules, no build step, run directly by the browser).
 *
 * The engine lives in the shared `cards` folder because Pyramid uses it too; only the
 * game class and the asset base are specific to pyramid. This file is separate from
 * index.html purely because the Content-Security-Policy forbids inline scripts.
 */

import { Pyramid } from './Pyramid.js';
import { boot } from './cards/engine/boot.js';

boot(Pyramid, 'cards/', 'Pyramid');
