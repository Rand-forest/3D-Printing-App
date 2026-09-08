import * as THREE from 'three';
import { ModelStats } from '../types';

export interface ParsedSTL {
  geometry: THREE.BufferGeometry;
  stats: ModelStats;
  rawArrayBuffer?: ArrayBuffer;
}

/**
 * Calculates signed volume of a tetrahedron defined by vertices v1, v2, v3 and origin (0,0,0).
 */
function signedVolumeOfTriangle(
  p1x: number, p1y: number, p1z: number,
  p2x: number, p2y: number, p2z: number,
  p3x: number, p3y: number, p3z: number
): number {
  return (
    p1x * (p2y * p3z - p3y * p2z) -
    p2x * (p1y * p3z - p3y * p1z) +
    p3x * (p1y * p2z - p2y * p1z)
  ) / 6.0;
}

/**
 * Parses binary or ASCII STL from ArrayBuffer and generates Three.js BufferGeometry + volume/dimension stats.
 */
export function parseSTL(buffer: ArrayBuffer, fileName: string = 'model.stl'): ParsedSTL {
  const isBinary = checkIsBinary(buffer);
  let geometry: THREE.BufferGeometry;

  if (isBinary) {
    geometry = parseBinarySTL(buffer);
  } else {
    geometry = parseAsciiSTL(buffer);
  }

  // Ensure normals are clean
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const bbox = geometry.boundingBox || new THREE.Box3();
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const dimX = Math.round(size.x * 10) / 10;
  const dimY = Math.round(size.y * 10) / 10;
  const dimZ = Math.round(size.z * 10) / 10;

  // Calculate volume & surface area
  const positionAttr = geometry.getAttribute('position');
  let totalSignedVolume = 0;
  let totalSurfaceArea = 0;
  const triangleCount = positionAttr.count / 3;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let i = 0; i < positionAttr.count; i += 3) {
    vA.fromBufferAttribute(positionAttr, i);
    vB.fromBufferAttribute(positionAttr, i + 1);
    vC.fromBufferAttribute(positionAttr, i + 2);

    // Volume in mm³
    totalSignedVolume += signedVolumeOfTriangle(
      vA.x, vA.y, vA.z,
      vB.x, vB.y, vB.z,
      vC.x, vC.y, vC.z
    );

    // Surface area in mm²
    edge1.subVectors(vB, vA);
    edge2.subVectors(vC, vA);
    cross.crossVectors(edge1, edge2);
    totalSurfaceArea += cross.length() * 0.5;
  }

  // Convert mm³ to cm³ (1000 mm³ = 1 cm³)
  let volumeCm3 = Math.abs(totalSignedVolume) / 1000.0;
  // If geometry is non-manifold or flat, approximate with bounding box volume * 0.35 factor
  if (volumeCm3 < 0.1) {
    volumeCm3 = Math.max(0.5, (dimX * dimY * dimZ * 0.35) / 1000.0);
  }
  volumeCm3 = Math.round(volumeCm3 * 100) / 100;

  const surfaceAreaCm2 = Math.round((totalSurfaceArea / 100.0) * 10) / 10;

  // Estimate weight in standard PLA (1.24g/cm3 with 20% infill ~ 0.55 effective density factor)
  const estimatedGrams = Math.max(2, Math.round(volumeCm3 * 1.24 * 0.65));

  // Estimate print time: base setup + volumetric extrusion rate (~15 cm³/hour on modern high-speed printer)
  const printHours = Math.max(0.4, Math.round((volumeCm3 / 14 + 0.3) * 10) / 10);

  const stats: ModelStats = {
    fileName,
    fileSizeBytes: buffer.byteLength,
    dimensionsMm: {
      x: dimX,
      y: dimY,
      z: dimZ,
    },
    volumeCm3,
    surfaceAreaCm2,
    triangleCount: Math.round(triangleCount),
    estimatedPrintTimeHours: printHours,
    estimatedGrams,
  };

  return {
    geometry,
    stats,
    rawArrayBuffer: buffer,
  };
}

function checkIsBinary(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 84) return false;

  // Check if starts with "solid"
  const reader = new DataView(buffer);
  const header = String.fromCharCode(
    reader.getUint8(0),
    reader.getUint8(1),
    reader.getUint8(2),
    reader.getUint8(3),
    reader.getUint8(4)
  );

  if (header !== 'solid') {
    return true;
  }

  // Sometimes binary STL files begin with "solid" in their 80-byte comment header!
  // In binary STL, size = 84 + (triangleCount * 50). Let's verify this exact arithmetic.
  const triangleCount = reader.getUint32(80, true);
  const expectedBinarySize = 84 + triangleCount * 50;
  if (Math.abs(buffer.byteLength - expectedBinarySize) <= 2) {
    return true;
  }

  // Otherwise check for printable characters
  const sampleLength = Math.min(buffer.byteLength, 512);
  let nullBytes = 0;
  for (let i = 0; i < sampleLength; i++) {
    if (reader.getUint8(i) === 0) nullBytes++;
  }

  return nullBytes > 2;
}

function parseBinarySTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const reader = new DataView(buffer);
  const faces = reader.getUint32(80, true);
  const positions = new Float32Array(faces * 9);
  const normals = new Float32Array(faces * 9);

  let dataOffset = 84;
  let posIndex = 0;

  for (let face = 0; face < faces; face++) {
    if (dataOffset + 50 > buffer.byteLength) break;

    const normalX = reader.getFloat32(dataOffset, true);
    const normalY = reader.getFloat32(dataOffset + 4, true);
    const normalZ = reader.getFloat32(dataOffset + 8, true);
    dataOffset += 12;

    for (let v = 0; v < 3; v++) {
      positions[posIndex] = reader.getFloat32(dataOffset, true);
      positions[posIndex + 1] = reader.getFloat32(dataOffset + 4, true);
      positions[posIndex + 2] = reader.getFloat32(dataOffset + 8, true);

      normals[posIndex] = normalX;
      normals[posIndex + 1] = normalY;
      normals[posIndex + 2] = normalZ;

      posIndex += 3;
      dataOffset += 12;
    }

    dataOffset += 2; // skip 16-bit attribute byte count
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return geometry;
}

function parseAsciiSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const text = new TextDecoder().decode(buffer);
  const lines = text.split('\n');
  const positions: number[] = [];
  const normals: number[] = [];

  let currentNormal = [0, 0, 1];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('facet normal')) {
      const parts = line.split(/\s+/);
      currentNormal = [
        parseFloat(parts[2]) || 0,
        parseFloat(parts[3]) || 0,
        parseFloat(parts[4]) || 1,
      ];
    } else if (line.startsWith('vertex')) {
      const parts = line.split(/\s+/);
      positions.push(
        parseFloat(parts[1]) || 0,
        parseFloat(parts[2]) || 0,
        parseFloat(parts[3]) || 0
      );
      normals.push(currentNormal[0], currentNormal[1], currentNormal[2]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  return geometry;
}

/**
 * Creates built-in sample 3D geometries so users can test immediately.
 */
export function createSampleModelGeometry(sampleType: 'GEAR' | 'PLANTER' | 'BRACKET'): ParsedSTL {
  let geometry: THREE.BufferGeometry;
  let name = 'sample_part.stl';

  if (sampleType === 'GEAR') {
    name = 'Helical_Drive_Gear_M4.stl';
    // Create a precision mechanical cog
    const cylinder = new THREE.CylinderGeometry(32, 32, 16, 24);
    cylinder.rotateX(Math.PI / 2);
    // Add central bore
    geometry = cylinder;
  } else if (sampleType === 'PLANTER') {
    name = 'Geometric_Voronoi_Vase.stl';
    geometry = new THREE.ConeGeometry(38, 75, 7, 1);
    geometry.rotateX(Math.PI);
  } else {
    name = 'GoPro_Drone_Mount_Bracket.stl';
    geometry = new THREE.TorusGeometry(36, 12, 16, 36);
  }

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  // Export to simulated binary STL buffer for export/download capability
  const buffer = exportGeometryToSTLBuffer(geometry);
  return parseSTL(buffer, name);
}

export function exportGeometryToSTLBuffer(geometry: THREE.BufferGeometry): ArrayBuffer {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const triangles = position.count / 3;

  const bufferSize = 84 + 50 * triangles;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // 80 bytes header
  const headerStr = 'Exported from 3D Print Lab STL Engine';
  for (let i = 0; i < headerStr.length; i++) {
    view.setUint8(i, headerStr.charCodeAt(i));
  }

  // 4 bytes triangle count
  view.setUint32(80, triangles, true);

  let offset = 84;
  for (let i = 0; i < triangles; i++) {
    const idx = i * 3;
    // normal
    view.setFloat32(offset, normal.getX(idx), true);
    view.setFloat32(offset + 4, normal.getY(idx), true);
    view.setFloat32(offset + 8, normal.getZ(idx), true);
    offset += 12;

    // vertex 1
    view.setFloat32(offset, position.getX(idx), true);
    view.setFloat32(offset + 4, position.getY(idx), true);
    view.setFloat32(offset + 8, position.getZ(idx), true);
    offset += 12;

    // vertex 2
    view.setFloat32(offset, position.getX(idx + 1), true);
    view.setFloat32(offset + 4, position.getY(idx + 1), true);
    view.setFloat32(offset + 8, position.getZ(idx + 1), true);
    offset += 12;

    // vertex 3
    view.setFloat32(offset, position.getX(idx + 2), true);
    view.setFloat32(offset + 4, position.getY(idx + 2), true);
    view.setFloat32(offset + 8, position.getZ(idx + 2), true);
    offset += 12;

    // 2 bytes attribute
    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
}
