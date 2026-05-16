# Manual Testing Checklist

Follow these steps to manually verify the full end-to-end flow of the AI Crypto Advisor.

## Prerequisites
1. Ensure the backend server is running (`npm run dev` in the `/server` folder).
2. Ensure the frontend server is running (`npm run dev` in the `/client` folder).
3. Ensure your `.env` files are properly configured (backend `PORT=5001`, frontend `VITE_API_URL=http://localhost:5001/api`).

## Checklist

### 1. Registration & Authentication
- [ ] Open your browser and navigate to `http://localhost:5174` (or your Vite port).
- [ ] You should be redirected to the `/dashboard` but because you are not logged in, you should instantly be redirected to `/login`.
- [ ] Click the **Sign up** link at the bottom of the login card.
- [ ] Fill out the form: Name, Email (e.g. `test@example.com`), and Password (`password123`).
- [ ] Click **Sign Up**. You should be automatically logged in and redirected to the `/onboarding` page.

### 2. Onboarding
- [ ] You should see the personalized onboarding quiz.
- [ ] Select 2-3 Crypto Assets (e.g., Bitcoin, Ethereum).
- [ ] Select your Investor Type (e.g., HODLer).
- [ ] Select the content you want to see (e.g., Market News).
- [ ] Click **Complete Onboarding**. You should be redirected to the `/dashboard`.

### 3. Dashboard Data & Personalization
- [ ] Verify you are on the `/dashboard` page.
- [ ] Ensure your name appears in the top header.
- [ ] Ensure your selected Investor Type badge appears in the top right.
- [ ] Review the **Market Overview**. Because we are using mock data, you should see static fallback data. *Notice that the coins you selected during onboarding are prioritized at the top of the list!*
- [ ] Review the **AI Insight of the Day** and **Curated News**.

### 4. Feedback Mechanism
- [ ] On any card (e.g., Market Overview), click the **Thumbs Up** (Helpful) button.
- [ ] The button should change color (green for upvote).
- [ ] Click the **Thumbs Down** button on a different card. It should turn red.
- [ ] *(Optional)* Open a SQLite viewer or run Prisma Studio (`npx prisma studio` in the server folder) and look at the `Feedback` table. You will see your votes correctly saved in the database, linked to your user ID.

### 5. Session Persistence
- [ ] Refresh the page (`Cmd/Ctrl + R`).
- [ ] You should remain logged in and see the dashboard immediately.
- [ ] In the top right, click the **Logout** icon.
- [ ] You should be instantly redirected back to the `/login` page.
- [ ] Log in again with the credentials you created in Step 1.
- [ ] You should bypass the onboarding quiz (since you already completed it) and land straight on the `/dashboard`.

---

## Explanation of Seed/Mock Data
Because this is the first MVP version, no real external APIs (CoinGecko, CryptoPanic) are connected yet to prevent rate limits during early development testing.

All data is served by `server/src/services/dashboardMock.service.js`.
When `GET /api/dashboard` is called:
1. The backend reads the logged-in user's preferences from the SQLite database.
2. It sorts the massive static mock array to put the user's preferred coins and news topics at the top.
3. It selects an "AI Insight" specifically tailored to the user's `investorType` (e.g., a Day Trader gets a different insight than a HODLer).
4. The frontend renders this JSON response payload.
