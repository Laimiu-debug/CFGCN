// Code-painted mineral washes and agricultural parcels, sampled from the real
// landscape. This is an editable surface recipe, not a generated background.
export async function paintScrollSurface({
  layout,
  terrain,
  hex,
  mix,
  sharp,
  random,
  point,
  line,
}) {
  const { mountainHeight, waterDistance, lowlandHeight, cultivationWeight, townDistance, smooth } =
    terrain;
  const paper = hex('paper-raised'),
    ink = hex('ink'),
    jade = hex('jade'),
    gold = hex('gold');
  const b = layout.bounds,
    w = b.east - b.west,
    h = b.south - b.north;
  const mw = 896,
    mh = Math.round((mw * h) / w),
    step = w / (mw - 1);
  const mount = new Float32Array(mw * mh),
    water = new Float32Array(mw * mh);
  const height = new Float32Array(mw * mh),
    farm = new Float32Array(mw * mh);
  const towns = new Float32Array(mw * mh);
  for (let j = 0; j < mh; j++)
    for (let i = 0; i < mw; i++) {
      const x = b.west + i * step,
        z = b.north + (j * h) / (mh - 1),
        at = j * mw + i;
      mount[at] = mountainHeight(x, z);
      water[at] = waterDistance(x, z);
      height[at] = lowlandHeight(x, z, water[at]) + mount[at] * 1.12;
      farm[at] = cultivationWeight(x, z);
      towns[at] = townDistance(x, z);
    }
  const sample = (a, x, z) => {
    const u = Math.max(0, Math.min(mw - 1.001, (x - b.west) / step));
    const v = Math.max(0, Math.min(mh - 1.001, ((z - b.north) / h) * (mh - 1)));
    const i = Math.floor(u),
      j = Math.floor(v),
      a0 = a[j * mw + i],
      a1 = a[j * mw + i + 1];
    const a2 = a[(j + 1) * mw + i],
      a3 = a[(j + 1) * mw + i + 1];
    return (a0 + (a1 - a0) * (u - i)) * (1 - (v - j)) + (a2 + (a3 - a2) * (u - i)) * (v - j);
  };
  const gradient = (x, z) => [
    (sample(height, x + step, z) - sample(height, x - step, z)) / (2 * step),
    (sample(height, x, z + step) - sample(height, x, z - step)) / (2 * step),
  ];
  const hash = (x, z) => {
    const a = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
    return a - Math.floor(a);
  };
  const noise = (x, z) => {
    const i = Math.floor(x),
      j = Math.floor(z),
      u = smooth(0, 1, x - i),
      v = smooth(0, 1, z - j);
    return (
      (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) +
      (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v
    );
  };
  const rgb = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const mask = Buffer.alloc(mw * mh * 4),
    land = Buffer.alloc(mw * mh * 4);
  for (let j = 0; j < mh; j++)
    for (let i = 0; i < mw; i++) {
      const at = j * mw + i,
        x = b.west + i * step,
        z = b.north + (j * h) / (mh - 1);
      const m = mount[at],
        d = water[at],
        [gx, gz] = gradient(x, z),
        slope = Math.hypot(gx, gz);
      const grain = noise(x * 0.29, z * 0.29),
        wash = noise(x * 0.034, z * 0.034);
      const loess = smooth(-30, -130, z) * (1 - smooth(-50, 80, x));
      let base = mix(paper, gold, 0.39 + wash * 0.07);
      const scrub = smooth(0.38, 0.72, noise(x * 0.027 + 11, z * 0.027));
      base = mix(base, mix(paper, jade, 0.4), scrub * (0.34 + 0.24 * smooth(0.8, 5, m)));
      const rolling = height[at] - m * 1.12;
      base = mix(base, mix(mix(paper, gold, 0.42), jade, 0.15), smooth(1.1, 5, rolling) * 0.42);
      const talus = mix(mix(paper, gold, 0.4 + loess * 0.14), hex('muted'), 0.12 + grain * 0.08);
      base = mix(base, talus, smooth(1.3, 6, m) * 0.88);
      const blueGreen = mix(mix(jade, hex('accent-shuihu'), 0.58), paper, 0.08 + 0.09 * wash);
      const summit = smooth(4, 20, m) * (0.2 + 0.8 / Math.sqrt(1 + slope * slope));
      base = mix(base, mix(blueGreen, gold, loess * 0.55), summit * 0.96);
      const facing = (-gx * 0.65 + gz * 0.35 + 0.72) / Math.sqrt(1 + slope * slope);
      const rockShade = (1 - smooth(0.24, 0.72, facing)) * smooth(3, 12, m);
      base = mix(base, mix(ink, blueGreen, 0.55), rockShade * 0.45);
      // Warm gravel -> damp mineral -> blue water. The edge is tied to the carved
      // bank, rather than a white outline around an unrelated field texture.
      const shore = (1 - smooth(0.4, 5.5, d)) * (1 - smooth(5, 12, m));
      base = mix(base, mix(paper, gold, 0.38 + 0.06 * grain), shore * 0.82);
      base = mix(
        base,
        mix(mix(paper, hex('accent-shuihu'), 0.34), ink, 0.13),
        (1 - smooth(-0.5, 1.25, d)) * 0.72,
      );
      land.set([...rgb(base), 255], at * 4);
      // Only relief, water and settlement boundaries clip a parcel. There is no
      // oval catchment alpha: outer edges are individual fallow plots and paths.
      const alpha =
        smooth(0.65, 2.1, d) *
        (1 - smooth(3.4, 8, m)) *
        (1 - smooth(0.22, 0.58, slope)) *
        smooth(-0.5, 0.8, towns[at]) *
        smooth(0.03, 0.84, farm[at]);
      mask.set([255, 255, 255, Math.round(alpha * 255)], at * 4);
    }
  const imageUrl = async (data) =>
    (
      await sharp(data, { raw: { width: mw, height: mh, channels: 4 } })
        .png()
        .toBuffer()
    ).toString('base64');
  const landUrl = await imageUrl(land),
    maskUrl = await imageUrl(mask);
  const defs = [
    '<mask id="cultivated"><image preserveAspectRatio="none" width="' +
      w +
      '" height="' +
      h +
      '" href="data:image/png;base64,' +
      maskUrl +
      '"/></mask>',
  ];
  const fields = [],
    detail = [],
    parcels = [],
    fieldEdges = [];
  const districtAt = (x, z) => {
    let best = Infinity,
      winner = 0;
    const wx = x + 4 * Math.sin(z * 0.038),
      wz = z + 3 * Math.sin(x * 0.032);
    layout.cultivation.forEach((a, i) => {
      const c = Math.cos(a.angle),
        s = Math.sin(a.angle),
        dx = wx - a.x,
        dz = wz - a.z;
      const score = ((dx * c + dz * s) / a.rx) ** 2 + ((-dx * s + dz * c) / a.rz) ** 2;
      if (score < best) {
        best = score;
        winner = i;
      }
    });
    return winner;
  };
  const owners = new Uint8Array(mw * mh);
  for (let j = 0; j < mh; j++)
    for (let i = 0; i < mw; i++)
      owners[j * mw + i] = districtAt(b.west + i * step, b.north + (j * h) / (mh - 1));
  for (const [districtIndex, district] of layout.cultivation.entries()) {
    const ownership = Buffer.alloc(mw * mh * 4);
    for (let at = 0; at < owners.length; at++)
      ownership.set([255, 255, 255, owners[at] === districtIndex ? 255 : 0], at * 4);
    const ownUrl = (
      await sharp(ownership, { raw: { width: mw, height: mh, channels: 4 } })
        .blur(0.65)
        .png()
        .toBuffer()
    ).toString('base64');
    defs.push(
      '<mask id="district' +
        districtIndex +
        '"><image preserveAspectRatio="none" width="' +
        w +
        '" height="' +
        h +
        '" href="data:image/png;base64,' +
        ownUrl +
        '"/></mask>',
    );
    fields.push('<g mask="url(#district' + districtIndex + ')">');
    fieldEdges.push('<g mask="url(#district' + districtIndex + ')">');
    const ca = Math.cos(district.angle),
      sa = Math.sin(district.angle);
    const world = (u, v) => {
      const bend = 3.3 * Math.sin(u * 0.042) + 1.6 * Math.sin(u * 0.073 + v * 0.031);
      return [district.x + ca * u - sa * (v + bend), district.z + sa * u + ca * (v + bend)];
    };
    const subdivide = (poly) => {
      const rounded = poly.flatMap((c, i) => {
        const a = poly[(i + poly.length - 1) % poly.length],
          b = poly[(i + 1) % poly.length];
        const la = Math.hypot(a[0] - c[0], a[1] - c[1]),
          lb = Math.hypot(b[0] - c[0], b[1] - c[1]);
        const r = Math.min(0.95, la * 0.17, lb * 0.17);
        const start = [c[0] + ((a[0] - c[0]) * r) / la, c[1] + ((a[1] - c[1]) * r) / la];
        const end = [c[0] + ((b[0] - c[0]) * r) / lb, c[1] + ((b[1] - c[1]) * r) / lb];
        return Array.from({ length: 4 }, (_, k) => {
          const t = k / 3;
          return [
            (1 - t) ** 2 * start[0] + 2 * t * (1 - t) * c[0] + t * t * end[0],
            (1 - t) ** 2 * start[1] + 2 * t * (1 - t) * c[1] + t * t * end[1],
          ];
        });
      });
      return rounded.flatMap((a, i) => {
        const b = rounded[(i + 1) % rounded.length],
          steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.2));
        return Array.from({ length: steps }, (_, k) =>
          world(a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps),
        );
      });
    };
    let rangeX = 0,
      rangeZ = 0;
    // Derive the complete district extent. A fixed ellipse-shaped generation
    // window left abrupt ends even when the later material mask was smooth.
    for (let j = 0; j < mh; j += 2)
      for (let i = 0; i < mw; i += 2)
        if (owners[j * mw + i] === districtIndex) {
          const dx = b.west + i * step - district.x,
            dz = b.north + (j * h) / (mh - 1) - district.z;
          rangeX = Math.max(rangeX, Math.abs(dx * ca + dz * sa));
          rangeZ = Math.max(rangeZ, Math.abs(-dx * sa + dz * ca));
        }
    rangeX += 35;
    rangeZ += 35;
    for (let v = -rangeZ; v < rangeZ;) {
      const depth = (district.crop === 'rice' ? 3.7 : 4.2) + random() * 3.1;
      for (let u = -rangeX; u < rangeX;) {
        const width = 10 + random() * 19,
          [x, z] = world(u + width / 2, v + depth / 2);
        const corners = [
          [u, v],
          [u + width, v],
          [u + width, v + depth],
          [u, v + depth],
        ];
        const near =
          corners.some((q) => districtAt(...world(...q)) === districtIndex) ||
          districtAt(x, z) === districtIndex;
        if (near) {
          const influence = sample(farm, x, z),
            fallow = noise(x * 0.025, z * 0.025) + (random() - 0.5) * 0.25 > 0.7 + influence * 0.16;
          const pts = subdivide(corners),
            d = line(pts) + 'Z',
            index = parcels.length,
            tint = random();
          const fill = fallow
            ? mix(mix(paper, gold, 0.34 + tint * 0.08), jade, 0.1)
            : district.crop === 'rice'
              ? mix(mix(paper, gold, 0.46 + tint * 0.08), jade, 0.16 + random() * 0.08)
              : tint < 0.12
                ? mix(mix(paper, gold, 0.48), jade, 0.2)
                : mix(paper, gold, 0.5 + tint * 0.12);
          // Crop strength belongs to the shared continuous mask, never a parcel-centre tint.
          defs.push('<clipPath id="p' + index + '"><path d="' + d + '"/></clipPath>');
          fields.push(
            '<path d="' +
              d +
              '" fill="' +
              fill +
              '" fill-opacity=".18" stroke="' +
              mix(mix(paper, gold, 0.42), hex('gold-ink'), 0.17) +
              '" stroke-width=".13"/>',
          );
          if (!fallow) {
            const strokes = [],
              spacing = 0.66 + random() * 0.18;
            for (let row = v + 0.32; row < v + depth - 0.16; row += spacing) {
              const pts = Array.from({ length: 13 }, (_, k) =>
                world(u + (width * k) / 12, row + 0.06 * Math.sin(k * 0.7)),
              );
              strokes.push('<path d="' + line(pts) + '"/>');
            }
            fields.push(
              '<g clip-path="url(#p' +
                index +
                ')" fill="none" stroke="' +
                fill +
                '" stroke-opacity="' +
                '0.68' +
                '" stroke-width=".42" stroke-linecap="round">' +
                strokes.join('') +
                '</g>',
            );
          }
          fieldEdges.push('<path d="' + d + '" fill="none" stroke="#00ff00" stroke-width=".3"/>');
          parcels.push(corners);
        }
        u += width;
      }
      v += depth;
    }
    fields.push('</g>');
    fieldEdges.push('</g>');
  }
  // Contour brushwork also describes the low rolling land between the peaks.
  // Those slopes used to become blank pale ovals when the field mask receded.
  for (let i = 0; i < 9500; i++) {
    const x = b.west + random() * w,
      z = b.north + random() * h,
      m = sample(mount, x, z);
    if (
      m > 4 ||
      sample(height, x, z) - m * 1.12 < 1.5 ||
      sample(water, x, z) < 3 ||
      sample(towns, x, z) < 1
    )
      continue;
    const [gx, gz] = gradient(x, z),
      len = Math.hypot(gx, gz);
    if (len < 0.1) continue;
    const size = 2.5 + random() * 5,
      pts = Array.from({ length: 7 }, (_, k) => {
        const d = (k / 6 - 0.5) * size;
        return [x - (gz / len) * d, z + (gx / len) * d + Math.sin(d * 0.35) * 0.24];
      });
    detail.push(
      '<path d="' +
        line(pts) +
        '" fill="none" stroke="' +
        mix(gold, jade, 0.36) +
        '" stroke-opacity=".38" stroke-width=".13"/>',
    );
  }
  // Broken bedding contours describe rock shelves; their direction is across
  // the rock face. The former downhill streamlines drew long melted streaks.
  let rockStrokes = 0,
    bankMarks = 0;
  for (const level of [7, 16, 29, 44]) {
    const segments = [];
    for (let j = 1; j < mh - 2; j++)
      for (let i = 1; i < mw - 2; i++) {
        const x = b.west + i * step,
          z = b.north + (j * h) / (mh - 1);
        if (
          mount[j * mw + i] < 4 ||
          water[j * mw + i] < 1 ||
          towns[j * mw + i] < 1 ||
          noise(x * 0.12, z * 0.12) < 0.37
        )
          continue;
        const values = [
          height[j * mw + i],
          height[j * mw + i + 1],
          height[(j + 1) * mw + i + 1],
          height[(j + 1) * mw + i],
        ];
        const verts = [
            [x, z],
            [x + step, z],
            [x + step, z + step],
            [x, z + step],
          ],
          crossings = [];
        for (let k = 0; k < 4; k++) {
          const n = (k + 1) % 4,
            a = values[k] - level,
            bv = values[n] - level;
          if (a < 0 === bv < 0) continue;
          const t = a / (a - bv);
          crossings.push([
            verts[k][0] + (verts[n][0] - verts[k][0]) * t,
            verts[k][1] + (verts[n][1] - verts[k][1]) * t,
          ]);
        }
        if (crossings.length === 2) {
          segments.push(line(crossings));
          rockStrokes++;
        }
      }
    detail.push(
      '<path d="' +
        segments.join('') +
        '" fill="none" stroke="' +
        mix(ink, gold, 0.25) +
        '" stroke-opacity=".48" stroke-width=".18"/>',
    );
  }
  // Mineral flecks, scrub tufts and reeds are painted into the same surface.
  // They describe the foothill and wet edge, without adding rows of 3D props.
  for (let i = 0; i < 72000; i++) {
    const x = b.west + random() * w,
      z = b.north + random() * h,
      m = sample(mount, x, z),
      d = sample(water, x, z);
    if (sample(towns, x, z) < 0.8 || d < 0.1) continue;
    const [gx, gz] = gradient(x, z),
      slope = Math.hypot(gx, gz);
    if (d < 3.8 && random() < 0.68) {
      const a = random() * Math.PI,
        r = 0.12 + random() * 0.28;
      const pts = [
        [x - r, z],
        [x - r * 0.3, z - r * 0.6],
        [x + r, z + 0.1],
        [x + r * 0.2, z + r * 0.5],
      ];
      detail.push(
        '<path d="' +
          line(pts) +
          'Z" fill="' +
          mix(paper, hex('gold-ink'), 0.24 + random() * 0.3) +
          '" fill-opacity=".75"/>',
      );
      if (d > 0.6 && d < 2.6 && i % 4 === 0)
        detail.push(
          '<path d="M' +
            point([x, z]) +
            'l-.22,-.5m.22,.5l.06,-.65m-.06,.65l.3,-.4" fill="none" stroke="' +
            mix(jade, gold, 0.32) +
            '" stroke-opacity=".65" stroke-width=".075"/>',
        );
      bankMarks++;
    } else if (m > 1.2 && slope < 1.2 && noise(x * 0.12, z * 0.12) > 0.46 && random() < 0.6) {
      const size = 0.36 + random() * 0.58,
        fill = mix(jade, ink, 0.24 + random() * 0.42);
      detail.push(
        '<path d="M' +
          point([x, z]) +
          'l' +
          size.toFixed(2) +
          ',-.12l.18,-.38l-.3,-.22l-.18,.12l-.23,-.3l-.34,.26l-.2,-.04Z" fill="' +
          fill +
          '" fill-opacity="' +
          (0.3 + random() * 0.38) +
          '"/>',
      );
    } else if (random() < 0.24) {
      detail.push(
        '<path d="M' +
          point([x, z]) +
          'l.25,-.05m-.16,.12l.12,-.22" stroke="' +
          mix(gold, jade, 0.44) +
          '" stroke-opacity=".34" stroke-width=".065"/>',
      );
    }
  }
  return { defs, fields, fieldEdges, detail, parcels, landUrl, rockStrokes, bankMarks };
}
