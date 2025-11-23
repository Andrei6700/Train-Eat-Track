# Train-Eat-Track 💪🍎📊

A comprehensive fitness tracking mobile application built with React Native and Expo for tracking workouts, nutrition, and progress.

## 📱 About

Train-Eat-Track is a dissertation project that demonstrates modern mobile app development practices. The app allows users to:

- 🏋️ Track workout exercises, sets, and reps
- 📅 View workout history with calendar integration
- 📊 Analyze progress with detailed statistics and charts
- 📝 Create and manage custom workout plans
- 👤 Manage user profile and authentication

## 🚀 Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Firebase (Authentication + Firestore)
- **State Management**: React Context API
- **UI Components**: Custom components with Phosphor Icons
- **Charts**: React Native Gifted Charts
- **Animations**: React Native Reanimated

## 📚 Documentation

- **[SETUP.md](./SETUP.md)** - Detailed setup and installation instructions
- **[CODE_REVIEW.md](./CODE_REVIEW.md)** - Comprehensive code review and analysis

## 🎯 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Andrei6700/Train-Eat-Track.git
   cd Train-Eat-Track
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Firebase credentials
   ```

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Run on device/emulator**
   - Press `a` for Android
   - Press `i` for iOS
   - Scan QR code with Expo Go app

For detailed setup instructions, see [SETUP.md](./SETUP.md).

## 📁 Project Structure

```
Train-Eat-Track/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Authentication screens
│   ├── (modals)/          # Modal screens
│   └── (tabs)/            # Tab navigation screens
├── src/
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React Context providers
│   ├── services/          # Firebase and API services
│   ├── types/             # TypeScript definitions
│   └── utils/             # Utility functions
├── constants/             # App constants and theme
└── assets/               # Images, fonts, etc.
```

## ✨ Features

### Authentication
- Email/password registration and login
- Secure user session management
- Profile management with image upload

### Workout Tracking
- Log exercises with sets, reps, and weight
- Track workout duration
- One workout per day limit
- View today's workout plan

### Workout Plans
- Create custom workout plans
- Organize workouts by day of the week
- Mark rest days
- Edit and update existing plans

### History
- View all past workouts in a calendar
- Detailed workout information
- Filter by date
- Pull-to-refresh functionality

### Statistics
- Exercise progress tracking
- Weight and rep progression charts
- Weekly, monthly, and yearly views
- Exercise-specific analytics

## 🛠️ Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint

## 🔒 Security

- Firebase configuration uses environment variables
- Sensitive data excluded from git
- User data protected with Firebase security rules
- Proper authentication and authorization

## 📝 License

This project is for educational purposes (dissertation project).

## 👨‍💻 Author

**Andrei** - Dissertation Project

## 🙏 Acknowledgments

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

Resources:
- [Expo documentation](https://docs.expo.dev/)
- [React Native documentation](https://reactnative.dev/)
- [Firebase documentation](https://firebase.google.com/docs)
