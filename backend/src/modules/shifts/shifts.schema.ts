import { z } from 'zod';
import { money } from '../../lib/http.js';

export const openShiftSchema = z.object({ openingCash: money });
export const closeShiftSchema = z.object({ countedCash: money });
