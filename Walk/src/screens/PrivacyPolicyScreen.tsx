import React from 'react';
import {ScrollView, Text, StyleSheet, View, Linking, TouchableOpacity} from 'react-native';
import {type ColorSet, LightColors} from '../styles';

const POLICY_EMAIL = 'mailto:msz006.kobo@gmail.com';

const sections = [
  {
    title: '1. About Walk Intent',
    body: 'Walk Intent is a general wellness and walking habit app designed to help users build a walking routine by choosing a purpose, tracking walking time, keeping short notes, and maintaining streaks.\n\nThe App does not require account registration or login.',
  },
  {
    title: '2. Information Stored on Your Device',
    body: 'The App may store the following information locally on your device:\n\n• Walk session start and end times\n• Walk duration\n• Selected walking purpose (Music, Explore, Shopping, Errand, Think, or custom)\n• Optional notes entered by the user\n• Daily walking goal\n• Streak information\n• Walk history\n• Notification settings\n• Theme and language settings\n• Other application preferences\n\nThis information is primarily stored and processed locally on the user\'s device.\n\nThe Developer does not require users to provide their name, postal address, phone number, date of birth, or other directly identifying personal information.',
  },
  {
    title: '3. Notes Entered by Users',
    body: 'Users may optionally enter notes about their walks. These notes are stored locally on the device.\n\nUsers should avoid entering sensitive personal information in notes unless comfortable storing such information on their own device.',
  },
  {
    title: '4. Location, Steps, and Health Data',
    body: 'The App does not currently collect or use:\n\n• GPS location or walking routes\n• Precise location data\n• Step count, distance, or calorie data\n• Apple Health / HealthKit data\n• Health Connect or Google Fit data\n• Apple Watch or Wear OS health data\n\nThe App tracks walking activity based on user-started walk timers and locally stored session information.\n\nIf these features are added in the future, this Privacy Policy will be updated.',
  },
  {
    title: '5. Firebase Analytics',
    body: 'The App may use Firebase Analytics (Google LLC) to understand general app usage and improve the App.\n\nFirebase Analytics may process: app version, device type, OS version, app usage events, session information, IP address, and other technical information.\n\nThe Developer does not use Firebase Analytics for third-party or behavioral advertising.',
  },
  {
    title: '6. Firebase Crashlytics',
    body: 'The App may use Firebase Crashlytics (Google LLC) to identify crashes, errors, and technical problems.\n\nCrashlytics may process: crash reports, error logs, device model, OS version, app version, technical identifiers, and other diagnostic information.\n\nThis information is used only for debugging and stability improvements.',
  },
  {
    title: '7. In-App Purchases and RevenueCat',
    body: 'The App may offer optional Pro features as a one-time in-app purchase. Payments are processed through Apple App Store or Google Play.\n\nThe App may use RevenueCat (RevenueCat, Inc.) to manage purchase status and restore purchases.\n\nThe Developer does not directly receive or store credit card numbers, debit card numbers, or bank account information.',
  },
  {
    title: '8. Notifications',
    body: 'The App may use local notifications for:\n\n• Daily walking goal reminders\n• Goal completion notifications\n• Scheduled walking reminders\n\nNotifications are only used when permitted by the user and can be changed at any time through the App or device settings.',
  },
  {
    title: '9. Advertising',
    body: 'The App does not display third-party advertisements.\n\nThe App does not use advertising SDKs for personalized advertising.\n\nThe Developer does not sell user information for advertising purposes.',
  },
  {
    title: '10. Third-Party Services',
    body: 'The App may use:\n\n• Google Firebase Analytics\n• Google Firebase Crashlytics\n• RevenueCat\n• Apple App Store\n• Google Play\n\nInformation handled by these services is subject to their respective privacy policies.',
  },
  {
    title: '11. Purposes of Data Processing',
    body: 'Information may be used for:\n\n• Providing core App functionality\n• Saving walk sessions and settings\n• Displaying history, statistics, and streaks\n• Managing Pro purchase status\n• Restoring purchases\n• Sending requested notifications\n• Understanding general App usage\n• Investigating crashes and technical problems\n• Improving App stability and usability\n• Preventing misuse or fraud\n• Complying with applicable laws',
  },
  {
    title: '12. Sale of Personal Information',
    body: 'The Developer does not sell users\' personal information.\n\nThe Developer does not provide personal information to third parties for targeted advertising purposes.',
  },
  {
    title: '13. Data Retention',
    body: 'Walk history, purposes, notes, streaks, settings, and other App data are stored locally on the user\'s device until deleted by the user or removed through uninstallation.\n\nInformation processed by Firebase, RevenueCat, Apple, or Google may be retained according to those providers\' retention policies.',
  },
  {
    title: '14. Data Deletion',
    body: 'Walk Intent does not require users to create a Developer-managed account.\n\nLocally stored App data may be deleted using the in-app data reset function or by uninstalling the App.\n\nData processed by third-party services may be subject to their deletion and retention policies.',
  },
  {
    title: '15. Data Security',
    body: 'The Developer takes reasonable measures to reduce the risk of unauthorized access, disclosure, alteration, or loss of information.\n\nHowever, no electronic storage or transmission method can guarantee complete security.',
  },
  {
    title: '16. Health and Medical Disclaimer',
    body: 'Walk Intent is a general wellness and habit-building application. The App is not a medical device and is not intended to provide medical diagnosis, treatment, disease prevention, or professional medical advice.\n\nUsers should walk and exercise within their own physical capabilities. Users with medical conditions or health concerns should consult a healthcare professional.',
  },
  {
    title: '17. Children\'s Privacy',
    body: 'The App is not designed to intentionally collect personal information from children.\n\nIf applicable law requires parental consent or other protections for younger users, the Developer will take appropriate measures.',
  },
  {
    title: '18. International Data Processing',
    body: 'Third-party services used by the App may process or store information outside the user\'s country or region. Such processing is governed by the applicable laws and privacy policies of those service providers.',
  },
  {
    title: '19. Changes to This Privacy Policy',
    body: 'This Privacy Policy may be updated when App features change, new third-party services are introduced, data handling practices change, or applicable laws or platform requirements change.\n\nThe updated Privacy Policy will become effective when published.',
  },
];

