import { describe, expect, it } from 'vitest';
import { createInkShore } from './ink-shore';

describe('terrain meets a level river shore', () => {
  it('cuts a continuous valley to the painted river and preserves the inland crest', () => {
    const width = 600,
      height = 376;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 290; x <= 310; x++) data[(y * width + x) * 4 + 3] = 255;
    const shore = createInkShore({ data, width, height });
    expect(shore.wet(1200, 700)).toBe(true);
    expect(shore.height(1200, 700, 500)).toBe(-2);
    const heights = [1250, 1260, 1280, 1320].map((x) => shore.height(x, 700, 500));
    expect(heights[0]).toBeLessThan(heights[1]);
    expect(heights[1]).toBeLessThan(heights[2]);
    expect(heights[2]).toBeLessThan(heights[3]);
    expect(heights[3]).toBe(500);
    expect(shore.height(1800, 700, 500)).toBe(500);
  });
});
