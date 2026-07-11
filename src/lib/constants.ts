export const ANALYTICS_METRICS = [
  '3-Second Retention Rate',
  '5-Second Drop-off Point',
  'Average View Duration Curve',
  'Thumbnail Quadrant CTR',
  'Sound Volume Drop Points',
  'Shares Per Impression Ratio',
  'Profile Visit Conversion Rate',
  'Comment Sentiment Index',
  'Follower Velocity',
  'Re-watch Frequency',
  'Peak Traffic Alignment',
  'Video Compression Integrity',
  'Audio-to-Visual Engagement Balance',
  'Keyword Search Ranking Velocity',
  'Loop Performance Index',
  'Total Views',
  'Total Likes',
  'Total Comments',
  'Total Shares',
  'Total Saves',
  'Total Impressions',
  'Reach',
  'Engagement Rate',
  'Click-through Rate',
  'Average Watch Time',
  'Completion Rate',
  'Swipe-away Rate',
  'Follower Growth',
  'Unfollow Rate',
  'Hashtag Performance',
  'Trending Score',
  'Algorithm Push Score',
  'Discovery Rate',
  'Audience Retention 15s',
  'Audience Retention 30s',
  'Audience Retention 60s',
  'Hook Effectiveness',
  'Pacing Score',
  'Story Coherence',
  'Character Recognition',
  'Visual Consistency',
  'Audio Clarity',
  'Subtitle Readability',
  'Thumbnail Click Appeal',
  'Title SEO Score',
  'Description SEO Score',
  'Tag Relevance',
  'Best Posting Time Match',
  'Cross-platform Sync Score',
  'Comment-to-View Ratio',
  'Save-to-View Ratio',
  'Share-to-View Ratio',
  'Profile Click Rate',
  'Notification Opt-in Rate',
] as const;

export const API_PROVIDERS = [] as const;

export const ACCENT_PRESETS = [
  { name: 'Aurora', color: '#00d4ff' },
  { name: 'Emerald', color: '#22e078' },
  { name: 'Sunset', color: '#ff8a3d' },
  { name: 'Crimson', color: '#ff5470' },
  { name: 'Gold', color: '#ffb547' },
  { name: 'Ocean', color: '#3b82f6' },
] as const;

export const RADIUS_PRESETS = [
  { name: 'Sharp', value: 4 },
  { name: 'Balanced', value: 12 },
  { name: 'Smooth', value: 20 },
] as const;

export function maskKey(key: string | undefined): string {
  if (!key) return '';
  if (key.length <= 8) return '•'.repeat(key.length);
  return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 20)) + key.slice(-4);
}

export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