type Props = {
  colors?: ColorSet;
};

export default function PrivacyPolicyScreen({colors}: Props) {
  const c = colors || LightColors;
  const st = makeStyles(c);

  return (
    <View style={st.container}>
      <ScrollView contentContainerStyle={st.content}>
        <Text style={st.heading}>Walk Intent Privacy Policy</Text>
        <Text style={st.updated}>Last updated: October 18, 2026</Text>
        <Text style={st.intro}>
          ohesoft ("Developer") establishes this Privacy Policy regarding the handling of information in Walk Intent ("the App").
        </Text>

        {sections.map(sec => (
          <View key={sec.title} style={st.section}>
            <Text style={st.sectionTitle}>{sec.title}</Text>
            <Text style={st.body}>{sec.body}</Text>
          </View>
        ))}

        <View style={st.section}>
          <Text style={st.sectionTitle}>20. Contact</Text>
          <Text style={st.contactLabel}>Developer: ohesoft</Text>
          <TouchableOpacity onPress={() => Linking.openURL(POLICY_EMAIL)}>
            <Text style={st.link}>msz006.kobo@gmail.com</Text>
          </TouchableOpacity>
        </View>

        <View style={st.footer} />
      </ScrollView>
    </View>
  );
}

function makeStyles(c: ColorSet) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.bg,
    },
    content: {
      padding: 20,
    },
    heading: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 4,
    },
    updated: {
      color: c.textMuted,
      fontSize: 13,
      marginBottom: 16,
    },
    intro: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 12,
    },
    section: {
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.cardBorder,
      padding: 16,
      marginBottom: 10,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 6,
    },
    body: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 21,
    },
    contactLabel: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 8,
    },
    link: {
      color: c.accent,
      fontSize: 14,
      marginTop: 4,
    },
    footer: {
      height: 40,
    },
  });
}
