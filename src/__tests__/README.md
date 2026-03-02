# Azure AI Search Testing Guide

This directory contains comprehensive tests for the Azure AI Search functionality that demonstrates code impact analysis using dummy PR data.

## Test Files

### 1. `azure-ai-search-service.test.ts`
- **Purpose**: Tests the main Azure AI Search service integration
- **Coverage**: Multi-language PR analysis, search query generation, error handling
- **Features Tested**:
  - Language-specific parsing (C#, Razor, TypeScript)
  - Search query optimization 
  - Code structure detection
  - Rate limiting and timeout handling
  - Error recovery

### 2. `language-parsers.test.ts` 
- **Purpose**: Tests the language-specific parser implementations
- **Coverage**: Parser factory, C#/Razor/TypeScript parsers
- **Features Tested**:
  - File type detection and parser selection
  - Code element extraction (classes, methods, functions, components)
  - Control structure filtering (excludes if/for/while/try/catch)
  - Search query generation per language
  - React component and TypeScript interface parsing

### 3. `azure-ai-search-demo.ts`
- **Purpose**: Interactive demonstration with realistic PR scenarios
- **Coverage**: End-to-end workflows with sample data
- **Scenarios**:
  - E-Commerce order processing (C#/Razor/TypeScript)
  - User authentication system (TypeScript/C# security)
  - API rate limiting middleware (TypeScript Redis integration)

### 4. `run-demo.ts`
- **Purpose**: Executable demo runner
- **Usage**: Demonstrates the functionality with console output

## Running the Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Test Azure AI Search service
npm run test:azure-search

# Test language parsers
npm run test:parsers

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Run Interactive Demo
```bash
# Execute the demo with realistic PR scenarios
npm run test:demo
```

## Demo Scenarios

The demo includes three comprehensive scenarios:

### 1. E-Commerce Order Processing
- **Files**: OrderService.cs, OrderSummary.razor, priceCalculator.ts
- **Changes**: Tax/discount logic, Razor component, TypeScript utilities
- **Demonstrates**: Multi-language parsing and impact analysis

### 2. User Authentication System  
- **Files**: authController.ts, AuthenticationService.cs, jwtValidator.ts
- **Changes**: Security improvements, rate limiting, audit logging
- **Demonstrates**: Security-focused code analysis

### 3. API Rate Limiting Middleware
- **Files**: rateLimiter.ts, redisClient.ts
- **Changes**: New middleware with Redis integration
- **Demonstrates**: Infrastructure component analysis

## Sample Output

When you run the demo, you'll see:

```
🔍 [E-Commerce Order Processing] Azure AI Search Query:
   Query: CalculateTotal OR ProcessOrderAsync OR OrderSummary OR ConfirmOrder OR PriceCalculator
   Filter: (language eq 'csharp' or language eq 'razor' or language eq 'typescript')

📊 [E-Commerce Order Processing] Search Results (5 matches):
   1. OrderService (class) - Score: 0.95
      File: src/Services/OrderService.cs:15
      Content: Service class responsible for order processing including tax calculation...
   2. CalculateTotal (method) - Score: 0.88
      File: src/Services/OrderService.cs:42
      Content: Calculates the total order amount including tax and applying discount codes...
```

## Key Features Demonstrated

### Language-Specific Parsing
- **C#**: Classes, methods, properties, interfaces
- **Razor**: Components, code-behind methods, component references  
- **TypeScript**: Functions, classes, interfaces, React components

### Smart Code Structure Detection
- ✅ Extracts: Classes, methods, functions, components, interfaces
- ❌ Excludes: Control structures (if, for, while, try, catch, switch)
- 🎯 Focuses: Business logic and architectural elements

### Search Query Optimization
- **C#**: Includes both C# and Razor results (shared ecosystem)
- **Razor**: Includes both Razor and C# results (backend integration)
- **TypeScript**: Focused on TypeScript/JavaScript ecosystem

### Error Handling & Performance
- Request timeout configuration
- Rate limiting simulation  
- Network error recovery
- Graceful degradation (fail-open approach)

## Mock vs Real Implementation

These tests use mocked Azure AI Search responses to demonstrate functionality without requiring actual service configuration. To use with a real Azure AI Search service:

1. **Configure Service**: Set up Azure AI Search with a code index
2. **Update Credentials**: Replace mock endpoint and API key
3. **Index Your Code**: Upload your codebase to the search index
4. **Remove Mocks**: Use the real AzureAISearchService instead of the demo version

## Understanding the Results

The analysis provides:

- **Potential Impacts**: Code elements that might be affected by the changes
- **Affected Components**: High-level components that use the modified code
- **Language Breakdown**: Distribution of impacts across languages
- **Code Structures**: Parsed functions, classes, and components from the diff
- **Search Errors**: Any issues encountered during the analysis

This helps PR reviewers understand the broader impact of changes beyond just the modified files.