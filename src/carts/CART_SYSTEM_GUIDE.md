# Cart Service - Updated Schema & Implementation

## Summary of Changes

The cart service has been updated to implement an **Amazon/Flipkart-style cart system** where:

- Unauthenticated users can add items to guest carts (session-based)
- On login, guest carts are merged into the authenticated user's cart
- Two user roles with different franchise handling:
  - **FRANCHISE**: Item owner is the platform (franchiseId = NULL)
  - **CUSTOMER**: Item owner is a specific franchise (franchiseId = REQUIRED)

---

## Database Schema Changes

### Old Schema vs New Schema

#### Cart Model

```prisma
// OLD
model Cart {
  id          String
  customerId  String?          // Customer ownership
  franchiseId String?          // Franchise ownership
  adminId     String?          // Admin ownership
  // ... other fields
}

// NEW - UPDATED
model Cart {
  id          String
  userId      String           // Single ownership via User relationship
  user        User  @relation(fields: [userId], references: [id])
  sessionId   String?          // For guest carts (no userId)
  // ... other fields
}
```

#### CartItem Model

```prisma
model CartItem {
  // ... fields ...

  // NEW CONSTRAINT
  @@unique([cartId, productId, variantId])

  // Item always tracks its franchise
  franchiseId String
  franchise   Franchise @relation(fields: [franchiseId], references: [id])
}
```

---

## Business Logic Implementation

### 1. Cart Ownership Model (userId-based)

Each user has ONE active cart. This is the Amazon/Flipkart model:

```typescript
// Single cart per user
let cart = await this.prisma.cart.findFirst({
  where: {
    userId: user.sub, // User's unique identifier
    source: CartSource.USER,
    status: CartStatus.ACTIVE,
  },
});
```

**Benefits:**

- Simpler data structure
- One cart per user (no cart selection needed)
- Cleaner merge logic on login

### 2. FranchiseId Validation (Role-Based)

**Helper Method: `validateFranchiseId()`**

```typescript
private validateFranchiseId(
  userRole: string,
  userFranchiseId: string | undefined,
  requestFranchiseId: string | undefined,
): string | null {
  if (userRole === Role.FRANCHISE_OWNER) {
    // FRANCHISE: Item owner is platform
    return null;  // franchiseId = NULL
  }

  // CUSTOMER: Must specify franchise
  const franchiseId = requestFranchiseId || userFranchiseId;
  if (!franchiseId) {
    throw new BadRequestException(
      'Franchise ID is required for customer cart items',
    );
  }
  return franchiseId;
}
```

**Logic:**

- **FRANCHISE users**: Add items without specifying franchiseId (platform owns all items)
- **CUSTOMER users**: MUST provide franchiseId for each item (specifies which franchise is the seller)

### 3. Guest → Authenticated Cart Merge

When a guest (sessionId-based) logs in:

```typescript
async mergeGuestCartOnLogin(
  user: JwtUser,
  sessionId: string,
): Promise<{ mergedCartIds: string[]; skippedItems: any[] }>
```

**Process:**

1. Find all active guest carts for the sessionId
2. Get or create user's cart (linked to userId)
3. Merge all items from guest carts into user cart
4. Update guest carts: link to userId and mark as merged
5. Validate franchiseId for customer users during merge

**Key Security:**

- Guest carts can only be merged by the user with that sessionId
- Customer users must have franchiseId for items (validated during merge)
- If merge fails for any item, it's tracked in `skippedItems`

---

## API Endpoints

### Authenticated Routes (Protected by JWT)

#### POST `/customer/cart/item` - Add Single Item

```json
{
  "item": {
    "productId": "prod123",
    "variantId": "var456", // optional
    "quantity": 2,
    "franchiseId": "franchise1" // REQUIRED for CUSTOMER, ignored for FRANCHISE
  }
}
```

#### POST `/customer/cart/items` - Bulk Add

```json
{
  "items": [
    {
      "productId": "prod1",
      "franchiseId": "franchise1" // Required per item
    },
    {
      "productId": "prod2",
      "franchiseId": "franchise2" // Can be different franchises
    }
  ]
}
```

#### POST `/customer/cart/merge` - Merge Guest Cart on Login

```bash
# With session from cookie (auto-detected) or header
POST /customer/cart/merge
Headers:
  Authorization: Bearer <token>
  x-session-id: <optional-explicit-session>

Response:
{
  "data": {
    "mergedCartIds": ["cart1", "cart2"],
    "skippedItems": [
      {
        "cartId": "cart3",
        "productId": "prod1",
        "error": "Franchise ID required for customer cart"
      }
    ]
  }
}
```

