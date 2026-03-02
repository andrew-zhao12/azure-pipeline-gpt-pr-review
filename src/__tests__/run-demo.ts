import { runAzureAISearchDemo } from './azure-ai-search-demo';

/**
 * Test runner to demonstrate Azure AI Search functionality
 * Run with: npm run test:demo
 */

async function main() {
  console.log('🔬 Running Azure AI Search Demo Tests...\n');
  
  try {
    await runAzureAISearchDemo();
    console.log('\n🎉 Demo completed successfully!');
    console.log('\nTo run the actual Jest tests:');
    console.log('  npm test azure-ai-search-service.test.ts');
    console.log('  npm test language-parsers.test.ts');
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}