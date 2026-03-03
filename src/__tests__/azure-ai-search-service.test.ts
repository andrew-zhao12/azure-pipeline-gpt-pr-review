import { AzureAISearchService } from '../services/azure-ai-search-service';
import { PullRequestChange } from '../types/azure-devops';
import { CodeElement, AzureAISearchConfig } from '../types/azure-search';
import { Agent } from 'node:https';

describe('AzureAISearchService', () => {
  let service: AzureAISearchService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const mockSearchResponse = {
    ok: true,
    json: jest.fn().mockResolvedValue({
      value: [
        {
          id: "func123",
          name: "calculateTotal",
          signature: "public decimal calculateTotal(List<Item> items)",
          filePath: "src/Services/OrderService.cs",
          lineNumber: 45,
          codeType: "method",
          language: "csharp",
          content: "Calculates the total amount for a list of items including tax and discounts",
          score: 0.95
        },
        {
          id: "comp456", 
          name: "OrderSummary",
          signature: "@component OrderSummary { OrderData Order { get; set; } }",
          filePath: "src/Components/OrderSummary.razor",
          lineNumber: 12,
          codeType: "component",
          language: "razor",
          content: "Razor component that displays order summary with total calculations",
          score: 0.88
        }
      ]
    })
  };

  beforeEach(() => {
    mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    (global as any).fetch = mockFetch;
    
    // Mock successful search response
    mockFetch.mockResolvedValue(mockSearchResponse as any);
    
    const config: AzureAISearchConfig = {
      endpoint: 'https://test-search.search.windows.net',
      apiKey: 'test-api-key',
      apiVersion: '2023-11-01',
      indexName: 'test-index'
    };
    
    const httpsAgent = new Agent();
    service = new AzureAISearchService(config, httpsAgent);
  });

  describe('Dummy PR Impact Analysis Tests', () => {
    const createDummyPRChanges = (): PullRequestChange[] => [
      // C# Service modification
      {
        item: {
          path: '/src/Services/OrderService.cs'
        },
        changeType: 'edit'
      },
      // Razor component addition
      {
        item: {
          path: '/src/Components/OrderSummary.razor'
        },
        changeType: 'add'
      },
      // TypeScript utility modification
      {
        item: {
          path: '/src/utils/priceCalculator.ts'
        },
        changeType: 'edit'
      },
      // New C# model
      {
        item: {
          path: '/src/Models/OrderItem.cs'
        },
        changeType: 'add'
      }
    ];

    it('should analyze impact for multi-language PR changes', async () => {
      const changes = createDummyPRChanges();
      const dummyDiff = `
diff --git a/src/Services/OrderService.cs b/src/Services/OrderService.cs
index 1234567..abcdefg 100644
--- a/src/Services/OrderService.cs
+++ b/src/Services/OrderService.cs
@@ -42,8 +42,12 @@ namespace OrderProcessing.Services
     {
         private readonly ITaxCalculator _taxCalculator;
         
-        public decimal CalculateTotal(List<OrderItem> items)
+        public decimal CalculateTotal(List<OrderItem> items, string discountCode = null)
         {
+            if (string.IsNullOrEmpty(discountCode))
+            {
+                return CalculateTotalWithDiscount(items, discountCode);
+            }
             var subtotal = items.Sum(i => i.Price * i.Quantity);
             return _taxCalculator.AddTax(subtotal);
         }
@@ -55,0 +59,8 @@ namespace OrderProcessing.Services
+        
+        private decimal CalculateTotalWithDiscount(List<OrderItem> items, string discountCode)
+        {
+            var subtotal = items.Sum(i => i.Price * i.Quantity);
+            var discount = _discountService.GetDiscount(discountCode);
+            var discountedSubtotal = subtotal * (1 - discount);
+            return _taxCalculator.AddTax(discountedSubtotal);
+        }

diff --git a/src/Components/OrderSummary.razor b/src/Components/OrderSummary.razor
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/Components/OrderSummary.razor
@@ -0,0 +1,25 @@
+@page "/order-summary"
+@using OrderProcessing.Models
+
+<div class="order-summary">
+    <h3>Order Summary</h3>
+    
+    @if (Order != null)
+    {
+        <div class="order-details">
+            <p><strong>Order ID:</strong> @Order.Id</p>
+            <p><strong>Total Items:</strong> @Order.Items.Count</p>
+            <p><strong>Subtotal:</strong> @Order.Subtotal.ToString("C")</p>
+            <p><strong>Tax:</strong> @Order.Tax.ToString("C")</p>
+            <p><strong>Total:</strong> @Order.Total.ToString("C")</p>
+        </div>
+    }
+</div>
+
+@code {
+    [Parameter] public OrderData Order { get; set; }
+    
+    protected override void OnInitialized()
+    {
+        // Component initialization logic
+    }
+}

diff --git a/src/utils/priceCalculator.ts b/src/utils/priceCalculator.ts
index 2345678..bcdefgh 100644
--- a/src/utils/priceCalculator.ts
+++ b/src/utils/priceCalculator.ts
@@ -15,7 +15,7 @@ export interface PriceCalculationOptions {
     discountCode?: string;  
 }
 
-export function calculateItemPrice(item: OrderItem, options: PriceCalculationOptions = {}): number {
+export function calculateItemPrice(item: OrderItem, options: PriceCalculationOptions = {}, includeShipping: boolean = false): number {
     const basePrice = item.price * item.quantity;
     let finalPrice = basePrice;
     
@@ -28,5 +28,9 @@ export function calculateItemPrice(item: OrderItem, options: PriceCalculationOp
         finalPrice *= (1 + options.taxRate);
     }
     
+    if (includeShipping && options.shippingCost) {
+        finalPrice += options.shippingCost;
+    }
+    
     return Math.round(finalPrice * 100) / 100;
 }
`;

      const result = await service.analyzeCodeImpact(
        'src/Services/OrderService.cs',
        dummyDiff,
        'public class OrderService { public decimal calculateTotal() { return 0; } }'
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
      
      // Verify the search was called for the file
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://test-search.search.windows.net/indexes/test-index/docs/search'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'api-key': 'test-api-key'
          })
        })
      );
    });

    it('should generate language-specific search queries for different file types', async () => {
      const dummyDiff = `
diff --git a/src/Services/UserService.cs b/src/Services/UserService.cs
@@ -10,3 +10,7 @@ public class UserService : IUserService
         return await _repository.GetUserAsync(id);
     }
     
+    public async Task<User> CreateUserAsync(User user)
+    {
+        return await _repository.CreateAsync(user);
+    }
 }
`;

      await service.analyzeCodeImpact(
        'src/Services/UserService.cs',
        dummyDiff,
        'public class UserService { public async Task<User> CreateUserAsync(User user) { return user; } }'
      );

      // Check that fetch was called
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle TypeScript file parsing correctly', async () => {
      const tsDiff = `
diff --git a/src/utils/dateHelper.ts b/src/utils/dateHelper.ts
@@ -5,6 +5,10 @@ export interface DateRange {
     end: Date;
 }

+export function formatDateRange(range: DateRange): string {
+    return \`\${range.start.toISOString()} - \${range.end.toISOString()}\`;
+}
+
 export class DateUtility {
     static isValidRange(range: DateRange): boolean {
         return range.start <= range.end;
`;

      await service.analyzeCodeImpact(
        'src/utils/dateHelper.ts',
        tsDiff,
        'export interface DateRange { start: Date; end: Date; } export function formatDateRange(range: DateRange): string { return ""; }'
      );

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle Razor component parsing correctly', async () => {
      const razorDiff = `
diff --git a/src/Components/UserProfile.razor b/src/Components/UserProfile.razor
new file mode 100644
@@ -0,0 +1,20 @@
+@page "/user-profile/{UserId}"
+@using MyApp.Models
+
+<div class="user-profile">
+    <h2>User Profile</h2>
+    @if (User != null)
+    {
+        <ProfileCard User="@User" OnSaveClick="@SaveProfile" />
+    }
+</div>
+
+@code {
+    [Parameter] public string UserId { get; set; }
+    [Inject] private IUserService UserService { get; set; }
+    
+    private User User;
+    
+    private async Task SaveProfile()
+    {
+        await UserService.UpdateUserAsync(User);
+    }
+}
`;

      await service.analyzeCodeImpact(
        'src/Components/UserProfile.razor',
        razorDiff,
        '@page "/user-profile/{UserId}" <div>User Profile</div> @code { public string UserId { get; set; } }'
      );

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should parse code structures correctly for different languages', async () => {
      const complexDiff = `
diff --git a/src/Controllers/OrderController.cs b/src/Controllers/OrderController.cs
@@ -15,0 +15,15 @@ namespace OrderProcessing.Controllers
+    [HttpPost]
+    public async Task<ActionResult<Order>> CreateOrder([FromBody] CreateOrderRequest request)
+    {
+        if (!ModelState.IsValid)
+        {
+            return BadRequest(ModelState);
+        }
+        
+        try 
+        {
+            var order = await _orderService.CreateOrderAsync(request);
+            return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, order);
+        }
+        catch (Exception ex)
+        {
+            _logger.LogError(ex, "Error creating order");
+            return StatusCode(500, "Internal server error");
+        }
+    }
`;

      const result = await service.analyzeCodeImpact(
        'src/Controllers/OrderController.cs',
        complexDiff,
        'public class OrderController { public async Task<ActionResult<Order>> CreateOrder(CreateOrderRequest request) { return null; } }'
      );

      expect(Array.isArray(result)).toBe(true);
    });
    });

    it('should handle search service errors gracefully', async () => {
      // Mock a failed search response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: jest.fn().mockResolvedValue({
          error: { message: 'Access denied' }
        })
      } as any);

      const changes = createDummyPRChanges();
      const result = await service.analyzeCodeImpact(
        'src/test.cs',
        'simple diff',
        'public class Test { }'
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should generate appropriate search queries based on diff content', async () => {
      const repositoryDiff = `
diff --git a/src/Data/ProductRepository.cs b/src/Data/ProductRepository.cs
@@ -25,8 +25,12 @@ namespace ECommerce.Data
             return products.Where(p => p.Category == category).ToList();
         }
         
-        public void UpdateProduct(Product product)
+        public async Task UpdateProductAsync(Product product)
         {
-            _context.Products.Update(product);
-            _context.SaveChanges();
+            _context.Products.Update(product);
+            await _context.SaveChangesAsync();
+        }
+        
+        public async Task<bool> ProductExistsAsync(int productId)
+        {
+            return await _context.Products.AnyAsync(p => p.Id == productId);
         }
`;

      await service.analyzeCodeImpact(
        'src/Data/ProductRepository.cs',
        repositoryDiff,
        'public class ProductRepository { public async Task UpdateProductAsync(Product product) { } }'
      );

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should respect search timeout configuration', async () => {
      const timeoutConfig: AzureAISearchConfig = {
        endpoint: 'https://test-search.search.windows.net',
        apiKey: 'test-api-key',
        apiVersion: '2023-11-01',
        indexName: 'test-index'
      };
      
      const timeoutService = new AzureAISearchService(timeoutConfig, new Agent());

      // Mock a delayed response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve(mockSearchResponse as any), 200)
        )
      );

      const changes = createDummyPRChanges();
      const startTime = Date.now();
      
      const result = await timeoutService.analyzeCodeImpact(
        'src/test.cs',
        'test diff',
        'public class Test { }'
      );
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(150); // Should timeout before 200ms
      expect(Array.isArray(result)).toBe(true);
    });

    it('should generate summary with language breakdown', async () => {
      const changes = createDummyPRChanges();
      const result = await service.analyzeCodeImpact(
        'src/mixed.cs',
        'mixed language diff',
        'public class Mixed { }'
      );

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Language-specific Query Optimization', () => {
    it('should optimize C# queries for classes, methods, and properties', async () => {
      const csharpChanges: PullRequestChange[] = [{
        item: { path: '/src/Models/Customer.cs' },
        changeType: 'edit'
      }];

      const csharpDiff = `
diff --git a/src/Models/Customer.cs b/src/Models/Customer.cs
@@ -10,5 +10,9 @@ public class Customer
     public string Email { get; set; }
     public List<Order> Orders { get; set; } = new List<Order>();
     
+    public void AddOrder(Order order)
+    {
+        Orders.Add(order);
+        this.OnOrderAdded?.Invoke(order);
+    }
 }
`;

      await service.analyzeCodeImpact(
        'src/Models/Customer.cs',
        csharpDiff,
        'public class Customer { public void AddOrder(Order order) { } }'
      );

      const fetchCall = mockFetch.mock.calls[0];
      const request = JSON.parse(fetchCall[1]?.body as string);
      
      expect(request.search).toContain('AddOrder');
      expect(request.search).toContain('Customer');
      expect(request.search).toContain('Order');
      expect(request.filter).toContain('(language eq \'csharp\' or language eq \'razor\')');
    });

    it('should optimize TypeScript queries for functions, interfaces, and types', async () => {
      const tsChanges: PullRequestChange[] = [{
        item: { path: '/src/types/api.ts' },
        changeType: 'add'
      }];

      const tsDiff = `
diff --git a/src/types/api.ts b/src/types/api.ts
new file mode 100644
@@ -0,0 +1,15 @@
+export interface ApiResponse<T> {
+    data: T;
+    success: boolean;
+    message?: string;
+}
+
+export type CustomerApiResponse = ApiResponse<Customer>;
+
+export async function fetchCustomer(id: number): Promise<CustomerApiResponse> {
+    const response = await fetch(\`/api/customers/\${id}\`);
+    return response.json();
+}
`;

      await service.analyzeCodeImpact(
        'src/types/api.ts',
        tsDiff,
        'export interface ApiResponse<T> { data: T; } export async function fetchCustomer(id: number) { return null; }'
      );

      const fetchCall = mockFetch.mock.calls[0];
      const request = JSON.parse(fetchCall[1]?.body as string);
      
      expect(request.search).toContain('ApiResponse');
      expect(request.search).toContain('CustomerApiResponse'); 
      expect(request.search).toContain('fetchCustomer');
      expect(request.filter).toContain('language eq \'typescript\'');
    });
  });
});