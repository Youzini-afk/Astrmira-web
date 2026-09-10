// Cell sums persist across frames. Only a particle whose coverage changed
// contributes a delta; idle particles never need another mask pass.
export function setGlyphCoverage(particle, coverage) {
  if (!particle.glyphCell || particle.coverage === coverage) return;
  particle.glyphCell.sum += coverage - (particle.coverage || 0);
  particle.coverage = coverage;
  particle.glyphLayer.active = true;
}

export function sampleGlyphCoverage(particle) {
  if (!particle.glyphSample) return 0;
  const { indices, weights } = particle.glyphSample;
  const data = particle.glyphLayer.alphaData;
  return (data[indices[0]] * weights[0] + data[indices[1]] * weights[1]
    + data[indices[2]] * weights[2] + data[indices[3]] * weights[3]) / 255;
}
