/**
 * Windows Client Functionality Test
 * Tests core client features before gateway integration
 */

const path = require('path');
const fs = require('fs');

console.log('=== Windows Client Functionality Test ===\n');

const testResults = [];
let totalTests = 0;
let passedTests = 0;

function recordTest(name, passed, details = '') {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`✓ [PASS] ${name}`);
  } else {
    console.log(`✗ [FAIL] ${name}`);
  }
  if (details) {
    console.log(`  ${details}`);
  }
  testResults.push({ name, passed, details });
}

// Test 1: Check project structure
console.log('[Test 1/8] Project Structure');
const requiredFiles = [
  'package.json',
  'src/main/index.ts',
  'src/main/gateway-client.ts',
  'src/main/skill-runtime.ts',
  'src/preload/index.ts'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  const exists = fs.existsSync(filePath);
  recordTest(`File exists: ${file}`, exists);
});

// Test 2: Check dependencies
console.log('\n[Test 2/8] Dependencies Check');
const packageJson = require('./package.json');
const requiredDeps = ['ws', 'electron-updater'];

requiredDeps.forEach(dep => {
  const hasDepInDeps = packageJson.dependencies && packageJson.dependencies[dep];
  const hasDepInDevDeps = packageJson.devDependencies && packageJson.devDependencies[dep];
  const hasDep = hasDepInDeps || hasDepInDevDeps;
  recordTest(`Dependency: ${dep}`, hasDep, hasDep ? `Version: ${hasDepInDeps || hasDepInDevDeps}` : 'Missing');
});

// Test 3: Check node_modules
console.log('\n[Test 3/8] Node Modules Check');
const criticalModules = ['ws', 'electron', 'react'];

criticalModules.forEach(mod => {
  const modPath = path.join(__dirname, 'node_modules', mod);
  const exists = fs.existsSync(modPath);
  recordTest(`Module installed: ${mod}`, exists);
});

// Test 4: Check TypeScript files
console.log('\n[Test 4/8] TypeScript Files Check');
const tsFiles = [
  'src/main/gateway-client.ts',
  'src/main/skill-runtime.ts',
  'src/main/system-service.ts'
];

tsFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const hasExport = content.includes('export');
    recordTest(`${file} has exports`, hasExport);
  } else {
    recordTest(`${file} exists`, false);
  }
});

// Test 5: Check gateway-client implementation
console.log('\n[Test 5/8] Gateway Client Implementation');
const gatewayClientPath = path.join(__dirname, 'src/main/gateway-client.ts');
if (fs.existsSync(gatewayClientPath)) {
  const content = fs.readFileSync(gatewayClientPath, 'utf-8');

  const checks = [
    { name: 'Has GatewayClient class', pattern: /class\s+GatewayClient/ },
    { name: 'Has connect method', pattern: /async\s+connect\s*\(/ },
    { name: 'Has disconnect method', pattern: /async\s+disconnect\s*\(/ },
    { name: 'Has WebSocket import', pattern: /import.*WebSocket.*from\s+['"]ws['"]/ },
    { name: 'Has EventEmitter', pattern: /EventEmitter/ }
  ];

  checks.forEach(check => {
    const passed = check.pattern.test(content);
    recordTest(check.name, passed);
  });
} else {
  recordTest('Gateway client file exists', false);
}

// Test 6: Check skill-runtime implementation
console.log('\n[Test 6/8] Skill Runtime Implementation');
const skillRuntimePath = path.join(__dirname, 'src/main/skill-runtime.ts');
if (fs.existsSync(skillRuntimePath)) {
  const content = fs.readFileSync(skillRuntimePath, 'utf-8');

  const checks = [
    { name: 'Has ClientSkillRuntime class', pattern: /class\s+ClientSkillRuntime/ },
    { name: 'Has executeSkill method', pattern: /executeSkill/ },
    { name: 'Has SkillExecuteRequest type', pattern: /SkillExecuteRequest/ },
    { name: 'Has SkillExecuteResult type', pattern: /SkillExecuteResult/ }
  ];

  checks.forEach(check => {
    const passed = check.pattern.test(content);
    recordTest(check.name, passed);
  });
} else {
  recordTest('Skill runtime file exists', false);
}

// Test 7: Check build configuration
console.log('\n[Test 7/8] Build Configuration');
const configFiles = [
  { name: 'electron.vite.config.ts', required: true },
  { name: 'tsconfig.json', required: true },
  { name: 'electron-builder.json', required: true }
];

configFiles.forEach(({ name, required }) => {
  const filePath = path.join(__dirname, name);
  const exists = fs.existsSync(filePath);
  recordTest(`Config file: ${name}`, exists || !required);
});

// Test 8: Check build output
console.log('\n[Test 8/8] Build Output Check');
const outPath = path.join(__dirname, 'out');
const outExists = fs.existsSync(outPath);
recordTest('Build output directory exists', outExists);

if (outExists) {
  const mainPath = path.join(outPath, 'main');
  const preloadPath = path.join(outPath, 'preload');
  const rendererPath = path.join(outPath, 'renderer');

  recordTest('Main process output exists', fs.existsSync(mainPath));
  recordTest('Preload script output exists', fs.existsSync(preloadPath));
  recordTest('Renderer process output exists', fs.existsSync(rendererPath));
}

// Summary
console.log('\n=== Test Summary ===');
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Pass Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

// Save report
const report = {
  timestamp: new Date().toISOString(),
  totalTests,
  passedTests,
  failedTests: totalTests - passedTests,
  passRate: ((passedTests / totalTests) * 100).toFixed(2),
  results: testResults
};

const reportPath = path.join(__dirname, 'test-client-functionality.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nTest report saved: ${reportPath}`);

// Exit with appropriate code
process.exit(totalTests === passedTests ? 0 : 1);
