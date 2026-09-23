/**
 * validate.js
 * ------------
 * Zod-based request validation middleware factory.
 * Usage:  router.post("/", validate(schema), handler)
 *
 * On failure returns 400 { error: "<human-readable message>" } matching the
 * error shape used everywhere else in the app (err.status pattern).
 */
const { z } = require("zod");

/**
 * Validate req.body against a Zod schema.
 * Strips unknown keys (z.object's default is strip).
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.errors
        .map((e) => `${e.path.join(".") || "body"}: ${e.message}`)
        .join("; ");
      return res.status(400).json({ error: msg });
    }
    req.body = result.data; // replace with coerced + stripped version
    next();
  };
}

/**
 * Validate req.query against a Zod schema.
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const msg = result.error.errors
        .map((e) => `${e.path.join(".") || "query"}: ${e.message}`)
        .join("; ");
      return res.status(400).json({ error: msg });
    }
    req.query = result.data;
    next();
  };
}

// ---------------------------------------------------------------------------
// Shared field definitions (reused across schemas)
// ---------------------------------------------------------------------------

// Phone: 7-15 digits, optional leading +
const phoneSchema = z
  .string()
  .regex(/^\+?\d{7,15}$/, "phone must be a valid phone number (7–15 digits, optional leading +)");

// Password: 8+ chars
const passwordSchema = z
  .string()
  .min(8, "password must be at least 8 characters");

// Price: non-negative integer, max 1 crore (₹10,000,000)
const priceSchema = z
  .number({ invalid_type_error: "price must be a number" })
  .int("price must be an integer")
  .min(0, "price must be >= 0")
  .max(10_000_000, "price must be <= ₹1,00,00,000");

// Item name: 2–200 chars
const itemNameSchema = z
  .string()
  .min(2, "item_name must be at least 2 characters")
  .max(200, "item_name must be at most 200 characters");

// ---------------------------------------------------------------------------
// Route-specific schemas
// ---------------------------------------------------------------------------

const schemas = {
  // POST /api/auth/register
  register: z.object({
    name:         z.string().min(2, "name must be at least 2 characters"),
    email:        z.string().email("email must be a valid email address"),
    password:     passwordSchema,
    phone:        phoneSchema,
    usn:          z.string().min(3, "usn must be at least 3 characters"),
    department:   z.string().optional(),
    year:         z.string().optional(),
    id_photo_data: z.string().optional(),
  }),

  // POST /api/auth/login
  login: z.object({
    email:    z.string().email("email must be a valid email address"),
    password: z.string().min(1, "password is required"),
  }),

  // POST /api/auth/change-password
  changePassword: z.object({
    currentPassword: z.string().min(1, "currentPassword is required"),
    newPassword:     passwordSchema,
  }),

  // POST /api/auth/reset-password
  resetPassword: z.object({
    email:       z.string().email("email must be a valid email address"),
    phone:       phoneSchema,
    newPassword: passwordSchema,
  }),

  // POST /api/listings
  createListing: z.object({
    item_name:      itemNameSchema,
    category:       z.string().min(1, "category is required"),
    price:          priceSchema.optional().default(0),
    condition_notes: z.string().max(500).optional(),
    // condition enum added in Task 12; validated there too
    condition:      z.enum(["new", "like_new", "used_working", "heavily_used"]).optional(),
    description:    z.string().max(2000).optional(),
    quantity:       z.number().int().min(1).max(1000).optional().default(1),
    listing_type:   z.enum(["sale", "rent"]).optional().default("sale"),
    return_by:      z.string().optional(),
    parent_kit_id:  z.string().uuid().optional().nullable(),
    image_data:     z.string().optional(),
    age_months:     z.number().int().min(0).max(600).optional(),
  }),

  // GET /api/listings query params
  browseListings: z.object({
    search:    z.string().max(200).optional().default(""),
    category:  z.string().optional().default("All"),
    status:    z.string().optional().default("available"),
    sort:      z.enum(["newest", "price_low", "price_high", "rating", "popular"]).optional().default("newest"),
    min_price: z.coerce.number().int().min(0).optional(),
    max_price: z.coerce.number().int().min(0).optional(),
    condition: z.string().optional(),
    limit:     z.coerce.number().int().min(1).max(60).optional().default(20),
    offset:    z.coerce.number().int().min(0).optional().default(0),
  }),

  // POST /api/requests
  createRequest: z.object({
    listing_id: z.string().uuid("listing_id must be a valid UUID"),
    quantity:   z.number().int().min(1).max(100).optional().default(1),
  }),

  // PATCH /api/requests/:id/respond
  respondToRequest: z.object({
    decision:     z.enum(["accept", "decline"], { errorMap: () => ({ message: 'decision must be "accept" or "decline"' }) }),
    delivery_day: z.string().optional(),
  }),

  // POST /api/wishlists
  createWishlist: z.object({
    item_name:  itemNameSchema,
    category:   z.string().optional().default("Any"),
    max_budget: z.number().int().min(0).max(10_000_000).optional().default(0),
    notes:      z.string().max(500).optional().default(""),
  }),

  // POST /api/ratings
  createRating: z.object({
    request_id: z.string().uuid("request_id must be a valid UUID"),
    ratee_id:   z.string().uuid("ratee_id must be a valid UUID"),
    score:      z.union([z.literal(1), z.literal(5)], {
                  errorMap: () => ({ message: "score must be 1 (thumbs down) or 5 (thumbs up)" }),
                }),
    comment:    z.string().max(1000).optional().default(""),
  }),

  // POST /api/messages/:requestId
  sendMessage: z.object({
    body: z.string().min(1, "message body cannot be empty").max(2000, "message body is too long"),
  }),
};

module.exports = { validate, validateQuery, schemas };
