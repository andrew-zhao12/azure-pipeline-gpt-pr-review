import { AzureAISearchService } from '../services/azure-ai-search-service';
import { PullRequestChange } from '../types/azure-devops';
import { AzureAISearchConfig } from '../types/azure-search';
import { Agent } from 'node:https';

/**
 * Demo script to showcase Azure AI Search functionality with realistic PR scenarios
 * This script demonstrates language-specific parsing and search query generation
 * without requiring actual Azure AI Search service configuration
 */

interface DemoScenario {
  name: string;
  description: string;
  changes: PullRequestChange[];
  diff: string;
}

// Sample PR scenarios for different languages and project types
const demoScenarios: DemoScenario[] = [
  {
    name: "E-Commerce Order Processing",
    description: "Multi-language changes to order processing system with C#, Razor, and TypeScript",
    changes: [
      { item: { path: '/src/Services/OrderService.cs' }, changeType: 'edit' },
      { item: { path: '/src/Components/OrderSummary.razor' }, changeType: 'add' },
      { item: { path: '/src/utils/priceCalculator.ts' }, changeType: 'edit' }
    ],
    diff: `
diff --git a/src/Services/OrderService.cs b/src/Services/OrderService.cs
index abcd123..efgh456 100644
--- a/src/Services/OrderService.cs
+++ b/src/Services/OrderService.cs
@@ -15,8 +15,15 @@ namespace ECommerce.Services
     public class OrderService : IOrderService
     {
         private readonly ITaxCalculator _taxCalculator;
+        private readonly IDiscountService _discountService;
         
-        public decimal CalculateTotal(List<OrderItem> items)
+        public OrderService(ITaxCalculator taxCalculator, IDiscountService discountService)
+        {
+            _taxCalculator = taxCalculator;
+            _discountService = discountService;
+        }
+        
+        public decimal CalculateTotal(List<OrderItem> items, string? discountCode = null)
         {
             var subtotal = items.Sum(i => i.Price * i.Quantity);
+            
+            if (!string.IsNullOrEmpty(discountCode))
+            {
+                var discount = _discountService.GetDiscountAmount(discountCode, subtotal);
+                subtotal -= discount;
+            }
+            
             return _taxCalculator.AddTax(subtotal);
         }
+        
+        public async Task<Order> ProcessOrderAsync(CreateOrderRequest request)
+        {
+            var order = new Order
+            {
+                Items = request.Items,
+                CustomerId = request.CustomerId,
+                Total = CalculateTotal(request.Items, request.DiscountCode)
+            };
+            
+            return await SaveOrderAsync(order);
+        }
     }

diff --git a/src/Components/OrderSummary.razor b/src/Components/OrderSummary.razor
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/Components/OrderSummary.razor
@@ -0,0 +1,45 @@
+@page "/order-summary/{OrderId:int}"
+@using ECommerce.Models
+@inject IOrderService OrderService
+@inject IJSRuntime JSRuntime
+
+<div class="order-summary-container">
+    <h2>Order Summary #@OrderId</h2>
+    
+    @if (Order != null)
+    {
+        <div class="order-details">
+            <OrderItemsList Items="@Order.Items" />
+            
+            <div class="order-totals">
+                <p><strong>Subtotal:</strong> @Order.Subtotal.ToString("C")</p>
+                @if (Order.DiscountAmount > 0)
+                {
+                    <p class="discount"><strong>Discount:</strong> -@Order.DiscountAmount.ToString("C")</p>
+                }
+                <p><strong>Tax:</strong> @Order.TaxAmount.ToString("C")</p>
+                <hr />
+                <p class="total"><strong>Total:</strong> @Order.Total.ToString("C")</p>
+            </div>
+            
+            <div class="actions">
+                <button class="btn-primary" @onclick="ConfirmOrder">Confirm Order</button>
+                <button class="btn-secondary" @onclick="EditOrder">Edit Order</button>
+            </div>
+        </div>
+    }
+    else if (IsLoading)
+    {
+        <LoadingSpinner />
+    }
+    else
+    {
+        <p>Order not found.</p>
+    }
+</div>
+
+@code {
+    [Parameter] public int OrderId { get; set; }
+    [Inject] private NavigationManager Navigation { get; set; }
+    
+    private OrderModel? Order { get; set; }
+    private bool IsLoading { get; set; } = true;
+    
+    protected override async Task OnInitializedAsync()
+    {
+        try
+        {
+            Order = await OrderService.GetOrderAsync(OrderId);
+        }
+        catch (Exception ex)
+        {
+            await JSRuntime.InvokeVoidAsync("console.error", $"Failed to load order: {ex.Message}");
+        }
+        finally
+        {
+            IsLoading = false;
+        }
+    }
+    
+    private async Task ConfirmOrder()
+    {
+        if (Order == null) return;
+        
+        var confirmed = await JSRuntime.InvokeAsync<bool>("confirm", 
+            $"Confirm order #{Order.Id} for {Order.Total:C}?");
+            
+        if (confirmed)
+        {
+            await OrderService.ConfirmOrderAsync(Order.Id);
+            Navigation.NavigateTo($"/order-confirmation/{Order.Id}");
+        }
+    }
+    
+    private void EditOrder()
+    {
+        Navigation.NavigateTo($"/order-edit/{OrderId}");
+    }
+}

diff --git a/src/utils/priceCalculator.ts b/src/utils/priceCalculator.ts
index 789abc..def456 100644
--- a/src/utils/priceCalculator.ts
+++ b/src/utils/priceCalculator.ts
@@ -1,3 +1,5 @@
+import { DiscountCode, TaxConfiguration } from '../types/commerce';
+
 export interface PriceCalculationOptions {
     taxRate?: number;
     discountCode?: string;
+    shippingCost?: number;
+    membershipDiscount?: number; 
 }
 
 export interface OrderItem {
@@ -8,7 +10,23 @@
     category: string;
 }
 
-export function calculateItemPrice(item: OrderItem, options: PriceCalculationOptions = {}): number {
+export class PriceCalculator {
+    private taxConfig: TaxConfiguration;
+    
+    constructor(taxConfig: TaxConfiguration) {
+        this.taxConfig = taxConfig;
+    }
+    
+    calculateOrderTotal(items: OrderItem[], options: PriceCalculationOptions = {}): number {
+        const itemTotals = items.map(item => this.calculateItemPrice(item, options));
+        let subtotal = itemTotals.reduce((sum, price) => sum + price, 0);
+        
+        // Apply membership discount
+        if (options.membershipDiscount && options.membershipDiscount > 0) {
+            subtotal *= (1 - options.membershipDiscount);
+        }
+        
+        // Add shipping
+        if (options.shippingCost && options.shippingCost > 0) {
+            subtotal += options.shippingCost;
+        }
+        
+        // Apply tax
+        const taxRate = options.taxRate || this.taxConfig.defaultRate;
+        return subtotal * (1 + taxRate);
+    }
+    
+    private calculateItemPrice(item: OrderItem, options: PriceCalculationOptions = {}): number {
     let finalPrice = item.price * item.quantity;
     
+        // Apply item-specific discount
+        if (options.discountCode) {
+            const discountRate = this.getDiscountRate(options.discountCode, item.category);
+            finalPrice *= (1 - discountRate);
+        }
+        
     return Math.round(finalPrice * 100) / 100;
 }
+    
+    private getDiscountRate(discountCode: string, category: string): number {
+        // Simplified discount logic - in real app, this would query a service
+        const discountMap: Record<string, Record<string, number>> = {
+            'ELECTRONICS20': { 'electronics': 0.20, 'default': 0.10 },
+            'SPRING15': { 'default': 0.15 },
+            'NEWCUSTOMER': { 'default': 0.25 }
+        };
+        
+        const discount = discountMap[discountCode];
+        if (!discount) return 0;
+        
+        return discount[category] || discount['default'] || 0;
+    }
+}
+
+// Legacy function for backward compatibility
+export function calculateItemPrice(item: OrderItem, options: PriceCalculationOptions = {}): number {
+    const calculator = new PriceCalculator({ defaultRate: 0.08 });
+    return calculator['calculateItemPrice'](item, options);  
+}
`
  },
  {
    name: "User Authentication System",
    description: "Authentication refactoring with security improvements in TypeScript and C#",
    changes: [
      { item: { path: '/src/api/authController.ts' }, changeType: 'edit' },
      { item: { path: '/src/Services/AuthenticationService.cs' }, changeType: 'edit' },
      { item: { path: '/src/middleware/jwtValidator.ts' }, changeType: 'add' }
    ],
    diff: `
diff --git a/src/api/authController.ts b/src/api/authController.ts
index abc123..def456 100644
--- a/src/api/authController.ts
+++ b/src/api/authController.ts
@@ -5,8 +5,12 @@ import { Request, Response } from 'express';
 import { AuthService } from '../services/authService';
 import { UserValidator } from '../validators/userValidator';
+import { RateLimiter } from '../middleware/rateLimiter';
+import { AuditLogger } from '../utils/auditLogger';

 export class AuthController {
     private authService: AuthService;
+    private rateLimiter: RateLimiter;
+    private auditLogger: AuditLogger;
     
-    constructor(authService: AuthService) {
+    constructor(authService: AuthService, rateLimiter: RateLimiter, auditLogger: AuditLogger) {
         this.authService = authService;
+        this.rateLimiter = rateLimiter;
+        this.auditLogger = auditLogger;
     }
     
     async login(req: Request, res: Response): Promise<void> {
+        const clientIp = req.ip || 'unknown';
+        
+        // Check rate limiting
+        if (!await this.rateLimiter.isAllowed(clientIp, 'login')) {
+            await this.auditLogger.logFailedAttempt(clientIp, 'RATE_LIMITED');
+            res.status(429).json({ error: 'Too many login attempts' });
+            return;
+        }
+        
         try {
             const { email, password } = req.body;
             
+            if (!UserValidator.isValidEmail(email)) {
+                await this.auditLogger.logFailedAttempt(clientIp, 'INVALID_EMAIL', email);
+                res.status(400).json({ error: 'Invalid email format' });
+                return;
+            }
+            
             const result = await this.authService.authenticate(email, password);
             
             if (result.success) {
+                await this.auditLogger.logSuccessfulLogin(result.user.id, clientIp);
                 res.json({
                     token: result.token,
                     user: result.user
                 });
             } else {
+                await this.auditLogger.logFailedAttempt(clientIp, 'INVALID_CREDENTIALS', email);
                 res.status(401).json({ error: 'Invalid credentials' });
             }
         } catch (error) {
+            await this.auditLogger.logError('LOGIN_ERROR', error, { ip: clientIp });
             res.status(500).json({ error: 'Login failed' });
         }
     }
+    
+    async refreshToken(req: Request, res: Response): Promise<void> {
+        try {
+            const { refreshToken } = req.body;
+            
+            if (!refreshToken) {
+                res.status(400).json({ error: 'Refresh token required' });
+                return;
+            }
+            
+            const result = await this.authService.refreshToken(refreshToken);
+            
+            if (result.success) {
+                res.json({
+                    token: result.newAccessToken,
+                    refreshToken: result.newRefreshToken
+                });
+            } else {
+                res.status(401).json({ error: 'Invalid refresh token' });
+            }
+        } catch (error) {
+            await this.auditLogger.logError('REFRESH_TOKEN_ERROR', error);
+            res.status(500).json({ error: 'Token refresh failed' });
+        }
+    }
 }

diff --git a/src/Services/AuthenticationService.cs b/src/Services/AuthenticationService.cs
index xyz789..uvw123 100644
--- a/src/Services/AuthenticationService.cs
+++ b/src/Services/AuthenticationService.cs
@@ -8,10 +8,15 @@ using Microsoft.Extensions.Configuration;
 using Microsoft.Extensions.Logging;
 using System.Security.Cryptography;
 using System.Text;
+using System.Security.Claims;
+using Microsoft.IdentityModel.Tokens;
+using System.IdentityModel.Tokens.Jwt;

 namespace UserManagement.Services
 {
     public class AuthenticationService : IAuthenticationService
     {
         private readonly IUserRepository _userRepository;
+        private readonly IRefreshTokenRepository _refreshTokenRepository;
         private readonly IPasswordHasher _passwordHasher;
         private readonly IConfiguration _configuration;
         private readonly ILogger<AuthenticationService> _logger;
@@ -19,8 +24,10 @@ namespace UserManagement.Services
         public AuthenticationService(
             IUserRepository userRepository,
+            IRefreshTokenRepository refreshTokenRepository,
             IPasswordHasher passwordHasher,
             IConfiguration configuration,
             ILogger<AuthenticationService> logger)
         {
             _userRepository = userRepository;
+            _refreshTokenRepository = refreshTokenRepository;
             _passwordHasher = passwordHasher;
             _configuration = configuration;
             _logger = logger;
@@ -28,7 +35,7 @@ namespace UserManagement.Services
         
         public async Task<AuthenticationResult> AuthenticateAsync(string email, string password)
         {
+            _logger.LogInformation("Authentication attempt for email: {Email}", email);
+            
             try
             {
                 var user = await _userRepository.GetByEmailAsync(email);
                 
                 if (user == null)
                 {
+                    _logger.LogWarning("Authentication failed: User not found for email {Email}", email);
                     return AuthenticationResult.Failed("Invalid credentials");
                 }
                 
+                // Check if user account is locked
+                if (user.IsLocked && user.LockExpiry > DateTime.UtcNow)
+                {
+                    _logger.LogWarning("Authentication failed: Account locked for user {UserId}", user.Id);
+                    return AuthenticationResult.Failed("Account is temporarily locked");
+                }
+                
                 if (!_passwordHasher.Verify(password, user.PasswordHash))
                 {
+                    await IncrementFailedAttempts(user.Id);
+                    _logger.LogWarning("Authentication failed: Invalid password for user {UserId}", user.Id);
                     return AuthenticationResult.Failed("Invalid credentials");
                 }
                 
+                // Reset failed attempts on successful login
+                await ResetFailedAttempts(user.Id);
+                
                 var token = GenerateJwtToken(user);
+                var refreshToken = await GenerateRefreshTokenAsync(user.Id);
                 
+                _logger.LogInformation("Authentication successful for user {UserId}", user.Id);
+                
                 return AuthenticationResult.Success(token, user);
             }
             catch (Exception ex)
             {
+                _logger.LogError(ex, "Authentication error for email {Email}", email);
                 throw new AuthenticationException("Authentication failed", ex);
             }
         }
         
+        public async Task<RefreshTokenResult> RefreshTokenAsync(string refreshToken)
+        {
+            var tokenRecord = await _refreshTokenRepository.GetByTokenAsync(refreshToken);
+            
+            if (tokenRecord == null || tokenRecord.ExpiryDate <= DateTime.UtcNow || tokenRecord.IsRevoked)
+            {
+                _logger.LogWarning("Refresh token invalid or expired: {Token}", refreshToken);
+                return RefreshTokenResult.Failed("Invalid refresh token");
+            }
+            
+            var user = await _userRepository.GetByIdAsync(tokenRecord.UserId);
+            if (user == null)
+            {
+                return RefreshTokenResult.Failed("User not found");
+            }
+            
+            // Generate new tokens
+            var newAccessToken = GenerateJwtToken(user);
+            var newRefreshToken = await GenerateRefreshTokenAsync(user.Id);
+            
+            // Revoke old refresh token
+            await _refreshTokenRepository.RevokeTokenAsync(refreshToken);
+            
+            return RefreshTokenResult.Success(newAccessToken, newRefreshToken);
+        }
+        
         private string GenerateJwtToken(User user)
         {
+            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
+            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
+            
+            var claims = new[]
+            {
+                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
+                new Claim(JwtRegisteredClaimNames.Email, user.Email),
+                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
+                new Claim("role", user.Role)
+            };
+            
+            var token = new JwtSecurityToken(
+                issuer: _configuration["Jwt:Issuer"],
+                audience: _configuration["Jwt:Audience"],
+                claims: claims,
+                expires: DateTime.UtcNow.AddHours(1),
+                signingCredentials: credentials);
+            
+            return new JwtSecurityTokenHandler().WriteToken(token);
+        }
+        
+        private async Task<string> GenerateRefreshTokenAsync(int userId)
+        {
+            var randomBytes = new byte[32];
+            using var rng = RandomNumberGenerator.Create();
+            rng.GetBytes(randomBytes);
+            var refreshToken = Convert.ToBase64String(randomBytes);
+            
+            await _refreshTokenRepository.CreateAsync(new RefreshToken
+            {
+                Token = refreshToken,
+                UserId = userId,
+                ExpiryDate = DateTime.UtcNow.AddDays(7),
+                CreatedAt = DateTime.UtcNow
+            });
+            
+            return refreshToken;
+        }
+        
+        private async Task IncrementFailedAttempts(int userId)
+        {
+            var user = await _userRepository.GetByIdAsync(userId);
+            if (user != null)
+            {
+                user.FailedLoginAttempts++;
+                
+                if (user.FailedLoginAttempts >= 5)
+                {
+                    user.IsLocked = true;
+                    user.LockExpiry = DateTime.UtcNow.AddMinutes(15);
+                    _logger.LogWarning("User account locked due to too many failed attempts: {UserId}", userId);
+                }
+                
+                await _userRepository.UpdateAsync(user);
+            }
+        }
+        
+        private async Task ResetFailedAttempts(int userId)
+        {
+            var user = await _userRepository.GetByIdAsync(userId);
+            if (user != null && (user.FailedLoginAttempts > 0 || user.IsLocked))
+            {
+                user.FailedLoginAttempts = 0;
+                user.IsLocked = false;
+                user.LockExpiry = null;
+                await _userRepository.UpdateAsync(user);
+            }
         }
     }
 }
`
  },
  {
    name: "API Rate Limiting Middleware",
    description: "New TypeScript middleware for API rate limiting with Redis integration",
    changes: [
      { item: { path: '/src/middleware/rateLimiter.ts' }, changeType: 'add' },
      { item: { path: '/src/utils/redisClient.ts' }, changeType: 'add' }
    ],
    diff: `
diff --git a/src/middleware/rateLimiter.ts b/src/middleware/rateLimiter.ts
new file mode 100644
index 0000000..abcd123
--- /dev/null
+++ b/src/middleware/rateLimiter.ts
@@ -0,0 +1,120 @@
+import { Request, Response, NextFunction } from 'express';
+import { RedisClient } from '../utils/redisClient';
+import { Logger } from '../utils/logger';
+
+export interface RateLimitOptions {
+    windowMs: number;       // Time window in milliseconds
+    maxRequests: number;    // Maximum requests per window
+    keyGenerator?: (req: Request) => string;
+    skipIf?: (req: Request) => boolean;
+    onLimitReached?: (req: Request, res: Response) => void;
+}
+
+export interface RateLimitInfo {
+    totalHits: number;
+    totalHitsInWindow: number;
+    remainingRequests: number;
+    msBeforeNext: number;
+}
+
+export class RateLimiter {
+    private redisClient: RedisClient;
+    private logger: Logger;
+    private options: Required<RateLimitOptions>;
+
+    constructor(redisClient: RedisClient, logger: Logger, options: RateLimitOptions) {
+        this.redisClient = redisClient;
+        this.logger = logger;
+        this.options = {
+            keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
+            skipIf: options.skipIf || (() => false),
+            onLimitReached: options.onLimitReached || this.defaultLimitReachedHandler,
+            ...options
+        };
+    }
+
+    /**
+     * Express middleware for rate limiting
+     */
+    middleware() {
+        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
+            try {
+                if (this.options.skipIf(req)) {
+                    return next();
+                }
+
+                const key = this.options.keyGenerator(req);
+                const result = await this.checkRateLimit(key);
+
+                // Set rate limit headers
+                this.setHeaders(res, result);
+
+                if (result.remainingRequests <= 0) {
+                    this.options.onLimitReached(req, res);
+                    return;
+                }
+
+                next();
+            } catch (error) {
+                this.logger.error('Rate limiter error:', error);
+                // Fail open - allow request if rate limiter fails
+                next();
+            }
+        };
+    }
+
+    /**
+     * Check if a specific key/action is allowed
+     */
+    async isAllowed(identifier: string, action: string = 'default'): Promise<boolean> {
+        try {
+            const key = \`rate_limit:\${action}:\${identifier}\`;
+            const result = await this.checkRateLimit(key);
+            return result.remainingRequests > 0;
+        } catch (error) {
+            this.logger.error(\`Rate limiter error for \${identifier}:\`, error);
+            return true; // Fail open
+        }
+    }
+
+    /**
+     * Core rate limiting logic using sliding window
+     */
+    private async checkRateLimit(key: string): Promise<RateLimitInfo> {
+        const now = Date.now();
+        const window = this.options.windowMs;
+        const windowStart = now - window;
+
+        // Use Redis pipeline for atomic operations
+        const pipeline = this.redisClient.pipeline();
+        
+        // Remove expired entries
+        pipeline.zremrangebyscore(key, '-inf', windowStart);
+        
+        // Count current entries in window
+        pipeline.zcard(key);
+        
+        // Add current request
+        pipeline.zadd(key, now, \`\${now}-\${Math.random()}\`);
+        
+        // Set TTL for cleanup
+        pipeline.expire(key, Math.ceil(window / 1000) + 1);
+        
+        const results = await pipeline.exec();
+        const totalHitsInWindow = (results?.[1]?.[1] as number) || 0;
+        const totalHits = totalHitsInWindow + 1; // Include current request
+
+        const remainingRequests = Math.max(0, this.options.maxRequests - totalHits);
+        const oldestEntryTime = await this.redisClient.zrange(key, 0, 0, 'WITHSCORES');
+        const msBeforeNext = oldestEntryTime.length > 0 
+            ? Math.max(0, (oldestEntryTime[1] as number) + window - now)
+            : 0;
+
+        return {
+            totalHits,
+            totalHitsInWindow,
+            remainingRequests,
+            msBeforeNext
+        };
+    }
+
+    private defaultKeyGenerator(req: Request): string {
+        return \`rate_limit:api:\${req.ip || 'unknown'}\`;
+    }
+
+    private defaultLimitReachedHandler(req: Request, res: Response): void {
+        const retryAfter = Math.ceil(this.options.windowMs / 1000);
+        res.status(429)
+           .set('Retry-After', retryAfter.toString())
+           .json({
+               error: 'Too many requests',
+               retryAfter
+           });
+    }
+
+    private setHeaders(res: Response, info: RateLimitInfo): void {
+        res.set({
+            'X-RateLimit-Limit': this.options.maxRequests.toString(),
+            'X-RateLimit-Remaining': info.remainingRequests.toString(),
+            'X-RateLimit-Reset': new Date(Date.now() + info.msBeforeNext).toISOString()
+        });
+    }
+}
+
+/**
+ * Factory for creating common rate limiter configurations
+ */
+export class RateLimiterFactory {
+    static createGlobalLimiter(redisClient: RedisClient, logger: Logger): RateLimiter {
+        return new RateLimiter(redisClient, logger, {
+            windowMs: 15 * 60 * 1000, // 15 minutes
+            maxRequests: 1000,
+            keyGenerator: (req) => \`global:\${req.ip}\`
+        });
+    }
+
+    static createAuthLimiter(redisClient: RedisClient, logger: Logger): RateLimiter {
+        return new RateLimiter(redisClient, logger, {
+            windowMs: 15 * 60 * 1000, // 15 minutes  
+            maxRequests: 10, // Very restrictive for auth endpoints
+            keyGenerator: (req) => \`auth:\${req.ip}\`
+        });
+    }
+
+    static createAPILimiter(redisClient: RedisClient, logger: Logger): RateLimiter {
+        return new RateLimiter(redisClient, logger, {
+            windowMs: 60 * 1000, // 1 minute
+            maxRequests: 60,
+            keyGenerator: (req) => {
+                // Use API key if available, otherwise fall back to IP
+                const apiKey = req.headers['x-api-key'] as string;
+                return apiKey ? \`api_key:\${apiKey}\` : \`ip:\${req.ip}\`;
+            }
+        });
+    }
+}
`
  }
];

