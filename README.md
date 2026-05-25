# Train-Eat-Track

Train-Eat-Track is a high-performance, cross-platform mobile application designed to help users track their workouts, log daily meals, and visualize progress over time. Built with **React Native**, **Expo**, and **TypeScript**, the app integrates seamless database sync, analytics charts, and clean, premium animations.

---

## Features

- **Workout Tracking:** Log exercises, track sets, reps, weights, and structure your custom workout plans.
- **Nutrition Logging:** Keep track of daily meals, search foods using the integrated **USDA FoodData Central API**, and monitor your macro-nutrients.
- **Progress Analytics:** Interactive dashboards showing weekly and monthly progress using beautiful visual charts.
- **Secure Authentication:** Full user sign-up, sign-in, and password management powered by **Firebase Authentication**.
- **Media Uploads:** Take photos of workouts or meals and upload them seamlessly using **Cloudinary** integration.
- **Data Export:** Export your progress, workouts, or nutritional statistics directly to Excel spreadsheets (`.xlsx`).
- **Smooth Animations:** Powered by **React Native Reanimated (v4)** for premium, fluid transitions and splash screens.
- **Offline Resilience:** Integrated network connectivity monitoring (`@react-native-community/netinfo`) to ensure a robust user experience.

---

## Tech Stack

- **Client Framework:** React Native (Expo SDK 54), Expo Router (File-based routing), TypeScript
- **State & UI Components:** React Native Reanimated, Shopify FlashList, React Native Calendars, Gifted Charts, Phosphor Icons
- **Backend & Cloud:** Firebase (Auth, Firestore), Cloudinary CDN (Image Hosting)
- **External APIs:** USDA FoodData Central API
- **DevOps & CI/CD:** Jenkins pipelines, Docker containerization

---

# Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Expo Go](https://expo.dev/client) app installed on your physical device, or an Android/iOS emulator configured.
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (optional, if you plan to run the Jenkins CI/CD pipeline).

## Run Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Andrei6700/Train-Eat-Track.git
   cd Train-Eat-Track
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env.local` file in the root directory and add your credentials:
   ```env
   # Firebase Web Configuration
   EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

   # Cloudinary Integration
   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_cloudinary_upload_preset

   # USDA FoodData Central API (https://fdc.nal.usda.gov/api-key-signup.html)
   EXPO_PUBLIC_USDA_API_KEY=your_usda_api_key
   ```

4. **Start the development server:**
   ```bash
   npm start
   ```

---

# Detailed Documentation

For detailed technical information specific to the project, access the pages in the index below:

*  **[Architecture](docs/ARCHITECTURE.md)** – Directory structure, data flows, and Firestore database schema.
*  **[DevOps & CI/CD Pipeline](docs/CICD.md)** – Complete step-by-step guide for configuring Jenkins in Docker and automating the pipeline.
*  **[Developer Guide & API Reference](docs/API_REFERENCE.md)** – Environment variables, external API integrations (USDA, Cloudinary), and services.

---

## Running Tests

To run the test suite, use the command:
```bash
npm run test
```

---

## License

This project is licensed under the [MIT](https://choosealicense.com/licenses/mit/) license.