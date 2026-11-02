// Hao hụt keg (FR-17): hao hụt = dung tích − thể tích đã bán.

export const DEFAULT_KEG_LOSS_THRESHOLD_PCT = 5;

export interface KegLoss {
  lossMl: number;
  /** Phần trăm, làm tròn 1 chữ số thập phân */
  lossPct: number;
  exceeded: boolean;
}

export function kegLoss(capacityMl: number, soldMl: number, thresholdPct = DEFAULT_KEG_LOSS_THRESHOLD_PCT): KegLoss {
  const lossMl = capacityMl - soldMl;
  const lossPct = capacityMl > 0 ? Math.round((lossMl / capacityMl) * 1000) / 10 : 0;
  return { lossMl, lossPct, exceeded: lossPct > thresholdPct };
}