#### Other Routes

- `GET /customer/cart` - Get all user carts (should be 1)
- `GET /customer/cart/:cartId` - Get specific cart
- `PATCH /customer/cart/:cartId/item` - Update item quantity
- `DELETE /customer/cart/:cartId/item` - Remove item
- `DELETE /customer/cart/:cartId` - Delete entire cart

### Guest Routes (No Authentication)

#### POST `/customer/cart/guest/item` - Add Item to Guest Cart

```json
{
  "item": {
    "productId": "prod123",
    "franchiseId": "franchise1" // REQUIRED for guest carts
  }
}
```

- Session ID auto-generated and stored in HTTPOnly cookie
- Or provided via `x-session-id` header

#### Other Guest Routes

- `POST /customer/cart/guest/items` - Bulk add
- `GET /customer/cart/guest/list` - Get all guest carts
- `GET /customer/cart/guest/:cartId` - Get specific guest cart
- `PATCH /customer/cart/guest/:cartId/item` - Update quantity
- `DELETE /customer/cart/guest/:cartId/item` - Remove item
- `DELETE /customer/cart/guest/:cartId` - Delete cart

---

## Error Handling

### BadRequestException

- Missing required franchiseId for customer users
- Invalid quantity (≤ 0)
- No items in bulk request
- Missing sessionId for guest operations

### NotFoundException

- Cart not found
- Item not found

### ForbiddenException

- User trying to access another user's cart
- Session mismatch for guest carts

### InternalServerErrorException

- Database errors
- Unexpected failures

---

## Data Flow Diagram

### Guest → Authenticated (Merge)

```
┌─────────────────────────────────────┐
│ Guest User (No Auth)                │
│ sessionId = UUID (Cookie)           │
├─────────────────────────────────────┤
│ Creates: Cart (source=GUEST)        │
│  └─ Items (franchiseId required)    │
└─────────────────┬───────────────────┘
                  │
                  │ User clicks "Login"
                  │
                  ▼
┌─────────────────────────────────────┐
│ User Logs In                        │
│ GET JWT Token (user.sub = userId)   │
├─────────────────────────────────────┤
│ POST /customer/cart/merge           │
│  - sessionId from cookie            │
│  - userId from JWT token            │
└─────────────────┬───────────────────┘
                  │
                  │ Merge Process
                  │ 1. Find guest carts (sessionId)
                  │ 2. Find/create user cart (userId)
                  │ 3. Merge items (validate franchiseId)
                  │ 4. Update guest cart → link userId
                  │ 5. Mark as merged & inactive
                  │
                  ▼
┌─────────────────────────────────────┐
│ Authenticated User Cart             │
│ userId = JWT subject                │
├─────────────────────────────────────┤
│ Cart (source=USER)                  │
│  └─ Merged Items from guest         │
│  └─ New items added while logged in │
└─────────────────────────────────────┘
```

### Role-Based Item Ownership

```
FRANCHISE User:
  └─ Creates Cart (userId)
      └─ Adds Item (franchiseId = NULL)
         └─ Platform owns the item

CUSTOMER User:
  └─ Creates Cart (userId)
      └─ Adds Item (franchiseId = "franchise123")
         └─ Franchise "franchise123" is the seller
         └─ Customer bought from that franchise
```

---

## Service Methods Summary

| Method                | Auth | Role | franchiseId                    | Description             |
| --------------------- | ---- | ---- | ------------------------------ | ----------------------- |
| createAndAdd          | ✓    | Both | Customer: REQ, Franchise: NULL | Add item to cart        |
| bulkAdd               | ✓    | Both | Customer: REQ, Franchise: NULL | Bulk add items          |
| mergeGuestCartOnLogin | ✓    | Both | Validated on merge             | Merge guest → user cart |
| findAll               | ✓    | Both | -                              | Get user's carts        |
| findOne               | ✓    | Both | -                              | Get specific cart       |
| updateItem            | ✓    | Both | -                              | Update item quantity    |
| deleteOneByOne        | ✓    | Both | -                              | Remove item             |
| deleteComplete        | ✓    | Both | -                              | Delete cart             |
| createAndAddGuest     | ✗    | -    | REQ                            | Add to guest cart       |
| bulkAddGuest          | ✗    | -    | REQ                            | Bulk add to guest       |
| findGuestCarts        | ✗    | -    | -                              | Get guest carts         |
| findOneGuest          | ✗    | -    | -                              | Get guest cart          |
| updateItemGuest       | ✗    | -    | -                              | Update guest item       |
| deleteOneByOneGuest   | ✗    | -    | -                              | Remove from guest       |
| deleteCompleteGuest   | ✗    | -    | -                              | Delete guest cart       |

