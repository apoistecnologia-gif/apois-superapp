// Teste isolado e sem credenciais: preserva GPS e aplica o hardener de mapa
// a copias das fontes versionadas, sem modificar os submodulos originais.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const sourceRoot = resolve(root, 'sources/apois-corridas-motorista-admin');
const mapRelative = 'src/components/mapMarkers.tsx';
const homeRelative = 'src/routes/motorista.app.tsx';
const work = mkdtempSync(join(tmpdir(), 'apois-partner-map-'));
const original = new Map();

try {
  for (const rel of [mapRelative, homeRelative]) {
    const from = resolve(sourceRoot, rel);
    assert.ok(existsSync(from), 'Fonte nao encontrada: ' + rel);
    const dest = resolve(work, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(from, dest);
    original.set(rel, readFileSync(from, 'utf8').replace(/\\r\\n/g, '\\n'));
  }

  const execute = () => {
    const result = spawnSync(process.execPath, ['scripts/harden-motorista-map-branding.mjs'], {
      cwd: root,
      env: { ...process.env, APOIS_MOTORISTA_WORKSPACE: work },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout || 'Hardener do mapa falhou');
  };

  execute();
  const mapBefore = original.get(mapRelative);
  const homeBefore = original.get(homeRelative);
  const mapAfter = readFileSync(resolve(work, mapRelative), 'utf8');
  const homeAfter = readFileSync(resolve(work, homeRelative), 'utf8');

  assert.ok(mapBefore.includes('export function InterpolatedDriverMarker'), 'Marcador original ausente');
  const markerStart = mapBefore.indexOf('export function InterpolatedDriverMarker');
  const start = mapBefore.indexOf('  if (!validPosition(position) || !validPosition(display)) return null;', markerStart);
  const end = mapBefore.indexOf('\\n}', start);
  assert.ok(start > markerStart && end > start, 'Bloco de retorno do marcador original nao localizado');
  const afterEnd = mapAfter.indexOf('\\n}', start);
  assert.ok(afterEnd > start, 'Bloco de retorno do novo marcador nao localizado');

  // Todo o restante do componente (incluindo a interpolacao GPS, coordenadas,
  // listeners e demais marcadores) deve permanecer byte a byte equivalente.
  assert.equal(mapAfter.slice(0, start), mapBefore.slice(0, start));
  assert.equal(mapAfter.slice(afterEnd), mapBefore.slice(end));
  const markerVisual = mapAfter.slice(start, afterEnd);
  for (const required of [
    'APOIS_DRIVER_LOCATION_V2',
    'position={display}',
    'rotation: displayHeading',
    'anchor: safePoint(0, 0)',
    'fillColor: "#FFFFFF"',
  ]) assert.ok(markerVisual.includes(required), 'Marcador sem requisito: ' + required);
  assert.ok(!markerVisual.includes('APOIS_DRIVER_LOCATION_A_PATH'), 'Marcador antigo nao pode voltar');

  assert.ok(homeBefore.includes('themeOverride="dark"'), 'Home original mudou de estrutura');
  assert.equal(homeAfter, homeBefore.replace('themeOverride="dark"', 'themeOverride="light"'));
  assert.ok(homeAfter.includes('Geolocation.watchPosition(') || homeAfter.includes('startWatch()'), 'GPS nao preservado');

  // Executar novamente nao deve sobrescrever ou duplicar o marcador.
  execute();
  assert.equal(readFileSync(resolve(work, mapRelative), 'utf8'), mapAfter, 'Marcador nao idempotente');
  assert.equal(readFileSync(resolve(work, homeRelative), 'utf8'), homeAfter, 'Mapa claro nao idempotente');

  console.log('[OK] APOIS Parceiro: mapa claro + marcador GPS centralizado; outras partes intactas e patch idempotente.');
} finally {
  rmSync(work, { recursive: true, force: true });
}
