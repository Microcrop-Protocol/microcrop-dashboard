/**
 * Demo region catalog — Kenyan counties + Ghanaian regions, each with plausible
 * crops and a dominant climate index. Used to seed the index ticker and to pick
 * realistic regions/crops for streamed activity + payout events across BOTH
 * markets (multi-market showcase).
 */

import type { Region } from './types';

export const REGIONS: Region[] = [
  // ---- Kenya (KE) — counties ----
  { id: 'KE-NKR', market: 'KE', name: 'Nakuru', crops: ['maize', 'beans'], primaryIndex: 'NDVI' },
  { id: 'KE-TRK', market: 'KE', name: 'Turkana', crops: ['sorghum', 'millet'], primaryIndex: 'RAINFALL' },
  { id: 'KE-NYR', market: 'KE', name: 'Nyeri', crops: ['maize', 'beans'], primaryIndex: 'NDVI' },
  { id: 'KE-MCK', market: 'KE', name: 'Machakos', crops: ['maize', 'sorghum', 'cowpea'], primaryIndex: 'RAINFALL' },
  { id: 'KE-KTL', market: 'KE', name: 'Kitui', crops: ['sorghum', 'millet', 'cowpea'], primaryIndex: 'RAINFALL' },
  { id: 'KE-UGS', market: 'KE', name: 'Uasin Gishu', crops: ['maize', 'beans'], primaryIndex: 'NDVI' },

  // ---- Ghana (GH) — regions ----
  { id: 'GH-NR', market: 'GH', name: 'Northern', crops: ['maize', 'rice', 'sorghum'], primaryIndex: 'RAINFALL' },
  { id: 'GH-UE', market: 'GH', name: 'Upper East', crops: ['millet', 'sorghum', 'rice'], primaryIndex: 'RAINFALL' },
  { id: 'GH-UW', market: 'GH', name: 'Upper West', crops: ['maize', 'cowpea', 'millet'], primaryIndex: 'NDVI' },
  { id: 'GH-ASH', market: 'GH', name: 'Ashanti', crops: ['maize', 'rice'], primaryIndex: 'NDVI' },
  { id: 'GH-BE', market: 'GH', name: 'Bono East', crops: ['maize', 'cowpea'], primaryIndex: 'NDVI' },
];

export const KE_REGIONS = REGIONS.filter((r) => r.market === 'KE');
export const GH_REGIONS = REGIONS.filter((r) => r.market === 'GH');

/** First names + last initials used to build masked farmer labels. */
export const FARMER_FIRST_NAMES = [
  'Joanna', 'Amina', 'Kwame', 'Grace', 'Mensah', 'Wanjiku', 'Kofi', 'Esther',
  'Yaw', 'Njeri', 'Abena', 'Peter', 'Fatima', 'Kojo', 'Mary', 'Otieno',
  'Akosua', 'Daniel', 'Halima', 'Kwabena',
];

export const FARMER_LAST_INITIALS = ['M.', 'O.', 'K.', 'A.', 'N.', 'W.', 'B.', 'D.', 'S.', 'T.'];
