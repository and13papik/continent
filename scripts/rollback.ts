import { execSync } from 'child_process';

try {
  console.log('Restoring pages/AdminTable.tsx from Git...');
  execSync('git checkout -- pages/AdminTable.tsx');
  console.log('SUCCESS: pages/AdminTable.tsx has been restored successfully!');
} catch (error) {
  console.error('ERROR: Failed to run git checkout:', error);
}
