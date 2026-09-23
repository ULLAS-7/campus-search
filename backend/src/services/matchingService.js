/**
 * matchingService v2.0
 * ---------------------
 * Two flows:
 *
 * FLOW A — Direct Request (existing):
 *   Buyer sees a specific listing → requests it → seller notified → accept/decline
 *
 * FLOW B — Broadcast Inquiry (NEW v2.0):
 *   Buyer doesn't see what they need → posts "I need X by [date]"
 *   → ALL sellers with matching category/item get notified simultaneously
 *   → First seller to respond "I have it" → match created → conversation enabled
 *   → Other pending responses auto-declined
 *   → 2-hour window; if no response → inquiry expires → buyer notified
 */
const { db } = require("../db");
const { v4: uuid } = require("uuid");
const notificationService = require("./notificationService");

const RESPONSE_WINDOW_MS = 24 * 60 * 60 * 1000;    // 24 hours seller response window
const NO_SHOW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days to confirm delivery
const INQUIRY_WINDOW_MS = 24 * 60 * 60 * 1000;       // 24 hours for inquiry responses

// =============================================
// FLOW A: Direct Request
// =============================================

async function createRequest(listingId, buyerId, quantity = 1) {
  // Pre-flight checks that don't need to be inside the atomic window
  const listing = await db.prepare("SELECT * FROM listings WHERE id = ?").get(listingId);
  if (!listing) throw new HttpError(404, "Listing not found");
  if (listing.seller_id === buyerId) throw new HttpError(400, "You can't request your own listing.");

  // Atomic decrement: only succeeds if the row still has enough quantity at
  // write time — this eliminates the TOCTOU race between two concurrent buyers.
  // If rowCount === 0, another request got there first → 409.
  const updateResult = await db.query(
    `UPDATE listings
     SET quantity = quantity - ?,
         status   = CASE WHEN (quantity - ?) > 0 THEN 'available' ELSE 'pending' END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND quantity >= ?
       AND status NOT IN ('claimed', 'removed', 'expired')`,
    [quantity, quantity, listingId, quantity]
  );

  if (!updateResult.rowCount || updateResult.rowCount === 0) {
    throw new HttpError(409, "This item does not have enough stock available.");
  }

  const id = uuid();
  await db.prepare(
    `INSERT INTO requests (id, listing_id, buyer_id, quantity, status) VALUES (?, ?, ?, ?, 'notified')`
  ).run(id, listingId, buyerId, quantity);

  return id;
}

