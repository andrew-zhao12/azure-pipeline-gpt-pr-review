import { LanguageParserFactory, CSharpParser, RazorParser, TypeScriptParser } from '../services/parsers/language-parsers';
import { CodeElement, ComponentElement } from '../types/azure-search';

describe('Language-Specific Parsers', () => {
  
  describe('LanguageParserFactory', () => {
    it('should return correct parser for C# files', () => {
      const parser = LanguageParserFactory.getParser('src/Services/OrderService.cs');
      expect(parser).toBeInstanceOf(CSharpParser);
    });

    it('should return correct parser for Razor files', () => {
      const parser = LanguageParserFactory.getParser('src/Components/UserProfile.razor');
      expect(parser).toBeInstanceOf(RazorParser);
    });

    it('should return correct parser for TypeScript files', () => {
      const parser = LanguageParserFactory.getParser('src/utils/helper.ts');
      expect(parser).toBeInstanceOf(TypeScriptParser);
    });

    it('should return TypeScript parser for JavaScript files as fallback', () => {
      const parser = LanguageParserFactory.getParser('src/scripts/app.js');
      expect(parser).toBeInstanceOf(TypeScriptParser);
    });

    it('should return TypeScript parser for unknown file types as fallback', () => {
      const parser = LanguageParserFactory.getParser('src/config.json');
      expect(parser).toBeInstanceOf(TypeScriptParser);
    });
  });

  describe('CSharpParser', () => {
    let parser: CSharpParser;

    beforeEach(() => {
      parser = new CSharpParser();
    });

    it('should extract C# class names correctly', () => {
      const code = `
namespace OrderProcessing.Services
{
    public class OrderService : IOrderService
    {
        private readonly ITaxCalculator _taxCalculator;
        
        public decimal CalculateTotal(List<OrderItem> items)
        {
            return items.Sum(i => i.Price * i.Quantity);
        }
        
        public async Task<Order> ProcessOrderAsync(CreateOrderRequest request)
        {
            var order = new Order();
            order.Items = request.Items;
            return order;
        }
    }
}
`;

      const identifiers = parser.parseCodeStructure(code, 'OrderService.cs');
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'OrderService',
          type: 'class'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'CalculateTotal',
          type: 'function'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'ProcessOrderAsync',
          type: 'function'
        })
      );
    });

    it('should get primary identifiers for affected lines', () => {
      const code = `
namespace OrderProcessing.Services
{
    public class OrderService : IOrderService
    {
        public decimal CalculateTotal(List<OrderItem> items)
        {
            return items.Sum(i => i.Price * i.Quantity);
        }
        
        public async Task<Order> ProcessOrderAsync(CreateOrderRequest request)
        {
            var order = new Order();
            return order;
        }
    }
}
`;

      const codeStructure = parser.parseCodeStructure(code, 'OrderService.cs');
      const identifiers = parser.getPrimaryIdentifiers('OrderService.cs', [6, 11], codeStructure);
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'CalculateTotal',
          type: 'function'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'ProcessOrderAsync',
          type: 'function'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'OrderService',
          type: 'class'
        })
      );
    });

    it('should filter out C# language keywords and reserved words', () => {
      const codeWithKeywords = `
namespace TestNamespace
{
    public class TestClass
    {
        public void ValidMethod()
        {
            if (true) { }
            for (int i = 0; i < 10; i++) { }
            while (condition) { }
            foreach (var item in items) { }
            switch (value) { case 1: break; }
            using (var resource = GetResource()) { }
            try { } catch (Exception ex) { }
            
            // These should look like method calls but are keywords
            if ();
            for ();
            while ();
        }
        
        // Property accessors that should be filtered
        public int Property { get; set; }
        
        // Event accessors that should be filtered  
        public event EventHandler SomeEvent { add { } remove { } }
    }
}
`;

      const identifiers = parser.parseCodeStructure(codeWithKeywords, 'TestClass.cs');
      
      // Should find the valid class and method
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'TestClass',
          type: 'class'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'ValidMethod',
          type: 'function'
        })
      );
      
      // Should NOT find any keywords as methods
      const methodNames = identifiers.filter(i => i.type === 'function').map(i => i.name);
      const forbiddenKeywords = ['if', 'for', 'while', 'foreach', 'switch', 'using', 'try', 'catch', 'get', 'set', 'add', 'remove'];
      
      forbiddenKeywords.forEach(keyword => {
        expect(methodNames).not.toContain(keyword);
      });
    });

    it('should handle edge cases with keyword-like method names', () => {
      const code = `
public class EdgeCaseClass  
{
    // These are valid method names that contain keywords but aren't keywords themselves
    public void GetUserData() { }
    public void SetConfiguration() { }  
    public void FormatText() { }
    public void WhileProcessing() { }
    public void IfNotNull() { }
    
    // Valid methods with "new" keyword in signature
    public User CreateNewUser() { }
}
`;

      const identifiers = parser.parseCodeStructure(code, 'EdgeCaseClass.cs');
      
      const methodNames = identifiers.filter(i => i.type === 'function').map(i => i.name);
      
      // These should be found as they are valid method names
      expect(methodNames).toContain('GetUserData');
      expect(methodNames).toContain('SetConfiguration');
      expect(methodNames).toContain('FormatText');
      expect(methodNames).toContain('WhileProcessing');
      expect(methodNames).toContain('IfNotNull');
      expect(methodNames).toContain('CreateNewUser');
      
      // But pure keywords should not be found
      expect(methodNames).not.toContain('get');
      expect(methodNames).not.toContain('set');
      expect(methodNames).not.toContain('for');
      expect(methodNames).not.toContain('while');
      expect(methodNames).not.toContain('if');
      expect(methodNames).not.toContain('new');
    });
  });

  describe('RazorParser', () => {
    let parser: RazorParser;

    beforeEach(() => {
      parser = new RazorParser();
    });

    it('should extract Razor component names correctly', () => {
      const razorCode = `
@page "/user-profile/{UserId}"
@using MyApp.Models

<div class="user-profile">
    <h2>User Profile</h2>
</div>

@code {
    [Parameter] public string UserId { get; set; }
    private UserModel User { get; set; }
    
    protected override async Task OnInitializedAsync()
    {
        User = await UserService.GetUserAsync(UserId);
    }
}
`;

      const codeStructure = parser.parseCodeStructure(razorCode, 'UserProfile.razor');
      
      // Razor parser treats the whole file as one component
      expect(codeStructure).toHaveLength(1);
      expect(codeStructure[0]).toEqual(
        expect.objectContaining({
          name: 'UserProfile',
          type: 'class'
        })
      );
    });

    it('should get primary identifiers for Razor components', () => {
      const razorCode = `
@page "/test"
<h1>Test Component</h1>
@code {
    private void TestMethod() {
        // test
    }
}
`;

      const codeStructure = parser.parseCodeStructure(razorCode, 'TestComponent.razor');
      const identifiers = parser.getPrimaryIdentifiers('TestComponent.razor', [1, 5], codeStructure);
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'TestComponent',
          type: 'component'
        })
      );
    });
  });

  describe('TypeScriptParser', () => {
    let parser: TypeScriptParser;

    beforeEach(() => {
      parser = new TypeScriptParser();
    });

    it('should extract TypeScript functions, classes, and interfaces correctly', () => {
      const tsCode = `
export interface UserData {
    id: number;
    name: string;
    email: string;
}

export class UserService {
    private readonly baseUrl: string;
    
    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }
    
    async getUser(id: number): Promise<UserData> {
        const response = await fetch(\`\${this.baseUrl}/users/\${id}\`);
        return response.json();
    }
}

export function createDefaultUser(): UserData {
    return {
        id: 0,
        name: '',
        email: ''
    };
}
`;

      const identifiers = parser.parseCodeStructure(tsCode, 'UserService.ts');
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'UserData',
          type: 'interface'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'UserService',
          type: 'class'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'getUser',
          type: 'function'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'createDefaultUser',
          type: 'function'
        })
      );
    });

    it('should get primary identifiers for TypeScript code', () => {
      const code = `
export class ApiService {
    async getData(): Promise<Data> {
        // implementation
    }
    
    async saveData(data: Data): Promise<void> {
        // implementation  
    }
}
`;

      const codeStructure = parser.parseCodeStructure(code, 'ApiService.ts');
      const identifiers = parser.getPrimaryIdentifiers('ApiService.ts', [3, 7], codeStructure);
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'getData',
          type: 'function'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'saveData', 
          type: 'function'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'ApiService',
          type: 'class'
        })
      );
    });

    it('should filter out TypeScript/JavaScript language keywords', () => {
      const codeWithKeywords = `
export class TestClass {
    validMethod(): void {
        if (true) { }
        for (let i = 0; i < 10; i++) { }
        while (condition) { }
        switch (value) { case 1: break; }
        try { } catch (error) { }
        with (someObject) { }
        
        // These should look like method calls but are keywords
        if();
        for();
        while();
    }
    
    // Valid method that might look like a keyword
    formatData(): string { return ''; }
    switchMode(): void { }
}

// Valid functions
export function processData() { }
async function fetchUserData() { }

// Interface
export interface UserInterface {
    name: string;
}
`;

      const identifiers = parser.parseCodeStructure(codeWithKeywords, 'test.ts');
      
      // Should find valid identifiers
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'TestClass',
          type: 'class'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'validMethod',
          type: 'function'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'processData',
          type: 'function'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'UserInterface',
          type: 'interface'
        })
      );
      
      // Should NOT find keywords as methods
      const methodNames = identifiers.filter(i => i.type === 'function').map(i => i.name);
      const forbiddenKeywords = ['if', 'for', 'while', 'switch', 'try', 'catch', 'with'];
      
      forbiddenKeywords.forEach(keyword => {
        expect(methodNames).not.toContain(keyword);
      });
      
      // But should find valid method names that contain keywords
      expect(methodNames).toContain('formatData');
      expect(methodNames).toContain('switchMode');
    });

    it('should handle additional common keywords that might be parsed incorrectly', () => {
      const code = `
export class EdgeCaseClass {
    // These should be parsed as methods
    newUser(): User { return new User(); }
    deleteItem(): void { }
    returnValue(): string { return 'test'; }
    breakConnection(): void { }
    continueProcessing(): void { }
    
    // Test method parsing with common return types that shouldn't be confused
    async getAsync(): Promise<any> { }
    static create(): EdgeCaseClass { }
}

// Function declarations
export function newFunction() { }
export function deleteData() { }
`;

      const identifiers = parser.parseCodeStructure(code, 'test.ts');
      
      const methodNames = identifiers.filter(i => i.type === 'function').map(i => i.name);
      
      // These are valid method names that happen to contain keywords
      expect(methodNames).toContain('newUser');
      expect(methodNames).toContain('deleteItem'); 
      expect(methodNames).toContain('returnValue');
      expect(methodNames).toContain('breakConnection');
      expect(methodNames).toContain('continueProcessing');
      expect(methodNames).toContain('getAsync');
      expect(methodNames).toContain('create');
      expect(methodNames).toContain('newFunction');
      expect(methodNames).toContain('deleteData');
      
      // These keywords should never be parsed as method names
      const neverAllowed = ['new', 'delete', 'return', 'break', 'continue', 'class', 'function', 'export', 'import'];
      neverAllowed.forEach(keyword => {
        expect(methodNames).not.toContain(keyword);
      });
    });
  });
});