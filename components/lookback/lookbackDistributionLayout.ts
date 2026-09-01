export const getClampedDistributionLabelLeft = (
  containerWidth: number,
  labelWidth: number,
  segmentStartPercent: number
): number => {
  const safeContainerWidth = Math.max(0, containerWidth);
  const safeLabelWidth = Math.max(0, labelWidth);
  const safeStartPercent = Math.min(100, Math.max(0, segmentStartPercent));
  const preferredLeft = safeContainerWidth * (safeStartPercent / 100);
  const furthestVisibleLeft = Math.max(0, safeContainerWidth - safeLabelWidth);

  return Math.min(preferredLeft, furthestVisibleLeft);
};