async function respondToRequest(requestId, sellerId, decision, deliveryDay) {
  // Inline safety: expire any stale notified/accepted requests for this listing
  // before reading status — correctness must not depend solely on the cron job.
  await expireStaleRequestsForListing(requestId);

  const request = await getRequestRaw(requestId);
    if (!request) throw new HttpError(404, "Request not found");

    const listing = await db.prepare("SELECT * FROM listings WHERE id = ?").get(request.listing_id);
    if (listing.seller_id !== sellerId) throw new HttpError(403, "Only the seller can respond.");
    if (request.status !== "notified") throw new HttpError(409, "This request has already been resolved.");

    if (decision === "accept") {
      if (!deliveryDay) throw new HttpError(400, "A delivery day is required to accept.");
      await db.prepare(
        `UPDATE requests SET status = 'accepted', delivery_day = ?, accepted_at = CURRENT_TIMESTAMP, responded_at = CURRENT_TIMESTAMP WHERE id = ?`
      ).run(deliveryDay, requestId);
    } else {
      await db.prepare(`UPDATE requests SET status = 'declined', responded_at = CURRENT_TIMESTAMP WHERE id = ?`).run(requestId);
      await db.prepare(`UPDATE listings SET quantity = quantity + 1, status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(request.listing_id);
    }
  const updated = await getRequest(requestId);

  if (decision === "accept") {
    const buyer = await db.prepare("SELECT * FROM users WHERE id = ?").get(updated.buyer_id);
    const seller = await db.prepare("SELECT * FROM users WHERE id = ?").get(updated.seller_id);
    notificationService.notify(buyer, {
      type: "request_accepted",
      title: "✅ Request Accepted!",
      message: `${seller.name} accepted your request for "${updated.item_name}" — delivery on ${deliveryDay}. Chat is now open!`,
      data: { requestId, action: "go_to_inbox" },
    });
  } else {
    const buyer = await db.prepare("SELECT * FROM users WHERE id = ?").get(updated.buyer_id);
    notificationService.notify(buyer, {
      type: "request_declined",
      title: "❌ Request Declined",
      message: `Your request for "${updated.item_name}" was declined. The item is available again for others.`,
      data: { action: "go_to_browse" },
    });
  }

  return updated;
}

async function confirmDelivered(requestId, buyerId) {
  // Inline safety: run the same expiry logic before checking status so a
  // request that should have expired isn't accidentally confirmed as delivered.
  await expireStaleRequestsForListing(requestId);

  const request = await getRequestRaw(requestId);
  if (!request) throw new HttpError(404, "Request not found");
  if (request.buyer_id !== buyerId) throw new HttpError(403, "Only the buyer can confirm delivery.");
  if (request.status !== "accepted") throw new HttpError(409, "This request isn't in an accepted state.");

  await db.prepare(`UPDATE requests SET status = 'delivered', delivered_confirmed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(requestId);
  
  // Stock was reserved at request time. If quantity is 0, we can safely mark as claimed.
  const listingItem = await db.prepare("SELECT * FROM listings WHERE id = ?").get(request.listing_id);
  if (listingItem.quantity <= 0) {
    await db.prepare(`UPDATE listings SET status = 'claimed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(request.listing_id);
  }

  const listing = await db.prepare("SELECT l.*, u.* FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.id = ?").get(request.listing_id);
  const FLAT_FEE = 3;
  await db.prepare(`INSERT INTO fee_ledger (id, request_id, seller_id, amount) VALUES (?, ?, ?, ?)`).run(uuid(), requestId, listing.seller_id, FLAT_FEE);

  // Notify seller
  const seller = await db.prepare("SELECT * FROM users WHERE id = ?").get(listing.seller_id);
  notificationService.notify(seller, {
    type: "delivery_confirmed",
    title: "🎉 Delivery Confirmed!",
    message: `The buyer confirmed delivery of "${listing.item_name}". Transaction complete! Please leave a rating.`,
    data: { requestId, action: "rate_buyer" },
  });

  return getRequest(requestId);
}

// =============================================
// FLOW B: Broadcast Inquiry (v2.0 NEW)
// =============================================

async function createInquiry(buyerId, { itemQuery, category, neededByDate, maxBudget, notes }) {
  if (!itemQuery || itemQuery.trim().length < 2) throw new HttpError(400, "Please describe what you're looking for.");

  const id = uuid();
  const expiresAt = new Date(Date.now() + INQUIRY_WINDOW_MS).toISOString();

  await db.prepare(
    `INSERT INTO inquiries (id, buyer_id, item_query, category, needed_by_date, max_budget, notes, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).run(id, buyerId, itemQuery.trim(), category || "Any", neededByDate || null, maxBudget || 0, notes || "", expiresAt);

  const buyer = await db.prepare("SELECT * FROM users WHERE id = ?").get(buyerId);

  // Find ALL sellers with matching available listings
  let sellerQuery = `
    SELECT DISTINCT u.*, l.item_name as matched_item, l.id as matched_listing_id
    FROM users u JOIN listings l ON l.seller_id = u.id
    WHERE l.status = 'available'
      AND l.moderation_status != 'removed'
      AND u.id != ?
  `;
  const params = [buyerId];

  if (category && category !== "Any") {
    sellerQuery += " AND l.category = ?";
    params.push(category);
  }

  const matchingSellers = await db.prepare(sellerQuery).all(...params);

  // Filter by keyword relevance
  const queryWords = itemQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const relevantSellers = matchingSellers.filter(s => {
    const itemWords = s.matched_item.toLowerCase();
    return queryWords.length === 0 || queryWords.some(w => itemWords.includes(w));
  });

  // Also include ALL sellers in the category even without perfect keyword match
  const allCategorySellers = category && category !== "Any"
    ? matchingSellers.filter(s => !relevantSellers.find(r => r.id === s.id))
    : [];

  const notifyTargets = [...relevantSellers, ...allCategorySellers.slice(0, 10)];

  // Broadcast to all matching sellers
  let notifiedCount = 0;
  for (const seller of notifyTargets) {
    notificationService.notify(seller, {
      type: "inquiry_broadcast",
      title: "🔔 Someone needs what you have!",
      message: `${buyer.name} is looking for "${itemQuery}"${neededByDate ? ` by ${neededByDate}` : ""}${maxBudget ? ` (budget: ₹${maxBudget})` : ""}. Can you help?`,
      data: { inquiryId: id, action: "respond_to_inquiry" },
    });
    notifiedCount++;
  }

  notificationService.notify(buyer, {
    type: "system",
    title: "📢 Inquiry Broadcast!",
    message: `Your inquiry for "${itemQuery}" was sent to ${notifiedCount} seller${notifiedCount !== 1 ? "s" : ""}. You'll be notified when someone responds. Expires in 24 hours.`,
    data: { inquiryId: id },
  });

  return { id, notifiedCount };
}

async function respondToInquiry(inquiryId, sellerId, { listingId, availableFrom, priceOffer, message }) {
  const inquiry = await db.prepare("SELECT * FROM inquiries WHERE id = ?").get(inquiryId);
  if (!inquiry) throw new HttpError(404, "Inquiry not found.");
  if (inquiry.status !== "open") throw new HttpError(409, "This inquiry has already been matched or expired.");
  if (inquiry.buyer_id === sellerId) throw new HttpError(400, "You can't respond to your own inquiry.");

  // Check if this seller already responded
  const existing = await db.prepare("SELECT id FROM inquiry_responses WHERE inquiry_id = ? AND seller_id = ?").get(inquiryId, sellerId);
  if (existing) throw new HttpError(409, "You have already responded to this inquiry.");

  const responseId = uuid();
  await db.prepare(
    `INSERT INTO inquiry_responses (id, inquiry_id, seller_id, listing_id, available_from, price_offer, message, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`
  ).run(responseId, inquiryId, sellerId, listingId || null, availableFrom || null, priceOffer || 0, message || "");

  const seller = await db.prepare("SELECT * FROM users WHERE id = ?").get(sellerId);
  const buyer = await db.prepare("SELECT * FROM users WHERE id = ?").get(inquiry.buyer_id);

  // Notify buyer that a seller responded
  notificationService.notify(buyer, {
    type: "inquiry_response",
    title: "🙋 Seller Available!",
    message: `${seller.name} says they can help with "${inquiry.item_query}"${priceOffer ? ` for ₹${priceOffer}` : ""}. Tap to accept!`,
    data: { inquiryId, responseId, action: "accept_inquiry_response" },
  });

  return { responseId, notifiedBuyer: true };
}

async function acceptInquiryResponse(inquiryId, responseId, buyerId) {
      const inquiry = await db.prepare("SELECT * FROM inquiries WHERE id = ?").get(inquiryId);
    if (!inquiry) throw new HttpError(404, "Inquiry not found.");
    if (inquiry.buyer_id !== buyerId) throw new HttpError(403, "Only the buyer can accept a response.");
    if (inquiry.status !== "open") throw new HttpError(409, "This inquiry has already been resolved.");

    const response = await db.prepare("SELECT * FROM inquiry_responses WHERE id = ?").get(responseId);
    if (!response) throw new HttpError(404, "Response not found.");

    // Mark inquiry as matched
    await db.prepare(`UPDATE inquiries SET status = 'matched', matched_response_id = ? WHERE id = ?`).run(responseId, inquiryId);
    await db.prepare(`UPDATE inquiry_responses SET status = 'accepted' WHERE id = ?`).run(responseId);

    // Decline all other pending responses
    await db.prepare(
      `UPDATE inquiry_responses SET status = 'declined' WHERE inquiry_id = ? AND id != ? AND status = 'pending'`
    ).run(inquiryId, responseId);

  const buyer = await db.prepare("SELECT * FROM users WHERE id = ?").get(buyerId);
  const seller = await db.prepare("SELECT * FROM users WHERE id = ?").get(response.seller_id);

  // Notify seller they were accepted
  notificationService.notify(seller, {
    type: "inquiry_matched",
    title: "🎉 You Got Matched!",
    message: `${buyer.name} accepted your offer for "${inquiry.item_query}". Contact them to arrange the exchange!`,
    data: { inquiryId, responseId, buyerId, action: "view_inquiry_match" },
  });

  // Notify declined sellers
  const declinedResponses = await db.prepare(
    `SELECT ir.*, u.id as uid FROM inquiry_responses ir JOIN users u ON u.id = ir.seller_id WHERE ir.inquiry_id = ? AND ir.status = 'declined' AND ir.id != ?`
  ).all(inquiryId, responseId);

  for (const r of declinedResponses) {
    const declinedSeller = await db.prepare("SELECT * FROM users WHERE id = ?").get(r.seller_id);
    if (declinedSeller) {
      notificationService.notify(declinedSeller, {
        type: "system",
        title: "Inquiry Filled",
        message: `The buyer found a match for "${inquiry.item_query}" from another seller. Thank you for offering!`,
        data: { inquiryId },
      });
    }
  }

  return { matched: true, sellerId: response.seller_id, buyerId };
}

// =============================================
// SWEEP JOBS
// =============================================

async function sweepExpiredRequests() {
  const now = Date.now();

  // Auto-expire requests where seller didn't respond
  const stuckNotified = await db.prepare(`SELECT * FROM requests WHERE status = 'notified'`).all();
  for (const r of stuckNotified) {
    if (now - new Date(r.created_at + "Z").getTime() > RESPONSE_WINDOW_MS) {
      await db.prepare(`UPDATE requests SET status = 'expired', responded_at = CURRENT_TIMESTAMP WHERE id = ?`).run(r.id);
      await db.prepare(`UPDATE listings SET quantity = quantity + 1, status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(r.listing_id);

      // Notify buyer
      const buyer = await db.prepare("SELECT * FROM users WHERE id = ?").get(r.buyer_id);
      const listing = await db.prepare("SELECT * FROM listings WHERE id = ?").get(r.listing_id);
      if (buyer && listing) {
        notificationService.notify(buyer, {
          type: "system",
          title: "⏰ Request Expired",
          message: `Your request for "${listing.item_name}" expired — the seller didn't respond in time. The item is available again.`,
          data: { action: "go_to_browse" },
        });
      }
    }
  }

  // Auto no-show
  const stuckAccepted = await db.prepare(`SELECT * FROM requests WHERE status = 'accepted'`).all();
  for (const r of stuckAccepted) {
    if (r.accepted_at && now - new Date(r.accepted_at + "Z").getTime() > NO_SHOW_WINDOW_MS) {
      await db.prepare(`UPDATE requests SET status = 'no_show' WHERE id = ?`).run(r.id);
      await db.prepare(`UPDATE listings SET quantity = quantity + 1, status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(r.listing_id);
      // Track reliability — flag buyer if they've crossed the no-show threshold
      try {
        const reliabilityService = require("./reliabilityService");
        await reliabilityService.recordNoShow(r.buyer_id);
      } catch (e) {
        console.error("[reliability] recordNoShow failed:", e.message);
      }
    }
  }

  // Auto-expire open inquiries
  const expiredInquiries = await db.prepare(
    `SELECT * FROM inquiries WHERE status = 'open' AND expires_at::timestamp < CURRENT_TIMESTAMP`
  ).all();
  for (const inq of expiredInquiries) {
    await db.prepare(`UPDATE inquiries SET status = 'expired' WHERE id = ?`).run(inq.id);
    const buyer = await db.prepare("SELECT * FROM users WHERE id = ?").get(inq.buyer_id);
    if (buyer) {
      notificationService.notify(buyer, {
        type: "system",
        title: "⏰ Inquiry Expired",
        message: `No sellers responded to your inquiry for "${inq.item_query}" in time. Try posting a wishlist or browse listings.`,
        data: { action: "go_to_browse" },
      });
    }
  }

  // Auto-expire listings that have passed their 60-day lifetime
  const expiredListings = await db.prepare(
    `SELECT * FROM listings WHERE status = 'available' AND expires_at::timestamp < CURRENT_TIMESTAMP`
  ).all();
  for (const list of expiredListings) {
    await db.prepare(`UPDATE listings SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(list.id);
    const seller = await db.prepare("SELECT * FROM users WHERE id = ?").get(list.seller_id);
    if (seller) {
      notificationService.notify(seller, {
        type: "system",
        title: "⌛ Listing Expired",
        message: `Your listing "${list.item_name}" has expired after 60 days. You can renew it from your profile if it's still available.`,
        data: { listingId: list.id },
      });
    }
  }
}

// =============================================
// INLINE EXPIRY SAFETY (Task 6)
// =============================================

/**
 * Runs the same expiry logic as the cron sweep, but scoped to one request.
 * Called inline before any code path that depends on a request's current status,
 * so correctness never depends solely on the background job being running.
 */
async function expireStaleRequestsForListing(requestId) {
  const now = Date.now();
  const request = await db.prepare("SELECT * FROM requests WHERE id = ?").get(requestId);
  if (!request) return;

  // If the seller has not responded within the response window, expire it
  if (request.status === "notified") {
    const age = now - new Date(request.created_at + "Z").getTime();
    if (age > RESPONSE_WINDOW_MS) {
      await db.prepare(`UPDATE requests SET status = 'expired', responded_at = CURRENT_TIMESTAMP WHERE id = ?`).run(requestId);
      await db.prepare(`UPDATE listings SET quantity = quantity + 1, status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(request.listing_id);
    }
  }

  // If delivery was never confirmed within the no-show window, mark as no_show
  if (request.status === "accepted" && request.accepted_at) {
    const age = now - new Date(request.accepted_at + "Z").getTime();
    if (age > NO_SHOW_WINDOW_MS) {
      await db.prepare(`UPDATE requests SET status = 'no_show' WHERE id = ?`).run(requestId);
      await db.prepare(`UPDATE listings SET quantity = quantity + 1, status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(request.listing_id);
      // Track reliability inline — same as sweep job
      try {
        const reliabilityService = require("./reliabilityService");
        await reliabilityService.recordNoShow(request.buyer_id);
      } catch (e) {
        console.error("[reliability] inline recordNoShow failed:", e.message);
      }
    }
  }
}

// =============================================
// HELPERS
// =============================================

async function getRequest(id) {
  return await db.prepare(
    `SELECT r.*, l.item_name, l.seller_id, l.price
     FROM requests r JOIN listings l ON l.id = r.listing_id WHERE r.id = ?`
  ).get(id);
}

async function getRequestRaw(id) {
  return await db.prepare("SELECT * FROM requests WHERE id = ?").get(id);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = {
  createRequest, respondToRequest, confirmDelivered,
  createInquiry, respondToInquiry, acceptInquiryResponse,
  sweepExpiredRequests, HttpError,
};
