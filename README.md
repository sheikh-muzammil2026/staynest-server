StayNest - Real Estate & Property Management Platform 🏡✨

StayNest is a modern, responsive, and full-stack Property Management Application designed to bridge the gap between tenants, property owners, and administrators. Built with Next.js (App Router), Tailwind CSS, and a robust real-time analytics engine, it offers role-based functionalities, secure dashboards, and an interactive interface.

🔗 Deployment & Repository Links

Live Deployment Link: https://staynest-client.vercel.app

Client-Side Repository (Frontend): https://github.com/sheikh-muzammil2026/staynest-client

Server-Side Repository (Backend): https://github.com/sheikh-muzammil2026/staynest-server

🔑 Demo Access Credentials (For Evaluation)

To test the role-based access control without creating a new account, please use the following credentials:

Administrator Account:

Email: admin@gmail.com

Password: 1234567890

Tenant Account (For Reviews):

Email: tenant@gmail.com

Password: 1234567890

📌 Project Overview & Purpose

The main objective of StayNest is to streamline property hunting, booking, and platform management. It offers:

Tenants: A seamless experience to view properties, book stays, and leave verified ratings.

Owners: Tools to list and manage real estate assets.

Admins: A centralized command center to monitor platform health, system logs, and comprehensive financial growth.

🛠️ Tech Stack & Packages

### Frontend (Next.js)
- **Core:** Next.js, React 19 (App Router)
- **UI Framework:** [HeroUI](https://www.heroui.com/)
- **Animations:** [Framer Motion](https://www.framer.com/motion/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Charts:** [Recharts](https://recharts.org/)
- **Notifications:** [React Toastify](https://fkhadra.github.io/react-toastify/)
- **Authentication:** [Better Auth](https://www.better-auth.com/)
- **Payments:** [Stripe](https://stripe.com/)

### Backend (Node.js/Express)
- **Framework:** Express.js
- **Database:** MongoDB (Official Driver)
- **Validation/Security:** `jose-cjs`, `cors`, `dotenv`
- **Development:** `nodemon`

🚀 Key Features

1. Central Command Dashboard (Admin Module)

Real-time Metrics: Tracks total revenue, user count, active listings, and total bookings with dynamic percentage counters.

Ecosystem Analytics: Features an interactive monthly revenue line chart powered by recharts.

Live System Logs: Shows global audit logs triggered by user actions, new listings, or webhook operations for high-level monitoring.

2. Role-Based Review & Rating System

Access Control: Form visibility is strictly restricted to users authenticated with the tenant role. Admins and owners are blocked from modifying property ratings.

Optimistic UI Updates: Newly submitted reviews are instantly pushed to the top of the feed without requiring full page reloads.

Safe Fallbacks: Automatically handles missing profile data by falling back to "Anonymous" gracefully.

3. Core Technical Features

Adaptive Dark Mode: Fully integrated light and dark modes optimized using Tailwind CSS utilities.

Secure API Integration: Attaches bearer tokens automatically to protected header routes (/admin/analytics, /api/reviews).

High-Fidelity UI: Completely responsive design scaling smoothly from mobile screens (xs, sm) up to ultra-wide desktop monitors.

📦 Installation & Local Setup

Follow these step-by-step instructions to set up the development environment on your local machine:

1. Clone the Repository

git clone https://github.com/sheikh-muzammil2026/staynest-client.git 
cd staynest-client 

2. Install Dependencies

npm install # or yarn install 

3. Configure Environment Variables

Create a .env.local file in the root directory of the project and define your backend service URI:

NEXT_PUBLIC_SERVER_URI=https://your-api-server.com 

4. Start the Development Server

npm run dev # or yarn dev 

Open http://localhost:3000 in your web browser to explore the platform.

🔒 Security & Data Validation Guidelines

Route Guards: Intercepts unauthenticated sessions or invalid user roles instantly to prevent data leaks.

Safe Parsers: Applies native .trim() and Number() wrappers to client side data inputs before submitting payrolls to prevent DB errors.

Formatted Outputs: Financial sums and large data populations are cleanly evaluated using JavaScript toLocaleString() for professional output displays.

📝 License

This project is submitted as an assignment for evaluation. All rights reserved to the developer.
