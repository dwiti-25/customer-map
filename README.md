# 🚗 Mowito Customer Travel Planner

A web-based customer visualization and travel planning application developed for **Mowito Robotics**.

The application consolidates customer data from multiple Excel sheets, visualizes customer locations on an interactive map, and helps sales teams efficiently plan customer visits.

---

## 🌐 Live Application

https://customer-map-theta.vercel.app

---

## 📂 GitHub Repository

https://github.com/dwiti-25/customer-map

---

# Features

### 📊 Dashboard
- Total Leads
- Cities Covered
- Leads by Source
  - IMTEX
  - ET Expo
  - Chennai Expo

---

### 🗺 Interactive Customer Map

- Interactive Leaflet map
- Marker clustering
- Customer popups
- City-based visualization
- Automatic grouping of nearby customers

---

### 🔍 Search & Filters

Search customers by:
- Company Name
- Contact Person

Filter by:
- City
- Lead Source

---

### 📋 Customer List

Displays:

- Company Name
- Contact Person
- City
- Lead Source

Supports selecting multiple customers for travel planning.

---

### 📍 Route Planning

Select multiple customers and automatically:

- Generate an optimized visit order
- Display total travel distance
- Display estimated travel time
- Visualize route directly on the map

---

### ➕ Add New Lead

New customer information can be added directly from the application.

Fields include:

- Company Name
- Contact Person
- Designation
- City
- Email
- Phone
- Application
- Source

---

### 📤 Export

Export the complete customer database as an Excel file.

---

# Data Sources

The application currently imports customer data from:

- IMTEX Leads.xlsx
- ET Expo.xlsx
- Chennai Automation Expo.xlsx

During loading:

- Duplicate entries are removed
- Different Excel column formats are standardized
- Customer locations are mapped using predefined city coordinates

---

# Tech Stack

- React
- Vite
- Leaflet
- React Leaflet
- XLSX
- JavaScript
- CSS

Deployment:
- Vercel

Version Control:
- Git
- GitHub

---

# Folder Structure

```
customer-map
│
├── public
│   ├── IMTEX_Leads.xlsx
│   ├── ET Expo.xlsx
│   ├── Chennai Automation Expo.xlsx
│
├── src
│   ├── components
│   ├── utils
│   │    └── loadLeads.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
│
├── package.json
└── README.md
```

---

# Running Locally

Clone the repository

```bash
git clone https://github.com/dwiti-25/customer-map.git
```

Go into the project

```bash
cd customer-map
```

Install dependencies

```bash
npm install
```

Start development server

```bash
npm run dev
```

The application will be available at

```
http://localhost:5173
```

---

# Updating Lead Data

Replace the Excel files inside the **public/** folder.

If the column names differ from the expected format, update the mappings inside:

```
src/utils/loadLeads.js
```

No other code changes should be required.

---

# Deployment

The application is deployed using **Vercel**.

Every push to the **main** branch automatically triggers a new deployment.

---

# Future Improvements

- Authentication/Login
- CRM integration
- Live Google Maps routing
- Route optimization using traffic
- Customer visit history
- Notes & follow-up tracking
- Backend database integration
- Multi-user support

---

# Developed By

**Dwiti Suchak**

BITS Pilani

Electrical & Electronics Engineering + M.Sc. Economics

Developed during internship at **Mowito Robotics**.


# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
