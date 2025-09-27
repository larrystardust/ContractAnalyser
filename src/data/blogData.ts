export interface BlogPost {
  slug: string;
  title: string;
  author: string;
  date: string; // Format: YYYY-MM-DD
  excerpt: string;
  imageUrl?: string; // Optional image URL for the post header
}

// This file will not export any specific blog posts,
// but rather define the interface. The actual data will be
// dynamically imported via a hook.
