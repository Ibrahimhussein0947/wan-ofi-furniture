/* eslint-disable no-console */
const ACCOUNTS = [
  ['Owner', 'owner@wanofi.com'],
  ['Accountant', 'accountant@wanofi.com'],
  ['Accountant', 'accountant2@wanofi.com'],
  ['Supervisor', 'supervisor@wanofi.com'],
  ['Carpenter', 'carpenter@wanofi.com'],
  ['Upholsterer', 'upholsterer@wanofi.com'],
  ['Assembler', 'assembler@wanofi.com'],
  ['Painter', 'painter@wanofi.com'],
  ['Designer', 'designer@wanofi.com'],
  ['Installer', 'installer@wanofi.com'],
  ['Customer', 'amina@example.com'],
  ['Customer', 'john@example.com'],
];

function printCredentials(password) {
  console.log('\nDevelopment login accounts (all use the same password):');
  console.log(`  Password: ${password}\n`);
  ACCOUNTS.forEach(([role, email]) => console.log(`  ${role.padEnd(12)} ${email}`));
  console.log('');
}

module.exports = { ACCOUNTS, printCredentials };
