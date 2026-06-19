# ITWW - Admin Panel Dashboard

A modern, responsive **Admin Dashboard** built with **Next.js**, **PostgreSQL**, **Tailwind CSS**, and deployed on **Vercel**.  
This dashboard provides a clean UI, efficient data management, and easy scalability for admin operations.

---

## 🚀 Tech Stack

| Technology                                | Description                                                          |
| ----------------------------------------- | -------------------------------------------------------------------- |
| [Next.js](https://nextjs.org/)            | React framework for server-side rendering and static site generation |
| [PostgreSQL](https://www.postgresql.org/) | Open-source relational database                                      |
| [Prisma](https://www.prisma.io/)          | Modern ORM for TypeScript & Node.js                                  |
| [Tailwind CSS](https://tailwindcss.com/)  | Utility-first CSS framework                                          |
| [Vercel](https://vercel.com/)             | Hosting and deployment platform for Next.js                          |

---

## 📦 Features

- 🔐 Secure admin authentication (NextAuth / JWT)
- 📊 Dashboard analytics overview
- 🧑‍💼 User and role management
- 📁 CRUD operations with PostgreSQL via Prisma
- 🎨 Responsive UI with Tailwind CSS
- ⚡ Fast and optimized using Next.js App Router
- 🌐 Deployed on Vercel with CI/CD

---

## 🛠️ Installation & Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/yourusername/admin-dashboard.git
cd admin-dashboard
```

### 2️⃣ Install Dependencies

```bash
npm install
# or
yarn install
```

### 3️⃣ Set Up Environment Variables

Create a .env file in the root directory:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

### 4️⃣ Run Database Migrations (using Prisma)

```bash
npx prisma migrate dev
#(Optional) Open Prisma Studio to inspect your database:
npx prisma studio
```

### 5️⃣ Start the Development Server

```bash
npm run dev
# or
yarn dev
```

Visit http://localhost:3000 🚀

<hr>

### 🧱 Project Structure

```bash
admin-dashboard/
├── prisma/             # Prisma schema & migrations
├── public/             # Static assets
├── src/
│   ├── app/            # Next.js App Router pages
│   ├── components/     # Reusable UI components
│   ├── lib/            # Utilities and helpers
│   ├── styles/         # Global Tailwind styles
│   ├── prisma/         # Prisma client setup
│   └── types/          # TypeScript interfaces
├── .env                # Environment variables
├── package.json
├── tailwind.config.js
└── README.md
```

<hr>

### 🌍 Deployment (Vercel)

Push your project to GitHub or GitLab.

Connect your repository on Vercel
.

Add your .env variables in the Vercel Dashboard → Settings → Environment Variables.

Deploy — Vercel will automatically build and host your app!

<hr>

### 🧪 Scripts

Command Description

```bash
npm run dev	            # Start development server
npm run build	        # Build for production
npm start	            # Start production server
npx prisma studio	    # Open Prisma GUI to view DB
npm run lint	        # Run ESLint checks
```

<hr>

### 🧰 Tools & Libraries Used

- NextAuth.js – Authentication

- Axios / Fetch – API calls

- React Icons / Heroicons – Icons

- clsx – Conditional class names

- Recharts / Chart.js – Dashboard charts (optional)

- Zod / Yup – Data validation

<hr>

### 🤝 Contributing

Fork this repository

Create your feature branch:

```bash
git checkout -b feature/your-feature
```

Commit your changes:

```bash
git commit -m "Add new feature"
```

Push to the branch:

```bash
git push origin feature/your-feature
```

Open a Pull Request 🎉

<hr>

### 🛡️ License

This project is licensed under the MIT License.
Feel free to use and modify it for your own projects.

<hr>

### 💬 Contact

Author: Your Name

📧 Email: your.email@example.com

🌐 Portfolio: yourwebsite.com

🐙 GitHub: @yourusername
