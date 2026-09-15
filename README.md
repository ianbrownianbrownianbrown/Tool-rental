# Weekender

A shared tool rental prototype for Grand Rapids. Payments are simulated; no
payment credentials are collected.

## Project location

The working checkout is `C:\Users\10ian\OneDrive\Documents\Tool sharing P2P app\Tool rental`.

## Development

Open `index.html` to run the static app, or run `node scripts/preview.cjs` for a
localhost preview. The preview exposes only the app's public assets.

Shared listings, requests, and rentals live in Supabase. The browser-safe project
URL and publishable key are in `app.js`. No service-role key is used.

## Remaining setup

1. Enable Authentication > Sign In / Providers > Allow anonymous sign-ins in
   the Weekender Supabase project. This setting was not changed during this work.
2. Run the entire `supabase-schema.sql` file in the Supabase SQL Editor. It is
   the complete, repeatable setup and preserves existing rows. The separate
   `supabase-rental-workflow.sql` contains the upgrade for an existing listings
   table; running the full schema is sufficient.
3. Serve the updated app to both testers from the same URL.

The live database migration has not been applied. The updated app requires it.
The old database was missing `rental_requests` when inspected.

## Two-person test

1. In browser A, list a tool. Enter a guest name and contact, a daily price,
   description, neighborhood, and optionally a photo and Friday-Sunday price.
2. In a separate browser profile or on another device, open the same app URL.
   View that tool, choose pickup and return dates, and send a rental request.
3. In browser A, open My activity > I'm lending and approve the request.
4. In browser B, open My activity > I'm renting and confirm the test payment.
   There are no payment-detail fields and no real charge.
5. In browser A, mark the tool picked up, then returned. Both browsers see the
   changes after refresh or the automatic 15-second refresh.
6. Try overlapping dates, declining a request, cancellation, editing a tool,
   pausing/relisting it, and posting/closing a shared tool request.

Each guest belongs to their browser session. Clearing browser data or changing
devices loses access to that guest identity. Contact information is available
only to the relevant rental participants. Names on listings and tool requests
are public. Uploaded tool photos are public.

Pickup and return days both count toward the price. The Friday-Sunday rate
applies only to an exact three-day Friday-Sunday rental and only when cheaper
than the daily total. Rental totals are stored when requested. Approved,
confirmed, and active rentals reserve their dates.

Earlier listings have no owner identity and are preserved as read-only listings.
Create a new listing to test the new ownership flow; existing rows are not
automatically assigned to whichever guest opens the site first.

## Verification

Install development dependencies with `pnpm install`, then run `pnpm test`.
Tests use an isolated PostgreSQL-compatible PGlite database and synthetic guests;
they do not modify Supabase. There are tests for pricing, date validation,
ownership, private contact access, conflicting bookings, simulated payments,
cancellation, listing availability, and shared tool requests.

JavaScript syntax and 15 automated tests passed during development. Browser
interaction, mobile layout, photo upload, and live Supabase integration still
need verification. Changes have not been committed, pushed, or deployed.

## Browser libraries

The app vendors Supabase JS 2.57.4 and Lucide 0.468.0 from their npm distributions
through jsDelivr. Their license notices are retained in the vendor files.
