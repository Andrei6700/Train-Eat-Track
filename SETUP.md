# Train-Eat-Track Setup Guide

This guide will help you set up the Train-Eat-Track application for development.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Git
- A code editor (VS Code recommended)
- Expo Go app on your mobile device (for testing)

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/Andrei6700/Train-Eat-Track.git
cd Train-Eat-Track
```

### 2. Install Dependencies

```bash
npm install
```

If you encounter issues, try:
```bash
npm install --legacy-peer-deps
```

### 3. Install Missing Dependencies

The following packages need to be installed:

```bash
npm install @react-native-segmented-control/segmented-control
npm install react-native-gifted-charts
```

### 4. Configure Firebase

#### 4.1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Email/Password authentication:
   - Go to Authentication > Sign-in method
   - Enable "Email/Password"
4. Create a Firestore database:
   - Go to Firestore Database
   - Create database in test mode (or production mode with security rules)

#### 4.2. Get Firebase Configuration

1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click on "Web app" (</> icon)
4. Copy the firebaseConfig object

#### 4.3. Set Up Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and add your Firebase configuration:
   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key-here
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

3. If using Cloudinary for images:
   ```env
   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-upload-preset
   ```

### 5. Configure Firebase Security Rules

Add the following security rules in Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Workouts history collection
    match /workoutsHistory/{workoutId} {
      allow read: if request.auth != null && 
                     request.auth.uid == resource.data.userID;
      allow create: if request.auth != null && 
                       request.auth.uid == request.resource.data.userID;
      allow update, delete: if request.auth != null && 
                               request.auth.uid == resource.data.userID;
    }
    
    // Workout plans collection
    match /workoutPlans/{planId} {
      allow read: if request.auth != null && 
                     request.auth.uid == resource.data.userID;
      allow create: if request.auth != null && 
                       request.auth.uid == request.resource.data.userID;
      allow update, delete: if request.auth != null && 
                               request.auth.uid == resource.data.userID;
    }
  }
}
```

### 6. Start the Development Server

```bash
npm start
```

or

```bash
npx expo start
```

This will start the Expo development server. You can then:
- Press `a` to open on Android emulator
- Press `i` to open on iOS simulator
- Scan QR code with Expo Go app on your phone

## Project Structure

```
Train-Eat-Track/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   ├── (modals)/          # Modal screens
│   └── (tabs)/            # Tab navigation screens
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── layout/        # Layout components
│   │   ├── navigation/    # Navigation components
│   │   └── ui/            # UI components
│   ├── contexts/          # React Context providers
│   ├── services/          # Firebase and API services
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── constants/             # App constants and theme
└── assets/               # Images, fonts, etc.
```

## Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint

## Common Issues and Solutions

### Issue: "expo: command not found"
**Solution:** Install Expo CLI globally:
```bash
npm install -g expo-cli
```

### Issue: Firebase configuration errors
**Solution:** Make sure you've created the `.env` file with correct Firebase credentials

### Issue: Module resolution errors
**Solution:** Clear cache and reinstall:
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

### Issue: Android build fails
**Solution:** Make sure you have Android Studio installed with proper SDK

### Issue: iOS build fails (Mac only)
**Solution:** Make sure you have Xcode installed and run:
```bash
cd ios && pod install && cd ..
```

## Development Tips

1. **Hot Reload**: Changes to your code will automatically reload the app
2. **Debug Menu**: Shake your device or press `Cmd+D` (iOS) / `Cmd+M` (Android) to open debug menu
3. **Console Logs**: Use `console.log()` for debugging - logs appear in terminal and React Native debugger
4. **Remote Debugging**: Enable remote debugging from the debug menu to use Chrome DevTools

## Testing the App

### Create a Test Account

1. Start the app
2. Navigate to the registration screen
3. Create an account with:
   - Email: test@example.com
   - Password: Test123456
   - Name: Test User

### Test Features

1. **Workout Tracking**:
   - Navigate to the Workout tab
   - Create a workout plan
   - Log exercises with sets and reps

2. **History**:
   - View your workout history in the History tab
   - Calendar view shows workout days

3. **Statistics**:
   - View exercise progress over time
   - Charts show weight and rep progression

4. **Profile**:
   - Update your profile information
   - Upload profile picture (requires Cloudinary setup)
   - Logout functionality

## Deployment

### Deploy to Expo (Development Build)

```bash
expo publish
```

### Build for Production

#### Android (APK):
```bash
eas build --platform android
```

#### iOS (IPA):
```bash
eas build --platform ios
```

Note: You'll need to set up EAS (Expo Application Services) for production builds.

## Support

For issues or questions:
1. Check the [Expo Documentation](https://docs.expo.dev/)
2. Check the [Firebase Documentation](https://firebase.google.com/docs)
3. Create an issue in the GitHub repository

## License

This project is for educational purposes (dissertation project).

---

**Happy Coding! 🚀**