/**
 * Mock Azure AI Search Service for demonstration purposes
 */
class DemoAzureAISearchService extends AzureAISearchService {
  private scenario: string = '';
  
  constructor() {
    const config: AzureAISearchConfig = {
      endpoint: 'https://demo-search.search.windows.net',
      apiKey: 'demo-api-key',
      apiVersion: '2023-11-01',
      indexName: 'demo-index'
    };
    
    const agent = new Agent({ keepAlive: true });
    super(config, agent);
  }

  setScenario(scenarioName: string) {
    this.scenario = scenarioName;
  }

  // Override the analyzeCodeImpact to show demo workflow
  public async analyzeCodeImpact(filePath: string, fileDiff: string, fileContent: string) {
    console.log(`\\n🔍 [${this.scenario}] Analyzing: ${filePath}`);
    console.log(`   📝 Diff length: ${fileDiff.length} characters`);
    console.log(`   📄 Content length: ${fileContent.length} characters`);
    
    // Call the real method but catch any errors since we don't have real Azure AI Search
    try {
      return await super.analyzeCodeImpact(filePath, fileDiff, fileContent);
    } catch (error) {
      // Return demo results on error (expected since we don't have real service)
      return this.generateDemoResults(filePath, fileDiff);
    }
  }

  private generateDemoResults(filePath: string, fileDiff: string) {
    const language = this.detectLanguageFromPath(filePath);
    const functions = this.extractFunctionNames(fileDiff);
    
    console.log(`   🎯 Detected language: ${language}`);
    console.log(`   🔧 Found functions: ${functions.join(', ')}`);
    
    return functions.map(func => ({
      identifier: func,
      type: 'function' as const,
      references: this.generateMockReferences(func, language),
      totalReferences: Math.floor(Math.random() * 10) + 1
    }));
  }

