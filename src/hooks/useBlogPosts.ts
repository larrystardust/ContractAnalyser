import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BlogPost } from '../data/blogData'; // Import the interface

export function useBlogPosts() {
  const { i18n } = useTranslation();
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBlogPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        let postsModule;
        switch (i18n.language) {
          case 'ar':
            postsModule = await import('../data/blogData.ar');
            setBlogPosts(postsModule.blogPostsAr);
            break;
          case 'es':
            postsModule = await import('../data/blogData.es');
            setBlogPosts(postsModule.blogPostsEs);
            break;
          case 'fr':
            postsModule = await import('../data/blogData.fr');
            setBlogPosts(postsModule.blogPostsFr);
            break;
          case 'en':
          default:
            postsModule = await import('../data/blogData.en');
            setBlogPosts(postsModule.blogPostsEn);
            break;
        }
      } catch (err: any) {
        console.error('Failed to load blog posts for language:', i18n.language, err);
        setError('Failed to load blog posts.');
        // Fallback to English if specific language fails
        try {
          const postsModule = await import('../data/blogData.en');
          setBlogPosts(postsModule.blogPostsEn);
        } catch (fallbackErr) {
          console.error('Failed to load fallback English blog posts:', fallbackErr);
          setBlogPosts([]);
        }
      } finally {
        setLoading(false);
      }
    };

    loadBlogPosts();
  }, [i18n.language]);

  return { blogPosts, loading, error };
}