---

## Key Implementation Details

### Unique Constraint Enforcement

```sql
@@unique([cartId, productId, variantId])
```

- Prevents duplicate items (same product+variant in same cart)
- On duplicate: quantity is incremented, not new item created

### Cart Summary Updates

```typescript
private async updateCartSummary(cartId: string): Promise<void> {
  // Recalculate:
  // - itemsCount: number of items in cart
  // - totalAmount: sum of (priceAtAddition × quantity)
}
```

### Session Management

```typescript
// HTTPOnly cookie (secure, not accessible via JavaScript)
res.cookie(CART_SESSION_COOKIE, sessionId, {
  httpOnly: true,
  sameSite: 'lax',
  secure: false,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
});
```

### Ownership Verification

```typescript
// For authenticated carts
if (cart.userId !== user.sub) {
  throw new ForbiddenException('You do not have access to this cart');
}

// For guest carts
if (cart.sessionId !== sessionId) {
  throw new NotFoundException('Guest cart not found');
}
```

---

## Testing Scenarios

### Scenario 1: Guest Adds Items → Login → Merge

```
1. Guest adds 2 items (no auth)
   POST /customer/cart/guest/item
   - productId: "A", franchiseId: "F1"
   - Creates: Cart (sessionId=UUID, source=GUEST)

2. Guest adds another item
   POST /customer/cart/guest/item
   - productId: "B", franchiseId: "F1"
   - Updates existing cart

3. Guest logs in
   POST /auth/login → JWT token

4. Merge carts
   POST /customer/cart/merge
   - sessionId: UUID (from cookie)
   - userId: from JWT
   - Result: Cart (userId, source=USER) with items A, B

5. Check cart
   GET /customer/cart/:cartId
   - Returns merged cart
```

### Scenario 2: Customer Adds Items (Different Franchises)

```
POST /customer/cart/item (authenticated)
{
  "item": {
    "productId": "product1",
    "franchiseId": "franchise1",  // Must specify
    "quantity": 2
  }
}

POST /customer/cart/item (authenticated)
{
  "item": {
    "productId": "product2",
    "franchiseId": "franchise2",  // Different franchise!
    "quantity": 1
  }
}

Result: Single cart with 2 items from different franchises
- Item 1: franchiseId = "franchise1"
- Item 2: franchiseId = "franchise2"
```

### Scenario 3: Franchise User Adds Items

```
POST /customer/cart/item (authenticated, role=FRANCHISE_OWNER)
{
  "item": {
    "productId": "product1",
    "quantity": 5
    // franchiseId ignored!
  }
}

Result: Cart item created with franchiseId = NULL
- Platform owns the item, not a specific franchise
```

---

## Future Enhancements

1. **Price Integration**
   - Fetch current prices on item addition
   - Update priceAtAddition in cart items

2. **Stock Management**
   - Use stockLockedAt and lockExpiresAt for inventory reservation
   - Implement lock expiration/cleanup

3. **Cart Analytics**
   - Track guest → authenticated conversion rates
   - Monitor abandoned cart metrics
   - Analyze popular product combinations

4. **Wishlist Support**
   - Extend for wishlist functionality
   - Cart ↔ Wishlist conversion

5. **Multi-Franchise Checkout**
   - Split order by franchise for checkout
   - Separate shipments per franchise

6. **Notifications**
   - Notify franchises of new orders
   - Cart reminder emails for abandoned carts

---

## Migration Notes (If Updating Existing Data)

If migrating from old schema with customerId/franchiseId/adminId:

```sql
-- Link existing carts to users
UPDATE Cart
SET userId = (SELECT userId FROM Customer WHERE id = customerId)
WHERE customerId IS NOT NULL;

-- Set franchiseId to NULL for franchise carts
UPDATE CartItem
SET franchiseId = NULL
WHERE cart.franchiseId IS NOT NULL;
```

Then update user references in code from customerId/franchiseId to userId.
