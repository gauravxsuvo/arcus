export type MockAthlete = {
  id: string;
  name: string;
  username: string;
  initials: string;
  accent: string;
  tagline: string;
};

export type MockFeedPost = {
  id: string;
  athleteId: string;
  timeAgo: string;
  title: string;
  durationMinutes: number;
  volumeKg: number;
  personalRecords: number;
  exercises: { name: string; sets: number }[];
  likes: number;
  comments: number;
};

export const suggestedAthletes: MockAthlete[] = [
  { id: "mira", name: "Mira Shah", username: "miralifts", initials: "MS", accent: "violet", tagline: "Strength, slowly." },
  { id: "dev", name: "Dev Malhotra", username: "devtrains", initials: "DM", accent: "blue", tagline: "Three good sessions a week." },
  { id: "niko", name: "Niko Rao", username: "nikoruns", initials: "NR", accent: "green", tagline: "Lift · run · repeat." },
  { id: "alisha", name: "Alisha K.", username: "alishamoves", initials: "AK", accent: "amber", tagline: "Showing up is the plan." },
  { id: "arjun", name: "Arjun Mehta", username: "arjunbuilt", initials: "AM", accent: "rose", tagline: "One rep at a time." },
];

export const mockFeedPosts: MockFeedPost[] = [
  { id: "feed-1", athleteId: "mira", timeAgo: "18 min ago", title: "Upper body · steady progress", durationMinutes: 54, volumeKg: 6420, personalRecords: 1, exercises: [{ name: "Bench Press", sets: 4 }, { name: "Seated Cable Row", sets: 3 }, { name: "Dumbbell Shoulder Press", sets: 3 }, { name: "Cable Fly", sets: 3 }], likes: 18, comments: 3 },
  { id: "feed-2", athleteId: "dev", timeAgo: "1 hour ago", title: "Lower body strength", durationMinutes: 67, volumeKg: 9180, personalRecords: 0, exercises: [{ name: "Back Squat", sets: 4 }, { name: "Romanian Deadlift", sets: 3 }, { name: "Leg Press", sets: 3 }], likes: 12, comments: 2 },
  { id: "feed-3", athleteId: "niko", timeAgo: "3 hours ago", title: "Pull day", durationMinutes: 48, volumeKg: 5210, personalRecords: 2, exercises: [{ name: "Pull-up", sets: 4 }, { name: "Chest-supported Row", sets: 3 }, { name: "Face Pull", sets: 3 }, { name: "Incline Curl", sets: 3 }], likes: 26, comments: 5 },
  { id: "feed-4", athleteId: "alisha", timeAgo: "Yesterday", title: "A little bit stronger", durationMinutes: 42, volumeKg: 3870, personalRecords: 0, exercises: [{ name: "Goblet Squat", sets: 4 }, { name: "Dumbbell Row", sets: 3 }, { name: "Hip Thrust", sets: 3 }], likes: 9, comments: 1 },
  { id: "feed-5", athleteId: "arjun", timeAgo: "Yesterday", title: "Push · volume block", durationMinutes: 61, volumeKg: 7340, personalRecords: 1, exercises: [{ name: "Incline Bench Press", sets: 4 }, { name: "Machine Chest Press", sets: 3 }, { name: "Lateral Raise", sets: 4 }], likes: 21, comments: 4 },
  { id: "feed-6", athleteId: "mira", timeAgo: "2 days ago", title: "Easy run + mobility", durationMinutes: 38, volumeKg: 0, personalRecords: 0, exercises: [{ name: "Easy Run", sets: 1 }, { name: "Hip Mobility", sets: 3 }, { name: "Dead Bug", sets: 3 }], likes: 14, comments: 2 },
  { id: "feed-7", athleteId: "dev", timeAgo: "2 days ago", title: "Quick full body", durationMinutes: 39, volumeKg: 4660, personalRecords: 0, exercises: [{ name: "Trap Bar Deadlift", sets: 3 }, { name: "Dumbbell Bench Press", sets: 3 }, { name: "Lat Pulldown", sets: 3 }], likes: 8, comments: 0 },
];
