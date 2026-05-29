<div align="center">

# 🌳 Tally — Attendance Manager

**A modern, gamified attendance tracking platform for small teams.**
Staff submit, admin approves, and every present day plants a tree in your team's living forest.

[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12-ffca28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Live Demo](#) · [Report Bug](https://github.com/rajendra7169/attendance-system/issues) · [Request Feature](https://github.com/rajendra7169/attendance-system/issues)

</div>

---

## ✨ Why Tally?

Tracking attendance shouldn't feel like a chore. Tally turns the boring grind into a **delightful, motivating experience** — your team's record is visualized as a living forest where every present day plants a tree, overtime adds a bonus glow, and absences leave withered stumps. The forest changes with the time of day, with a sun that arcs across the sky, twinkling stars at night, a flowing river, and butterflies that appear as your team thrives.

Built for **office teams, interns, and small businesses** that want a clean, modern, free alternative to enterprise time-tracking tools.

---

## 🎯 Features

### Core
- 🏢 **Multi-tenant workspaces** — each admin owns a private workspace with full data isolation
- 👥 **Role-based access** — admins manage, staff submit; tight Firestore security rules enforce boundaries
- ✉️ **Email-based staff invites** — admin adds staff by email; they receive a "set your password" link and join in one click
- 🔐 **Google sign-in for admins** plus traditional email/password
- ⏱️ **Check-in / check-out flow** — staff clock in when they arrive, clock out when they leave; entry/exit times stored automatically
- 📅 **Full-year attendance calendar** with intelligent day classification (on-time, late, early-out, etc.)
- ✅ **Admin approval workflow** — staff submissions are pending until approved (or set workspace to auto-approve)
- 🗓️ **Date-range leave requests** — staff request planned off days 3+ days in advance with reason; admin can mark off periods directly for any staff
- ⚙️ **Configurable per workspace** — office hours, working days (Mon–Sat or Mon–Fri etc.), and a holiday calendar
- 📸 **Photo uploads** — company logo and staff profile photos via Cloudinary (free tier, no Firebase Storage required)

### The Forest 🌳
A unique gamified visualization that lives below every attendance calendar:
- 🌱 **Every present day plants a tree** at a stable, seed-deterministic position
- 🌳 **Tree size = hours worked** ratio; arrive late or leave early → stunted tree
- ✨ **Overtime grows oversized trees** with a soft yellow glow
- 🪵 **Absent days wither into dead trees**; 🪨 planned off-days become stumps
- ⏳ **Today's tree grows in real-time** — checked in but not out? The tree gets bigger every 30 seconds with a pulsing emerald halo
- 🦋 **Wildlife appears as your forest thrives** — butterflies, rabbits, deer
- 🐦 **Birds fly across the sky** — count grows with healthier forests
- 🌅 **Live day/night cycle** — sun arcs from east to west, moon rises after dusk, stars twinkle at night, all driven by the actual system clock
- 🌊 **Animated flowing river** with shimmers and floating leaves drifting downstream
- 🌷 **Naturalistic ground** — clustered grass, blooming flowers, and the occasional mushroom

### UX polish
- 🎨 Clean, modern design inspired by Linear/Vercel
- 🌓 Smooth animations and live transitions
- 📱 Fully responsive
- 🔔 Inline toast notifications (no ugly browser alerts)
- ⚡ Real-time Firestore subscriptions — no manual refresh needed

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 8, React Router 7 |
| **Styling** | Tailwind CSS 4, custom design tokens |
| **Auth** | Firebase Authentication (email/password + Google OAuth) |
| **Database** | Cloud Firestore with security rules |
| **Image hosting** | Cloudinary (unsigned upload preset) |
| **Icons** | Lucide React |
| **Date handling** | date-fns |
| **Hosting** | Vercel |

---

## 📸 Screenshots

> _Add screenshots here after deployment_

| Login | Dashboard | Calendar | Forest |
|---|---|---|---|
| TBD | TBD | TBD | TBD |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- A **Firebase project** ([create one free](https://console.firebase.google.com))
- A **Cloudinary account** ([sign up free](https://cloudinary.com/users/register_free))

### 1. Clone & install

```bash
git clone https://github.com/rajendra7169/attendance-system.git
cd attendance-system
npm install
```

### 2. Set up Firebase

#### Create a project
1. Go to the [Firebase Console](https://console.firebase.google.com) → **Add project**
2. Skip Google Analytics (optional)

#### Enable Authentication
- **Build → Authentication → Get started**
- **Sign-in method** tab → Enable **Email/Password**
- **Enable** the "Email link (passwordless sign-in)" toggle inside Email/Password (optional but recommended)
- Also enable **Google** provider → set support email → Save

#### Create Firestore Database
- **Build → Firestore Database → Create database**
- Choose a region close to your users (e.g. `asia-south1`)
- Start in **production mode** (we'll apply our security rules next)

#### Apply security rules
Paste the contents of [`firestore.rules`](firestore.rules) into the **Firestore → Rules** tab and publish.

#### Get your config
- **Project Settings (gear icon) → Your apps → Web app** → Register app
- Copy the `firebaseConfig` values for the next step

### 3. Set up Cloudinary

1. Sign up at [cloudinary.com](https://cloudinary.com/users/register_free)
2. On the dashboard, copy your **Cloud Name**
3. **Settings → Upload → Upload presets → Add upload preset**
   - **Signing Mode:** `Unsigned` *(important — required for browser uploads)*
   - **Folder:** `attendance-system` (optional)
   - Save and copy the **preset name**

### 4. Environment variables

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Firebase
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_preset_name
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Click **"Create one"** to set up your first workspace.

---

## 📂 Project Structure

```
attendance-system/
├── public/                  # Static assets
├── src/
│   ├── components/
│   │   ├── Calendar.jsx     # Year calendar + attendance modal
│   │   ├── Forest.jsx       # The living forest visualization
│   │   ├── Header.jsx       # Top navigation with pending badge
│   │   └── MemberCard.jsx   # Staff card with attendance stats
│   ├── context/
│   │   └── AuthContext.jsx  # User + workspace state with live subscriptions
│   ├── hooks/
│   │   └── useAuth.js
│   ├── pages/
│   │   ├── Login.jsx        # Unified email/password + Google sign-in
│   │   ├── Signup.jsx       # Workspace creation
│   │   ├── Onboard.jsx      # Post-Google sign-up workspace setup
│   │   ├── ResetPassword.jsx
│   │   ├── Dashboard.jsx    # Admin + Staff dashboards
│   │   ├── MemberDetail.jsx # Staff profile + calendar + forest
│   │   └── Admin.jsx        # Company settings, staff, approvals
│   ├── utils/
│   │   ├── firebase.js
│   │   ├── calendarUtils.js # Day classification, time math
│   │   ├── staffUtils.js    # Invite, create, resend
│   │   └── uploadImage.js   # Cloudinary upload helper
│   ├── App.jsx              # Routes
│   └── main.jsx             # Entry point
├── firestore.rules          # Production-ready security rules
├── vercel.json              # Vercel SPA routing config
├── .env.example             # Template for local env vars
└── package.json
```

---

## 📜 Available Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server at `localhost:5173` |
| `npm run dev -- --host 0.0.0.0` | Expose dev server to your LAN (test on other devices) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint |

---

## ☁️ Deploy to Vercel

The fastest path to production:

### 1. Push to GitHub (see [Pushing this code](#-pushing-this-code) below)

### 2. Import to Vercel
1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Pick your `attendance-system` repo
3. Vercel auto-detects Vite — no configuration needed
4. Add environment variables (copy each `VITE_*` from your `.env.local`)
5. Click **Deploy**

### 3. Update Firebase for production

In the Firebase Console:
- **Authentication → Settings → Authorized domains** → Add your Vercel URL (e.g. `your-app.vercel.app`)
- **Authentication → Templates → Password reset → Customize action URL** → `https://your-app.vercel.app/reset-password`

That's it. Subsequent pushes to `main` auto-deploy in ~30 seconds.

### Alternative: Netlify
Drag-and-drop the `dist/` folder after `npm run build`, or connect the GitHub repo. Add the same env vars in Site settings.

---

## 🗺 Roadmap

- [ ] Bulk CSV staff import
- [ ] Monthly attendance report export (PDF/CSV)
- [ ] Email notifications on approval / rejection
- [ ] Mobile native apps (React Native)
- [ ] Geofencing for office-based check-in
- [ ] Customizable forest themes (snowy winter, autumn, etc.)
- [ ] Achievement badges (perfect month, 100-day streak, etc.)
- [ ] Slack / WhatsApp integration

---

## 🤝 Contributing

Contributions are very welcome. Whether it's a bug fix, a new feature, or improved docs:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

For larger changes, please open an issue first to discuss the approach.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

You're free to use it in personal or commercial projects.

---

## 🙏 Acknowledgments

- [Firebase](https://firebase.google.com/) for an excellent free auth + database tier
- [Cloudinary](https://cloudinary.com/) for free image hosting
- [Lucide](https://lucide.dev/) for the beautiful icon set
- [Tailwind CSS](https://tailwindcss.com/) for making styling fun again
- [date-fns](https://date-fns.org/) for sane date handling

---

## 👤 Author

**Rajendra Pandey**

- GitHub: [@rajendra7169](https://github.com/rajendra7169)
- Built with ☕ and 🌳

---

<div align="center">

⭐ **If you found this project useful, please consider giving it a star!** ⭐

Made with ❤️ in Nepal

</div>
