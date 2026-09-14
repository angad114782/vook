import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { toV2ResourcePath } from '../api/routes';
import { handlers } from '../mocks/handlers';

type Operation = { method: string; path: string };

const apiDirectory = fileURLToPath(new URL('../api/', import.meta.url));
const contractFile = fileURLToPath(new URL('../../docs/openapi-v2.yaml', import.meta.url));

function contractOperations(): Operation[] {
  const operations: Operation[] = [];
  let currentPath = '';
  for (const line of readFileSync(contractFile, 'utf8').split(/\r?\n/)) {
    const path = line.match(/^  (\/[^:]+):$/);
    if (path) currentPath = path[1];
    const method = line.match(/^    (get|post|put|patch|delete):/);
    if (currentPath && method) operations.push({ method: method[1].toUpperCase(), path: currentPath });
  }
  return operations;
}

function clientOperations(): Operation[] {
  const operations: Operation[] = [];
  const call = /api\.(get|post|put|patch|delete)(?:<[^;\n]+?>)?\s*\(\s*([`'"])(\/[^`'"]+)\2/g;
  for (const file of readdirSync(apiDirectory).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))) {
    const source = readFileSync(`${apiDirectory}/${file}`, 'utf8');
    for (const match of source.matchAll(call)) {
      const example = match[3].replace(/\$\{[^}]+\}/g, 'contract-id');
      operations.push({ method: match[1].toUpperCase(), path: toV2ResourcePath(example) });
    }
  }
  return operations;
}

function pathMatches(template: string, actual: string): boolean {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${escaped}$`).test(actual);
}

describe('frontend API contract', () => {
  it('documents every statically declared domain-client operation', () => {
    const contract = contractOperations();
    const missing = clientOperations().filter((client) => !contract.some((operation) => operation.method === client.method && pathMatches(operation.path, client.path)));
    expect(missing).toEqual([]);
  });

  it('installs the strict mock API handler', () => {
    expect(handlers).toHaveLength(1);
  });
});