  private detectLanguageFromPath(filePath: string): string {
    if (filePath.endsWith('.cs')) return 'C#';
    if (filePath.endsWith('.razor')) return 'Razor';
    if (filePath.endsWith('.ts')) return 'TypeScript';
    if (filePath.endsWith('.js')) return 'JavaScript';
    return 'Unknown';
  }

  private extractFunctionNames(diff: string): string[] {
    const functions: string[] = [];
    const patterns = [
      /function\s+(\w+)/g,
      /public\s+\w+\s+(\w+)\s*\(/g,
      /private\s+\w+\s+(\w+)\s*\(/g,
      /async\s+\w+\s+(\w+)\s*\(/g,
      /class\s+(\w+)/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(diff)) !== null) {
        if (match[1] && !functions.includes(match[1])) {
          functions.push(match[1]);
        }
      }
    }

    return functions.slice(0, 3); // Limit to 3 for demo
  }

  private generateMockReferences(identifier: string, language: string) {
    const mockFiles: Record<string, string[]> = {
      'C#': ['Services/UserService.cs', 'Controllers/UserController.cs', 'Tests/UserServiceTests.cs'],
      'Razor': ['Components/UserProfile.razor', 'Pages/Users.razor', 'Shared/UserCard.razor'],
      'TypeScript': ['utils/userUtils.ts', 'api/userApi.ts', 'components/UserForm.tsx'],
      'JavaScript': ['utils/helpers.js', 'api/endpoints.js', 'components/UserList.jsx']
    };

    const files = mockFiles[language] || mockFiles['TypeScript'];
    
    return files.slice(0, 2).map((file: string, index: number) => ({
      filepath: file,
      content: `Example usage of ${identifier} in ${file}`,
      title: `${identifier} Reference`,
      startLine: 10 + index * 20,
      endLine: 15 + index * 20,
      branch: 'main',
      language: language.toLowerCase(),
      score: 0.9 - index * 0.1, 
      highlights: [`${identifier}(`, `new ${identifier}`, `${identifier}.`]
    }));
  }
}

/**
 * Demo runner function
 */
export async function runAzureAISearchDemo(): Promise<void> {
  console.log('🚀 Azure AI Search Code Impact Analysis Demo');
  console.log('=' .repeat(60));
  
  const demoService = new DemoAzureAISearchService();
  
  for (const scenario of demoScenarios) {
    console.log(`\\n\\n📋 Scenario: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);
    console.log(`🔧 Changes: ${scenario.changes.length} file(s) modified`);
    console.log('-'.repeat(50));
    
    demoService.setScenario(scenario.name);
    
    // Show which files are being analyzed
    console.log('\\n📁 Files being analyzed:');
    scenario.changes.forEach(change => {
      const changeIcon = change.changeType === 'add' ? '➕' : 
                         change.changeType === 'edit' ? '✏️' : '❌';
      console.log(`   ${changeIcon} ${change.item.path} (${change.changeType})`);
    });
    
    try {
      const startTime = Date.now();
      let totalImpacts = 0;
      let allIdentifiers: string[] = [];
      
      // Process each changed file
      for (const change of scenario.changes) {
        const filePath = change.item.path;
        const fileContent = `// Mock file content for ${filePath}\\n// This represents the current state of the file\\n`;
        
        console.log(`\\n   🔄 Processing: ${filePath}`);
        
        const result = await demoService.analyzeCodeImpact(filePath, scenario.diff, fileContent);
        
        if (result && result.length > 0) {
          totalImpacts += result.length;
          const identifiers = result.map(r => r.identifier);
          allIdentifiers.push(...identifiers);
          
          console.log(`      📊 Found ${result.length} impacts:`);
          result.forEach((impact, idx) => {
            console.log(`         ${idx + 1}. ${impact.identifier} (${impact.type}) - ${impact.totalReferences} references`);
            impact.references.slice(0, 2).forEach((ref: any) => {
              console.log(`            📍 ${ref.filepath}:${ref.startLine}-${ref.endLine} (score: ${ref.score.toFixed(2)})`);
            });
          });
        }
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`\\n\\n🎯 Scenario Summary (${duration}ms):`);
      console.log(`   📊 Total Impact Points: ${totalImpacts}`);
      console.log(`   🔍 Unique Identifiers: ${new Set(allIdentifiers).size}`);
      console.log(`   🎯 Affected Components: ${allIdentifiers.join(', ')}`);
      
      if (allIdentifiers.length > 0) {
        const languageStats = calculateLanguageStats(scenario.changes);
        console.log(`   🌍 Language Breakdown:`, JSON.stringify(languageStats, null, 2));
      }
      
    } catch (error) {
      console.error(`   ❌ Demo failed: ${error}`);
    }
    
    console.log('\\n' + '='.repeat(60));
  }
  
  console.log('\\n\\n✅ Demo completed! This showcases how the Azure AI Search integration');
  console.log('   analyzes code changes and finds related components across multiple languages.');
  console.log('\\n💡 To use with real Azure AI Search:');
  console.log('   1. Configure Azure AI Search service with code index');
  console.log('   2. Update AzureAISearchConfig with real endpoint and API key');
  console.log('   3. Run the analysis on actual PR changes');
  console.log('   4. The service will find real references in your codebase');
}

function calculateLanguageStats(changes: PullRequestChange[]) {
  const stats: { [key: string]: number } = {};
  
  for (const change of changes) {
    const path = change.item.path;
    let language = 'other';
    
    if (path.endsWith('.cs')) language = 'csharp';
    else if (path.endsWith('.razor')) language = 'razor';
    else if (path.endsWith('.ts')) language = 'typescript';
    else if (path.endsWith('.js')) language = 'javascript';
    
    stats[language] = (stats[language] || 0) + 1;
  }
  
  return stats;
}

// Export for use in tests or direct execution
export { demoScenarios, DemoAzureAISearchService };