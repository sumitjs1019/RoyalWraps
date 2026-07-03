# RoyalWraps Razorpay Store

Premium mobile skin ecommerce website with:

- All uploaded product photos listed as products
- Add to Cart button
- Preview button with large product modal
- Cart drawer with quantity controls
- Customer delivery form
- Razorpay order creation backend
- Razorpay payment signature verification backend
- Contact Us button at top and bottom
- Refund Policy button in footer

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Open: `http://localhost:3000`

## Add Razorpay keys

Open `.env` and replace:

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id_here
RAZORPAY_KEY_SECRET=your_key_secret_here
```

Use Razorpay test keys first. After testing, use Live Mode keys only when your store, refund policy, delivery process and business verification are ready.

## Important payment notes

- The frontend never sends product prices to Razorpay directly.
- The backend calculates the amount using product IDs and quantities.
- The backend creates a Razorpay order.
- After checkout, the backend verifies `razorpay_signature` before marking payment as successful.
- For production, add a database, order dashboard, webhook handling, invoices and admin notifications.

## Contact used in website

- Email: `sumitsharma22112004@gmail.com`
- Mobile: `+91 8000520058`


## Latest update
- Product previews include the new quality feature image and high-quality vinyl protection details for every product.

## Checkout validation

The checkout form now includes a required **Pin code** field. Mobile number accepts only 10 digits and pin code accepts only 6 digits. Non-numeric characters are automatically removed on typing/paste, and the backend validates both fields before creating a Razorpay order.

## Product model selection update

- Every product card now has **Mobile Brand** and **Mobile Model** dropdowns.
- The Preview popup also has the same brand/model dropdowns before Add to Cart.
- Cart and Razorpay backend now save the selected brand and model with each product.
- Product price is no longer placed on top of the product image, so it will not cover the phone photo.
