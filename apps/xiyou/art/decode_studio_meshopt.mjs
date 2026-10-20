// Decode a downloaded, user-owned Studio GLB for Blender. Never execute the
// source or overwrite it; retain the original compressed file and digest.
import fs from 'node:fs';
import path from 'node:path';
import { MeshoptDecoder } from 'meshoptimizer';
import { createHash } from 'node:crypto';
const source = process.argv[2];
const target = process.argv[3];
if (!source || !target || path.resolve(source) === path.resolve(target))
  throw Error('Specify separate original and decoded GLB paths');
const blob = fs.readFileSync(source);
if (blob.toString('ascii', 0, 4) !== 'glTF' || blob.readUInt32LE(4) !== 2)
  throw Error('Expected GLB 2');
const jsonLength = blob.readUInt32LE(12);
const gltf = JSON.parse(blob.toString('utf8', 20, 20 + jsonLength));
const binary = blob.subarray(28 + jsonLength);
if (gltf.buffers?.some(b => b.uri)) throw Error('External buffer requires explicit acquisition');
await MeshoptDecoder.ready;
let cursor = 0;
const chunks = [];
for (const view of gltf.bufferViews) {
  const ext = view.extensions?.EXT_meshopt_compression;
  let data;
  if (ext) {
    if (ext.buffer !== 0) throw Error('Unexpected compressed buffer');
    data = Buffer.alloc(ext.count * ext.byteStride);
    MeshoptDecoder.decodeGltfBuffer(data, ext.count, ext.byteStride,
      binary.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength), ext.mode, ext.filter);
    delete view.extensions.EXT_meshopt_compression;
    if (Object.keys(view.extensions).length === 0) delete view.extensions;
  } else {
    if (view.buffer !== 0) throw Error('Unexpected uncompressed buffer');
    data = Buffer.from(binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength));
  }
  view.buffer = 0; view.byteOffset = cursor; view.byteLength = data.length;
  chunks.push(data);cursor += data.length;
  const padding = (4 - cursor % 4) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); cursor += padding; }
}
gltf.buffers = [{ byteLength: cursor }];
for (const name of ['extensionsRequired', 'extensionsUsed']) {
  if (gltf[name]) gltf[name] = gltf[name].filter(n => n !== 'EXT_meshopt_compression');
}
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)]);
const bin = Buffer.concat(chunks);
const header = Buffer.alloc(20);
header.write('glTF');header.writeUInt32LE(2, 4);header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12);header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);binHeader.writeUInt32LE(bin.length, 0);binHeader.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, json, binHeader, bin]);
fs.writeFileSync(target, output);
console.log(JSON.stringify({ originalBytes: blob.length, originalSha256: createHash('sha256').update(blob).digest('hex'), decodedBytes: output.length, decodedSha256: createHash('sha256').update(output).digest('hex') }));
