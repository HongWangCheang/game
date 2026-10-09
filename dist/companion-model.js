/** Original painted animal on a continuous sculpted 3D surface; front is +Z, up is +Y. */
export function createCompanion(THREE, { awakeTexture, sleepTexture } = {}) {
  if (!awakeTexture) throw new Error('createCompanion requires awakeTexture');
  sleepTexture ||= awakeTexture;
  for (const texture of [awakeTexture, sleepTexture]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }
  const SOURCE_W = 1408, SOURCE_H = 768, PX = 184, CENTER_X = 750, FLOOR_Y = 698;
  const contour = [
    [582,184],[589,159],[602,150],[620,153],[641,164],[658,180],
    [679,168],[691,170],[699,159],[715,169],[719,155],[729,165],
    [738,148],[738,166],[752,155],[770,155],[756,168],[791,166],
    [784,172],[810,174],[827,157],[847,149],[865,145],[879,153],
    [885,170],[888,195],[884,215],[875,232],[889,237],[882,243],
    [898,265],[904,286],[915,304],[906,307],[916,329],[907,324],
    [914,352],[904,348],[904,374],[895,373],[893,393],[880,400],
    [892,417],[887,426],[897,446],[906,460],[915,482],[917,499],
    [912,519],[903,532],[889,538],[911,540],[927,551],[940,573],
    [948,568],[950,583],[961,574],[965,587],[975,584],[980,596],
    [975,610],[974,628],[964,648],[947,662],[925,668],[904,663],
    [887,652],[865,648],[847,651],[824,660],[800,663],[787,670],
    [779,663],[771,674],[762,664],[753,675],[748,685],[737,694],
    [720,698],[705,690],[684,694],[659,689],[638,686],[612,679],
    [589,673],[571,661],[551,648],[538,633],[528,615],[521,594],
    [518,574],[521,551],[525,531],[531,509],[537,488],[545,469],
    [554,450],[566,431],[579,410],[586,399],[579,378],[575,365],
    [568,371],[565,356],[563,340],[559,346],[562,330],[566,316],
    [555,313],[572,296],[579,281],[581,264],[585,254],[577,251],
    [592,245],[582,231],[589,220],[583,205],
  ];
  const smooth = (lo, hi, value) => {
    const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  };
  const gaussian = (x, y, cx, cy, rx, ry) => Math.exp(-2 * (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
  const patch = (x, y, cx, cy, rx, ry) => {
    const q = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
    return q >= 1 ? 0 : (1 - q) ** 2;
  };
  // The painted front pixels retain their original XY projection; only Z is sculpted.
  function relief(x, y) {
    return .15
      + .19 * gaussian(x, y, 741, 313, 179, 150)
      + .15 * gaussian(x, y, 713, 547, 196, 160)
      + .10 * gaussian(x, y, 760, 344, 62, 55)
      + .11 * gaussian(x, y, 721, 652, 62, 71)
      + .11 * gaussian(x, y, 935, 619, 65, 69);
  }
  const vertices = contour.map(([x, y]) => ({ x, y }));
  const planar = contour.map(([x, y]) => new THREE.Vector2((x - CENTER_X) / PX, (FLOOR_Y - y) / PX));
  let faces = THREE.ShapeUtils.triangulateShape(planar, []).map(face => {
    const [a, b, c] = face.map(i => planar[i]);
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return cross >= 0 ? face : [face[0], face[2], face[1]];
  });
  // Shared midpoints keep the entire front watertight during soft deformation.
  for (let round = 0; round < 3; round++) {
    const midpoints = new Map();
    function midpoint(a, b) {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (midpoints.has(key)) return midpoints.get(key);
      const v = { x: (vertices[a].x + vertices[b].x) / 2, y: (vertices[a].y + vertices[b].y) / 2 };
      const index = vertices.push(v) - 1;
      midpoints.set(key, index);
      return index;
    }
    const next = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      next.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    faces = next;
  }
  const group = new THREE.Group();
  group.name = 'referencePaintedCompanion';
  const uniformSleep = { value: 0 };
  const uniformSleepMap = { value: sleepTexture };
  const frontMaterial = new THREE.MeshBasicMaterial({ map: awakeTexture, toneMapped: false, side: THREE.FrontSide });
  frontMaterial.name = 'originalPaintedFace';
  frontMaterial.onBeforeCompile = shader => {
    shader.uniforms.uCompanionSleep = uniformSleep;
    shader.uniforms.uCompanionSleepMap = uniformSleepMap;
    shader.fragmentShader = 'uniform float uCompanionSleep;\nuniform sampler2D uCompanionSleepMap;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 awakeColor = texture2D(map, vMapUv);
        vec4 asleepColor = texture2D(uCompanionSleepMap, vMapUv);
        // Only the source head above approximately y=440 crossfades; torso stays awake pixels.
        float headMask = smoothstep(${(1 - 445 / SOURCE_H).toFixed(8)}, ${(1 - 425 / SOURCE_H).toFixed(8)}, vMapUv.y);
        diffuseColor *= mix(awakeColor, asleepColor, clamp(uCompanionSleep * headMask, 0.0, 1.0));
      #endif
    `);
  };
  frontMaterial.customProgramCacheKey = () => 'paintedCompanion-head-sleep-v1';
  const sideMaterial = new THREE.MeshStandardMaterial({ map: awakeTexture, color: 0xe4c294, roughness: .93, metalness: 0, toneMapped: false, side: THREE.DoubleSide });
  sideMaterial.name = 'paintedExtrusionSides';
  const backMaterial = new THREE.MeshBasicMaterial({ map: awakeTexture, color: 0xcda77b, toneMapped: false, side: THREE.BackSide });
  backMaterial.name = 'paintedExtrusionBack';

  function surfaceGeometry(back = false) {
    const position = new Float32Array(vertices.length * 3);
    const uv = new Float32Array(vertices.length * 2);
    vertices.forEach(({ x, y }, i) => {
      position[i * 3] = (x - CENTER_X) / PX;
      position[i * 3 + 1] = (FLOOR_Y - y) / PX;
      position[i * 3 + 2] = relief(x, y) - (back ? .23 : 0);
      uv[i * 2] = x / SOURCE_W;
      uv[i * 2 + 1] = 1 - y / SOURCE_H;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(faces.flat());
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
  const frontGeometry = surfaceGeometry();
  const backGeometry = surfaceGeometry(true);
  function addSurface(geometry, material, name) {
    const surface = new THREE.Mesh(geometry, material);
    surface.name = name;
    surface.castShadow = true;
    surface.receiveShadow = true;
    surface.frustumCulled = false;
    group.add(surface);
    return surface;
  }
  addSurface(frontGeometry, frontMaterial, 'continuousOriginalAnimalFront');
  addSurface(backGeometry, backMaterial, 'originalAnimalBack');

  // Use subdivided contour edges, matching front vertices exactly, including pointed fur tips.
  const boundary = [];
  for (let edge = 0; edge < contour.length; edge++) {
    const a = contour[edge], b = contour[(edge + 1) % contour.length];
    for (let step = 0; step < 8; step++) {
      const t = step / 8;
      boundary.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t });
    }
  }
  const wallPositions = new Float32Array(boundary.length * 6);
  const wallUV = new Float32Array(boundary.length * 4);
  const wallIndices = [];
  boundary.forEach(({ x, y }, i) => {
    for (let depth = 0; depth < 2; depth++) {
      const j = i * 2 + depth;
      wallPositions[j * 3] = (x - CENTER_X) / PX;
      wallPositions[j * 3 + 1] = (FLOOR_Y - y) / PX;
      wallPositions[j * 3 + 2] = relief(x, y) - .23 * depth;
      wallUV[j * 2] = x / SOURCE_W;
      wallUV[j * 2 + 1] = 1 - y / SOURCE_H;
    }
    const a = i * 2, b = ((i + 1) % boundary.length) * 2;
    wallIndices.push(a, a + 1, b, b, a + 1, b + 1);
  });
  const wallGeometry = new THREE.BufferGeometry();
  wallGeometry.setAttribute('position', new THREE.BufferAttribute(wallPositions, 3).setUsage(THREE.DynamicDrawUsage));
  wallGeometry.setAttribute('uv', new THREE.BufferAttribute(wallUV, 2));
  wallGeometry.setIndex(wallIndices);
  wallGeometry.computeVertexNormals();
  addSurface(wallGeometry, sideMaterial, 'texturedAnimalThickness');

  const weights = { idle: 1, walking: 0, eating: 0, sleeping: 0 };
  let activity = 'idle';
  const hasMode = mode => Object.prototype.hasOwnProperty.call(weights, mode);
  function setActivity(mode) { if (hasMode(mode)) activity = mode; }
  const frontPositions = frontGeometry.attributes.position;
  const backPositions = backGeometry.attributes.position;
  const sidePositions = wallGeometry.attributes.position;
  const result = { x: 0, y: 0, z: 0 };
  function deform(x, y, time, pace, walk, eat, sleep) {
    let dx = 0, dy = 0;
    const head = 1 - smooth(426, 463, y);
    const torso = patch(x, y, 725, 548, 202, 146);
    const leftFoot = patch(x, y, 718, 653, 62, 86);
    const rightFoot = patch(x, y, 937, 619, 65, 77);
    const sway = Math.sin(pace);
    const opposite = -sway;
    dx += walk * (leftFoot * sway * 3 + rightFoot * opposite * 3);
    dy -= walk * (leftFoot * Math.max(0, sway) * 4.5 + rightFoot * Math.max(0, opposite) * 4.5);
    const bob = walk * (1 - Math.cos(pace * 2));
    dy -= bob * (1.0 * head + .55 * torso);
    dx += walk * head * sway * .7;
    // Leaf and paw move only a few pixels; the continuous original surface cannot open gaps.
    const leafHand = patch(x, y, 794, 502, 88, 91);
    const nibble = Math.sin(time * 6.4);
    const angle = eat * leafHand * (-.018 - .012 * nibble);
    dx += -(y - 537) * Math.sin(angle) + (x - 760) * (Math.cos(angle) - 1);
    dy += (x - 760) * Math.sin(angle) + (y - 537) * (Math.cos(angle) - 1) - eat * leafHand * (.8 + .5 * nibble);
    // Sleep is a quiet head tilt and soft curl, preserving the broad source silhouette.
    const sleepAngle = .035 * sleep * head;
    dx += -(y - 424) * Math.sin(sleepAngle) + (x - 744) * (Math.cos(sleepAngle) - 1) - 2.5 * sleep * head;
    dy += (x - 744) * Math.sin(sleepAngle) + (y - 424) * (Math.cos(sleepAngle) - 1) + .7 * sleep * head;
    const breathing = Math.sin(time * 1.65) * sleep;
    dx += (x - 725) * .005 * breathing * torso;
    dy += (y - 566) * .006 * breathing * torso + .65 * sleep * torso;
    dx += 1.5 * sleep * leftFoot - 1.5 * sleep * rightFoot;
    result.x = (x + dx - CENTER_X) / PX;
    result.y = (FLOOR_Y - y - dy) / PX;
    result.z = relief(x, y) + .006 * breathing * torso;
    return result;
  }
  function update(time = 0, dt = 1 / 60, state = {}) {
    time = Number.isFinite(time) ? time : 0;
    dt = Math.min(.06, Math.max(0, Number.isFinite(dt) ? dt : 1 / 60));
    const mode = hasMode(state.mode) ? state.mode : activity;
    const phase = Math.min(1, Math.max(0, Number.isFinite(state.phase) ? state.phase : 1));
    const ease = 1 - Math.exp(-dt * 6);
    for (const key of Object.keys(weights)) {
      const target = key === mode ? phase : key === 'idle' ? 1 - phase : 0;
      weights[key] += (target - weights[key]) * ease;
    }
    const walk = weights.walking, eat = weights.eating, sleep = weights.sleeping;
    const speed = Math.min(3, Math.max(0, Number.isFinite(state.speed) ? state.speed : 1));
    const pace = time * (4.4 + .4 * speed);
    uniformSleep.value = sleep;
    vertices.forEach(({ x, y }, i) => {
      const p = deform(x, y, time, pace, walk, eat, sleep);
      frontPositions.setXYZ(i, p.x, p.y, p.z);
      backPositions.setXYZ(i, p.x, p.y, p.z - .23);
    });
    boundary.forEach(({ x, y }, i) => {
      const p = deform(x, y, time, pace, walk, eat, sleep);
      sidePositions.setXYZ(i * 2, p.x, p.y, p.z);
      sidePositions.setXYZ(i * 2 + 1, p.x, p.y, p.z - .23);
    });
    frontPositions.needsUpdate = backPositions.needsUpdate = sidePositions.needsUpdate = true;
    // Front is unlit; wall normals alone need updating for its subtle material shading.
    wallGeometry.computeVertexNormals();
  }
  function getDiagnostics() {
    return {
      meshes: 3, materials: 3, geometries: 3, textures: sleepTexture === awakeTexture ? 1 : 2,
      triangles: faces.length * 2 + boundary.length * 2,
      frontVertices: vertices.length, contourVertices: contour.length, subdivisionRounds: 3,
      pixelScale: PX, originalSource: [SOURCE_W, SOURCE_H], centerX: CENTER_X, floorY: FLOOR_Y,
      thickness: .23, mode: activity, weights: { ...weights }, sleepBlend: uniformSleep.value,
      nominalBounds: { min: [-1.261, 0, -.08], max: [1.25, 3.006, .42] },
      contourPixels: contour.map(p => [...p]),
    };
  }
  update(0, 0);
  return { group, update, setActivity, getDiagnostics };
}
