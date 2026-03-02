import { LanguageParserFactory, CSharpParser, RazorParser, TypeScriptParser } from '../services/parsers/language-parsers';
import { CodeElement, ComponentElement } from '../types/azure-search';

describe('Language-Specific Parsers', () => {
  
  describe('LanguageParserFactory', () => {
    it('should return correct parser for C# files', () => {
      const parser = LanguageParserFactory.createParser('src/Services/OrderService.cs');
      expect(parser).toBeInstanceOf(CSharpParser);
    });

    it('should return correct parser for Razor files', () => {
      const parser = LanguageParserFactory.createParser('src/Components/UserProfile.razor');
      expect(parser).toBeInstanceOf(RazorParser);
    });

    it('should return correct parser for TypeScript files', () => {
      const parser = LanguageParserFactory.createParser('src/utils/helper.ts');
      expect(parser).toBeInstanceOf(TypeScriptParser);
    });

    it('should return TypeScript parser for JavaScript files as fallback', () => {
      const parser = LanguageParserFactory.createParser('src/scripts/app.js');
      expect(parser).toBeInstanceOf(TypeScriptParser);
    });

    it('should return TypeScript parser for unknown file types as fallback', () => {
      const parser = LanguageParserFactory.createParser('src/config.json');
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
    
    public static class ExtensionMethods
    {
        public static bool IsValid(this Order order)
        {
            return order.Items?.Any() ?? false;
        }
    }
}
`;

      const identifiers = parser.extractIdentifiers(code);
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'OrderService',
          type: 'class'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'ExtensionMethods', 
          type: 'class'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'CalculateTotal',
          type: 'method'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'ProcessOrderAsync',
          type: 'method'
        })
      );
    });

    it('should generate appropriate search query for C# code', () => {
      const identifiers: CodeElement[] = [
        { name: 'OrderService', type: 'class', lineNumber: 4 },
        { name: 'CalculateTotal', type: 'method', lineNumber: 8 },
        { name: 'ProcessOrderAsync', type: 'method', lineNumber: 13 }
      ];

      const query = parser.generateSearchQuery(identifiers);
      
      expect(query).toContain('OrderService');
      expect(query).toContain('CalculateTotal');
      expect(query).toContain('ProcessOrderAsync');
      expect(query).toContain(' OR ');
    });

    it('should create appropriate search filter for C# files', () => {
      const filter = parser.createSearchFilter();
      expect(filter).toBe('(language eq \'csharp\' or language eq \'razor\')');
    });

    it('should not extract control structures as code elements', () => {
      const codeWithControlStructures = `
public class TestClass
{
    public void TestMethod()
    {
        if (condition)
        {
            for (int i = 0; i < 10; i++)
            {
                while (running)
                {
                    switch (value)
                    {
                        case 1:
                            break;
                    }
                }
            }
        }
        
        try
        {
            DoSomething();
        }
        catch (Exception ex)
        {
            LogError(ex);
        }
        finally
        {
            Cleanup();
        }
    }
}
`;

      const identifiers = parser.extractIdentifiers(codeWithControlStructures);
      const names = identifiers.map(id => id.name);
      
      expect(names).toContain('TestClass');
      expect(names).toContain('TestMethod');
      
      // Should NOT contain control structures
      expect(names).not.toContain('if');
      expect(names).not.toContain('for');
      expect(names).not.toContain('while');
      expect(names).not.toContain('switch');
      expect(names).not.toContain('try');
      expect(names).not.toContain('catch');
      expect(names).not.toContain('finally');
      expect(names).not.toContain('case');
    });
  });

  describe('RazorParser', () => {
    let parser: RazorParser;

    beforeEach(() => {
      parser = new RazorParser();
    });

    it('should extract Razor component names and methods correctly', () => {
      const razorCode = `
@page "/user-profile/{UserId}"
@using MyApp.Models
@inject IUserService UserService

<div class="user-profile">
    <h2>User Profile for @User?.Name</h2>
    @if (User != null)
    {
        <UserCard User="@User" OnUpdate="@UpdateUser" />
        <DeleteButton OnClick="@DeleteUser" />
    }
</div>

@code {
    [Parameter] public string UserId { get; set; }
    [Inject] private ILogger<UserProfile> Logger { get; set; }
    
    private UserModel User { get; set; }
    private bool IsLoading { get; set; }
    
    protected override async Task OnInitializedAsync()
    {
        IsLoading = true;
        User = await UserService.GetUserAsync(UserId);
        IsLoading = false;
    }
    
    private async Task UpdateUser(UserModel updatedUser)
    {
        try
        {
            await UserService.UpdateAsync(updatedUser);
            Logger.LogInformation("User updated successfully");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to update user");
        }
    }
    
    private async Task DeleteUser()
    {
        if (await JSRuntime.InvokeAsync<bool>("confirm", "Delete this user?"))
        {
            await UserService.DeleteAsync(UserId);
            NavigationManager.NavigateTo("/users");
        }
    }
}
`;

      const identifiers = parser.extractIdentifiers(razorCode);
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'OnInitializedAsync',
          type: 'method'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'UpdateUser',
          type: 'method'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'DeleteUser',
          type: 'method'
        })
      );

      // Should extract component references
      const componentNames = identifiers.map(id => id.name);
      expect(componentNames).toContain('UserCard');
      expect(componentNames).toContain('DeleteButton');
    });

    it('should generate search query for Razor components', () => {
      const identifiers: ComponentElement[] = [
        { name: 'UserProfile', type: 'component', lineNumber: 1 },
        { name: 'UpdateUser', type: 'method', lineNumber: 25 },
        { name: 'UserCard', type: 'component', lineNumber: 9 }
      ];

      const query = parser.generateSearchQuery(identifiers);
      
      expect(query).toContain('UserProfile');
      expect(query).toContain('UpdateUser'); 
      expect(query).toContain('UserCard');
      expect(query).toContain(' OR ');
    });

    it('should create search filter for Razor files', () => {
      const filter = parser.createSearchFilter();
      expect(filter).toBe('(language eq \'razor\' or language eq \'csharp\')');
    });

    it('should handle Razor syntax without extracting HTML as code elements', () => {
      const razorWithHtml = `
@page "/dashboard"
<div class="dashboard">
    <header>
        <h1>Dashboard</h1>
        <nav>
            <ul>
                <li><a href="/home">Home</a></li>
                <li><a href="/profile">Profile</a></li>
            </ul>
        </nav>
    </header>
    
    <main>
        <section class="content">
            @if (Data?.Any() == true)
            {
                @foreach (var item in Data)
                {
                    <DashboardCard Item="@item" OnClick="@(() => SelectItem(item))" />
                }
            }
        </section>
    </main>
</div>

@code {
    private List<DataItem> Data { get; set; }
    
    private void SelectItem(DataItem item)
    {
        SelectedItem = item;
    }
}
`;

      const identifiers = parser.extractIdentifiers(razorWithHtml);
      const names = identifiers.map(id => id.name);
      
      expect(names).toContain('SelectItem');
      expect(names).toContain('DashboardCard');
      
      // Should NOT extract HTML elements
      expect(names).not.toContain('div');
      expect(names).not.toContain('header');
      expect(names).not.toContain('nav');
      expect(names).not.toContain('main');
      expect(names).not.toContain('section');
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

export type UserApiResponse = ApiResponse<UserData>;

export class UserService {
    private readonly baseUrl: string;
    
    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }
    
    async getUser(id: number): Promise<UserData> {
        const response = await fetch(\`\${this.baseUrl}/users/\${id}\`);
        return response.json();
    }
    
    async updateUser(user: UserData): Promise<void> {
        await fetch(\`\${this.baseUrl}/users/\${user.id}\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
    }
}

export const userUtils = {
    formatUserName(user: UserData): string {
        return \`\${user.name} (\${user.email})\`;
    },
    
    isValidUser(user: UserData): boolean {
        return !!(user.id && user.name && user.email);
    }
};

export function createDefaultUser(): UserData {
    return {
        id: 0,
        name: '',
        email: ''
    };
}

const UserContext = React.createContext<UserData | null>(null);

export { UserContext };
`;

      const identifiers = parser.extractIdentifiers(tsCode);
      
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
          type: 'method'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'updateUser',
          type: 'method'
        })
      );
      
      expect(identifiers).toContainEqual(
        expect.objectContaining({
          name: 'createDefaultUser',
          type: 'function'
        })
      );
    });

    it('should generate search query for TypeScript code', () => {
      const identifiers: CodeElement[] = [
        { name: 'UserService', type: 'class', lineNumber: 9 },
        { name: 'getUser', type: 'method', lineNumber: 16 },
        { name: 'UserData', type: 'interface', lineNumber: 2 }
      ];

      const query = parser.generateSearchQuery(identifiers);
      
      expect(query).toContain('UserService');
      expect(query).toContain('getUser');
      expect(query).toContain('UserData');
      expect(query).toContain(' OR ');
    });

    it('should create search filter for TypeScript files', () => {
      const filter = parser.createSearchFilter();
      expect(filter).toBe('language eq \'typescript\'');
    });

    it('should handle React components and hooks correctly', () => {
      const reactCode = `
import React, { useState, useEffect, useCallback } from 'react';

export interface UserFormProps {
    user?: UserData;
    onSubmit: (user: UserData) => void;
    onCancel: () => void;
}

export const UserForm: React.FC<UserFormProps> = ({ user, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState<UserData>(user || createDefaultUser());
    const [isValid, setIsValid] = useState(false);
    
    useEffect(() => {
        setIsValid(validateUser(formData));
    }, [formData]);
    
    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (isValid) {
            onSubmit(formData);
        }
    }, [formData, isValid, onSubmit]);
    
    const handleInputChange = (field: keyof UserData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    
    return (
        <form onSubmit={handleSubmit}>
            {/* Form content */}
        </form>
    );
};

function validateUser(user: UserData): boolean {
    return user.name.length > 0 && user.email.includes('@');
}

export default UserForm;
`;

      const identifiers = parser.extractIdentifiers(reactCode);
      const names = identifiers.map(id => id.name);
      
      expect(names).toContain('UserForm');
      expect(names).toContain('UserFormProps');
      expect(names).toContain('handleSubmit');
      expect(names).toContain('handleInputChange');
      expect(names).toContain('validateUser');
      
      // Should NOT extract React hooks as code elements
      expect(names).not.toContain('useState');
      expect(names).not.toContain('useEffect');
      expect(names).not.toContain('useCallback');
    });
  });
});