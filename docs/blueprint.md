# **App Name**: Level Up Aceh Private

## Core Features:

- Firebase Configuration (TypeScript): Establish a centralized 'lib/firebase-config.ts' file with the provided Firebase configuration (apiKey: 'AIzaSyDiGpXu1TsPIa25Rm5N7OUTNCnfnAO8QTE', authDomain: 'levelup-aceh-private.firebaseapp.com', projectId: 'levelup-aceh-private', storageBucket: 'levelup-aceh-private.firebasestorage.app', messagingSenderId: '489376624549', appId: '1:489376624549:web:a1d4009c382003fbc0824c', measurementId: 'G-YRWP1N697E') for Firebase project integration, ensuring type safety and modularity.
- Next.js Middleware for Route Protection: Implement server-side route protection using Next.js Middleware to restrict access to authenticated-only routes (e.g., '/dashboard', '/ujian').
- Global Authentication State Monitoring: Utilize 'onAuthStateChanged' to monitor the user's authentication status globally across the application and manage redirects for unauthenticated access.
- Responsive Login Page with Shadcn/UI: Develop a modern, responsive, and elegant login interface using Shadcn/UI components, featuring the 'Level up new logo.jpeg' as a central branding element.
- User Authentication (Email/Password): Implement authentication logic using 'signInWithEmailAndPassword' for secure user login.
- Exam Integrity Protection: Implement crucial security measures on exam pages: disable right-click, prevent text selection, detect tab changes using 'visibilityChange', blur the screen upon tab-switching, and save warning notes to Firestore.
- Exam Data Management (Firestore): Develop functionality to fetch exam questions from the 'exams' Firestore collection (including 'difficulty_level' field) and store student results in the 'results' collection for digital report generation.
- LaTeX Rendering for Exam Questions: Integrate a LaTeX rendering library (e.g., MathJax or KaTeX) to correctly display mathematical and scientific notation within exam questions.
- Auto-save Exam Progress: Automatically save student answers to the 'exam_sessions' Firestore collection after each selection, allowing students to resume exams from their last question.
- Role-based Access Control (RBAC): Implement Firestore security rules and application-level logic to differentiate access: students can only read questions and write their own results, while admins can add/edit questions and view all student reports.
- Dynamic Scoring (IRT): Utilize the 'difficulty_level' field within exam questions from the 'exams' collection to calculate final scores using dynamic weighting based on Item Response Theory principles.

## Style Guidelines:

- Primary color: Deep Maroon (#8B0000) for a professional and established feel, setting a strong institutional tone.
- Background color: Crisp White (#FFFFFF) to provide a clean, modern, and highly legible canvas for all content.
- Accent color: Vibrant Golden Yellow (#FFD700) for highlighting key interactive elements and signifying achievement, aligning with the 'Level Up' theme.
- Headlines and body text font: 'Inter' (sans-serif), chosen for its modern, objective, and highly legible characteristics.
- A responsive and elegant layout, especially for the login page, focusing on clarity and ease of use, utilizing Shadcn/UI components for consistency.
- Utilize Lucide Icons for a consistent set of clear, minimalistic, and modern icons throughout the application.