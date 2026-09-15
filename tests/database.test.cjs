const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

test("rental workflow enforces ownership, prices, privacy, and booking conflicts in PostgreSQL", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
  `);
  const root = path.join(__dirname, "..");
  await db.exec(fs.readFileSync(path.join(root, "supabase-schema.sql"), "utf8").replace(/^\uFEFF/, ""));
  await db.exec(fs.readFileSync(path.join(root, "supabase-rental-workflow.sql"), "utf8"));
  // Rerunning setup must not restore the former public rental-contact access.
  await db.exec(fs.readFileSync(path.join(root, "supabase-rental-workflow.sql"), "utf8"));

  const owner = "10000000-0000-4000-8000-000000000001";
  const renter = "10000000-0000-4000-8000-000000000002";
  const stranger = "10000000-0000-4000-8000-000000000003";
  const listing = "20000000-0000-4000-8000-000000000001";
  const rental = "30000000-0000-4000-8000-000000000001";
  const competing = "30000000-0000-4000-8000-000000000002";
  for (const id of [owner, renter, stranger]) await db.query("insert into auth.users values ($1)", [id]);
  async function as(id, sql, params = []) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
    await db.exec("set role " + (id ? "authenticated" : "anon"));
    return db.query(sql, params);
  }
  for (const [id, name] of [[owner,"Owner"],[renter,"Renter"],[stranger,"Stranger"]]) {
    await as(id, "insert into public.profiles values ($1,$2,$3)", [id,name,name.toLowerCase()+"@example.test"]);
  }
  const future = new Date(); future.setUTCDate(future.getUTCDate() + 40);
  while (future.getUTCDay() !== 5) future.setUTCDate(future.getUTCDate() + 1);
  const start = future.toISOString().slice(0,10);
  future.setUTCDate(future.getUTCDate() + 2);
  const end = future.toISOString().slice(0,10);
  const create = "select public.save_listing($1,'Test drill','Power tools','Eastown',12.50,25,'Drill, battery, and charger',null)";

  await t.test("only profiled guests can create tools; contact stays private", async () => {
    await assert.rejects(as(null, create, [listing]), /permission denied/);
    await as(owner, create, [listing]);
    const rows = await as(null, "select id,tool_name,daily_rate from public.listings");
    assert.equal(rows.rows[0].tool_name, "Test drill");
    await assert.rejects(as(null, "select owner_contact from public.listings"), /permission denied/);
    await assert.rejects(as(stranger, "select owner_contact from public.listings"), /permission denied/);
    await assert.rejects(as(stranger, create, [listing]), /Only the owner/);
    const profiles = await as(stranger,"select * from public.profiles");
    assert.equal(profiles.rows.length,1);
    assert.equal(profiles.rows[0].id,stranger);
  });
  await t.test("rental totals come from stored prices and retries do not duplicate requests", async () => {
    const query = "select public.request_rental($1,$2,$3,$4,'Weekend project')";
    await assert.rejects(as(owner,query,[rental,listing,start,end]), /own tool/);
    await as(renter,query,[rental,listing,start,end]);
    await as(renter,query,[rental,listing,start,end]);
    const rows = await as(renter,"select * from public.rental_requests");
    assert.equal(rows.rows.length,1);
    assert.equal(Number(rows.rows[0].total_price),25);
    assert.equal(rows.rows[0].rate_label,"Friday-Sunday rate");
    await assert.rejects(as(renter,"update public.rental_requests set total_price=0"), /permission denied/);
    await assert.rejects(as(renter,"select public.request_rental($1,$2,'2000-01-01','2000-01-02','')",[competing,listing]), /starting today/);
  });
  await t.test("strangers cannot read rentals, approve them, or pause another person's listing", async () => {
    assert.equal((await as(stranger,"select * from public.rental_requests")).rows.length,0);
    const activity = await as(stranger,"select public.get_my_activity() as activity");
    assert.equal(activity.rows[0].activity.rentals.length,0);
    await assert.rejects(as(stranger,"select public.rental_action($1,'approve')",[rental]), /not available/);
    await assert.rejects(as(renter,"select public.rental_action($1,'approve')",[rental]), /no longer available/);
    await assert.rejects(as(stranger,"select public.set_listing_status($1,'paused')",[listing]), /Only the owner/);
  });
  await t.test("approval reserves dates and declines competing pending requests", async () => {
    await as(stranger,"select public.request_rental($1,$2,$3,$4,'')",[competing,listing,start,end]);
    await as(owner,"select public.rental_action($1,'approve')",[rental]);
    const rows = await as(stranger,"select status,status_reason from public.rental_requests where id=$1",[competing]);
    assert.equal(rows.rows[0].status,"declined");
    await assert.rejects(as(owner,"select public.rental_action($1,'approve')",[competing]), /no longer available/);
    await assert.rejects(as(stranger,"select public.request_rental(gen_random_uuid(),$1,$2,$3,'')",[listing,start,end]), /already booked/);
    const bookings = await as(null,"select * from public.listing_bookings($1)",[listing]);
    assert.equal(bookings.rows.length,1);
    assert.deepEqual(Object.keys(bookings.rows[0]),["start_date","end_date"]);
  });
  await t.test("renter confirms a fake payment and owner completes pickup and return", async () => {
    await assert.rejects(as(owner,"select public.rental_action($1,'confirm')",[rental]), /no longer available/);
    await as(renter,"select public.rental_action($1,'confirm')",[rental]);
    const rows = await as(renter,"select payment_status from public.rental_requests where id=$1",[rental]);
    assert.equal(rows.rows[0].payment_status,"simulated");
    await assert.rejects(as(renter,"select public.rental_action($1,'pickup')",[rental]), /no longer available/);
    await as(owner,"select public.rental_action($1,'pickup')",[rental]);
    await assert.rejects(as(renter,"select public.rental_action($1,'cancel')",[rental]), /no longer available/);
    await as(owner,"select public.rental_action($1,'complete')",[rental]);
    assert.equal((await as(renter,"select status from public.rental_requests where id=$1",[rental])).rows[0].status,"completed");
  });
  await t.test("cancelling reverses a test payment and releases the dates", async () => {
    const id = "30000000-0000-4000-8000-000000000003";
    await as(renter,"select public.request_rental($1,$2,$3,$4,'')",[id,listing,start,end]);
    await as(owner,"select public.rental_action($1,'approve')",[id]);
    await as(renter,"select public.rental_action($1,'confirm')",[id]);
    await as(renter,"select public.rental_action($1,'cancel')",[id]);
    assert.equal((await as(renter,"select payment_status from public.rental_requests where id=$1",[id])).rows[0].payment_status,"simulated_refund");
    assert.equal((await as(null,"select * from public.listing_bookings($1)",[listing])).rows.length,0);
  });
  await t.test("pausing prevents new requests while owner retains access", async () => {
    await as(owner,"select public.set_listing_status($1,'paused')",[listing]);
    assert.equal((await as(null,"select id from public.listings")).rows.length,0);
    const mine = await as(owner,"select public.get_my_activity() as activity");
    assert.equal(mine.rows[0].activity.listings.length,1);
    await assert.rejects(as(renter,"select public.request_rental(gen_random_uuid(),$1,$2,$3,'')",[listing,start,end]), /not accepting/);
    await as(owner,"select public.set_listing_status($1,'available')",[listing]);
  });
  await t.test("tool requests are shared and only the author can close them", async () => {
    const id="40000000-0000-4000-8000-000000000001";
    await as(renter,"select public.post_tool_request($1,'Pressure washer',$2,'Eastown',40,'Patio project')",[id,start]);
    assert.equal((await as(null,"select tool_name from public.tool_requests")).rows[0].tool_name,"Pressure washer");
    await assert.rejects(as(stranger,"select public.close_tool_request($1)",[id]), /Only the author/);
    await as(renter,"select public.close_tool_request($1)",[id]);
    assert.equal((await as(null,"select tool_name from public.tool_requests")).rows.length,0);
  });
});
