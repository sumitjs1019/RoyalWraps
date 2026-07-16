# Render: Static Frontend + Sleeping Backend

This setup keeps the RoyalWrap website frontend on a Render Static Site and moves server/API work to a separate free Web Service.

## Result

- Opening the website loads only the Static Site, so the homepage does not show Render's waking-up page.
- `/api/*` requests are rewritten to the backend Web Service.
- The backend can spin down after inactivity.
- The backend wakes only when a backend feature is used, such as payment, customer account/order lookup, admin API, or custom-photo upload.
- The customer's browser remains on the frontend domain while the API request runs in the background.

## Safe deployment steps

1. Keep the current live Render service running. Do not delete it yet.
2. In Render Dashboard, select **New > Blueprint**.
3. Connect the GitHub repository `sumitjs1019/RoyalWraps`.
4. Render detects `render.yaml` and creates:
   - `royalwraps-api-sumitjs1019` — free Node.js backend
   - `royalwraps-store-sumitjs1019` — static frontend
5. When Render asks for secret environment values, copy them from the existing service:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `ADMIN_KEY`
   - Cloudinary values if custom photo upload is used
   - `TWOFACTOR_API_KEY` if customer OTP login is used
6. Test the new static URL first. Confirm:
   - Homepage opens immediately.
   - Products and cart work.
   - Pay with Razorpay creates an order.
   - Payment verification succeeds.
7. Only after testing, remove `royalwrap.store` from the old Web Service's Custom Domains section.
8. Add `royalwrap.store` to the new Static Site. Render will show the exact DNS record to use.
9. Keep the new backend's `onrender.com` URL enabled because the Static Site rewrite uses it.
10. After the new setup works correctly, the old combined service can be removed.

## Important behavior

The first backend request after 15 minutes of inactivity can take about one minute. The website itself stays visible because it is served by the Static Site. During checkout, the button/status area may wait while the backend starts, and then Razorpay opens.

The backend can also wake when the customer uses My Orders, OTP login, admin order tools, or custom-photo upload. These features require server processing; normal browsing does not.

## Domain safety

Do not move the custom domain before the new Static Site and payment flow are tested. Moving the domain too early can interrupt the live store.
