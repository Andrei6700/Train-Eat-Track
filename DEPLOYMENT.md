# Deployment Guide - Train-Eat-Track

This guide covers how to deploy the Train-Eat-Track application for production use.

## Prerequisites

Before deploying, ensure you have:
- ✅ Completed all setup steps from SETUP.md
- ✅ Tested the app locally on Android/iOS
- ✅ Set up Firebase project with security rules
- ✅ An Expo account (free tier is fine)
- ✅ Apple Developer account (for iOS) - $99/year
- ✅ Google Play Developer account (for Android) - $25 one-time fee

## Deployment Options

### Option 1: Expo Go (Development/Testing)

**Best for:** Quick testing, sharing with testers, demo purposes

**Pros:**
- Free
- No app store submission needed
- Instant updates
- Easy to share via QR code

**Cons:**
- Requires Expo Go app
- Limited to Expo SDK APIs
- Not suitable for production

**Steps:**
```bash
# Login to Expo
npx expo login

# Publish to Expo
npx expo publish
```

Users can scan the QR code with Expo Go app to test.

---

### Option 2: EAS Build (Production - Recommended)

**Best for:** Production deployment to App Store and Google Play

**Pros:**
- Full native builds
- Complete API access
- Professional deployment
- Automatic updates with EAS Update

**Cons:**
- Requires app store accounts
- Review process for stores
- Build time (15-30 minutes)

#### Step 1: Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

#### Step 2: Configure EAS

```bash
eas build:configure
```

This creates `eas.json` with build configurations.

#### Step 3: Update app.json

Ensure your `app.json` has proper configuration:

```json
{
  "expo": {
    "name": "Train Eat Track",
    "slug": "train-eat-track",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourname.traineattrack",
      "buildNumber": "1"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#000000"
      },
      "package": "com.yourname.traineattrack",
      "versionCode": 1
    }
  }
}
```

#### Step 4: Build for Android

```bash
# Build APK (for testing)
eas build --platform android --profile preview

# Build AAB (for Google Play Store)
eas build --platform android --profile production
```

#### Step 5: Build for iOS

```bash
# Build for iOS App Store
eas build --platform ios --profile production

# Build for iOS Simulator (testing)
eas build --platform ios --profile preview
```

#### Step 6: Submit to Stores

```bash
# Submit to Google Play Store
eas submit --platform android

# Submit to Apple App Store
eas submit --platform ios
```

---

### Option 3: Manual Build (Advanced)

If you need full control over the build process:

#### Android

```bash
# Generate Android project
npx expo prebuild --platform android

# Build APK
cd android
./gradlew assembleRelease

# Build AAB
./gradlew bundleRelease
```

The output will be in `android/app/build/outputs/`.

#### iOS

```bash
# Generate iOS project
npx expo prebuild --platform ios

# Open in Xcode
open ios/TrainEatTrack.xcworkspace

# Build using Xcode
# Product > Archive > Distribute App
```

---

## Firebase Production Setup

### 1. Switch to Production Mode

In Firebase Console:

1. Go to Firestore Database
2. Click on Rules tab
3. Update rules to production mode (see SETUP.md for rules)
4. Publish rules

### 2. Enable Firebase App Check (Recommended)

Protects your app from abuse:

```bash
npm install @react-native-firebase/app-check
```

Follow Firebase App Check setup guide for React Native.

### 3. Set Up Firebase Analytics (Optional)

```bash
npm install @react-native-firebase/analytics
```

Helps track user behavior and app performance.

---

## Environment Variables for Production

Create production environment file:

```bash
# .env.production
EXPO_PUBLIC_FIREBASE_API_KEY=your-production-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-production-domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-production-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-production-bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-production-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-production-app-id
```

**Important:** Use separate Firebase projects for development and production!

---

## App Store Submission Checklist

### Google Play Store

- [ ] Create app listing
- [ ] Add app description, screenshots, and icon
- [ ] Set content rating
- [ ] Set up pricing and distribution
- [ ] Upload AAB file
- [ ] Fill out privacy policy
- [ ] Complete store listing
- [ ] Submit for review (usually 2-7 days)

### Apple App Store

