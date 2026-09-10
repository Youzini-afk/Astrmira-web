// Resting text is indexed in hero-local coordinates. Only pointer neighbours
// and particles already in flight need physics after the opening settles.
export function createParticleGrid(particles, size = 82) {
  const buckets = new Map();
  for (const particle of particles) {
    const key = `${Math.floor(particle.relX / size)},${Math.floor(particle.relY / size)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(particle);
  }
  return {
    near(x, y, radius, active = []) {
      const result = new Set(active);
      for (let row = Math.floor((y - radius) / size); row <= Math.floor((y + radius) / size); row++) {
        for (let column = Math.floor((x - radius) / size); column <= Math.floor((x + radius) / size); column++) {
          const bucket = buckets.get(`${column},${row}`);
          if (bucket) for (const particle of bucket) result.add(particle);
        }
      }
      return result;
    }
  };
}
