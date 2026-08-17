// node 러너: `npm test` 또는 `node js/features/recipe-trainer/grade.test.node.mjs`
import { runTests } from './grade.test.js';

const r = runTests();
for (const test of r.tests) {
  console.log(`${test.pass ? 'PASS' : 'FAIL'}  ${test.name}${test.pass ? '' : '\n      → ' + test.detail}`);
}
console.log(`\n${r.passed}/${r.total} passed`);
process.exit(r.allPass ? 0 : 1);