- [ ] Create App Store Connect account
- [ ] Add app in App Store Connect
- [ ] Upload build via EAS or Xcode
- [ ] Add app description, screenshots, and keywords
- [ ] Set pricing and availability
- [ ] Add privacy policy URL
- [ ] Complete App Store listing
- [ ] Submit for review (usually 1-3 days)

---

## Post-Deployment

### Monitor Your App

1. **Firebase Console**
   - Monitor authentication users
   - Check Firestore usage
   - Review error logs

2. **Expo Dashboard**
   - Track app updates
   - Monitor crash reports
   - Review analytics

3. **App Store Analytics**
   - Google Play Console
   - Apple App Store Connect

### Over-the-Air (OTA) Updates

With EAS Update, you can push updates without app store review:

```bash
# Setup EAS Update
eas update:configure

# Push an update
eas update --branch production --message "Bug fixes and improvements"
```

**Note:** OTA updates work for JavaScript changes only, not native code.

---

## Performance Optimization

### Before Production

1. **Enable Hermes** (Android)
   ```json
   // app.json
   "android": {
     "jsEngine": "hermes"
   }
   ```

2. **Optimize Images**
   - Use WebP format
   - Compress images
   - Use appropriate sizes

3. **Enable Proguard** (Android)
   ```gradle
   // android/app/build.gradle
   buildTypes {
     release {
       minifyEnabled true
       proguardFiles getDefaultProguardFile('proguard-android.txt')
     }
   }
   ```

4. **Test Performance**
   - Use React DevTools Profiler
   - Test on low-end devices
   - Monitor memory usage

---

## Security Checklist

- [ ] Firebase security rules in production mode
- [ ] Environment variables properly set
- [ ] API keys restricted (Firebase Console)
- [ ] SSL/HTTPS for all API calls
- [ ] Input validation on all forms
- [ ] Secure storage for sensitive data
- [ ] Code obfuscation enabled
- [ ] Security audit completed

---

## Rollback Strategy

If you need to rollback:

### EAS Update
```bash
# Rollback to previous update
eas update --branch production --republish --message "Rollback"
```

### App Store
- Submit previous version to stores
- Use emergency update process if available

---

## Maintenance

### Regular Tasks

**Weekly:**
- Check error logs
- Monitor Firebase usage
- Review user feedback

**Monthly:**
- Update dependencies
- Security audit
- Performance review

**Quarterly:**
- Major feature updates
- Dependency upgrades
- Comprehensive testing

---

## Support and Monitoring

### Error Tracking

Consider adding:
- Sentry for crash reporting
- Firebase Crashlytics
- Custom error logging

### Analytics

Consider adding:
- Firebase Analytics
- Mixpanel
- Amplitude

---

## Cost Estimates

### Free Tier (Suitable for Small Apps)
- Firebase Free Tier: 50K reads/day, 20K writes/day
- Expo: Free
- Total: $0/month

### Paid Tier (For Growing Apps)
- Firebase Blaze Plan: Pay as you go (~$25-100/month)
- EAS Professional: $29/month per developer
- Apple Developer: $99/year
- Google Play: $25 one-time
- Total: ~$50-150/month + store fees

---

## Troubleshooting

### Common Issues

**Build fails:**
- Check `eas.json` configuration
- Ensure all dependencies are compatible
- Clear cache: `eas build --clear-cache`

**App crashes on launch:**
- Check Firebase configuration
- Verify API keys
- Test in development mode first

**OTA update not working:**
- Ensure EAS Update is configured
- Check runtime version in `app.json`
- Users need to restart app

---

## Additional Resources

- [Expo EAS Documentation](https://docs.expo.dev/eas/)
- [Firebase Hosting Guide](https://firebase.google.com/docs/hosting)
- [React Native Performance](https://reactnative.dev/docs/performance)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Guidelines](https://play.google.com/about/developer-content-policy/)

---

## Next Steps

After successful deployment:

1. ✅ Monitor app performance
2. ✅ Collect user feedback
3. ✅ Plan feature updates
4. ✅ Maintain regular updates
5. ✅ Build user community

**Congratulations on deploying your app! 🎉**

---

For questions or issues, refer to:
- SETUP.md for installation
- CODE_REVIEW.md for code quality
- REVIEW_SUMMARY.md for overall assessment
