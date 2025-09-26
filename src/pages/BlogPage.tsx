import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBlogPosts } from '../hooks/useBlogPosts'; // MODIFIED: Import useBlogPosts hook

const BlogPage: React.FC = () => {
  const { t } = useTranslation();
  const { blogPosts, loading, error } = useBlogPosts(); // MODIFIED: Use the hook

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p>{t('loading_blog_posts')}...</p> {/* MODIFIED: Add translation key */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-red-600">{t('error_loading_blog_posts')}: {error}</p> {/* MODIFIED: Add translation key */}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back_to_landing_page')}
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('our_blog_title')}</h1>
      <p className="text-lg text-gray-700 mb-10">{t('our_blog_description')}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {blogPosts.map((post) => (
          <div key={post.slug} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
            {post.imageUrl && (
              <img src={post.imageUrl} alt={post.title} className="w-full h-48 object-cover" />
            )}
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                <Link to={`/blog/${post.slug}`} className="hover:text-blue-600">
                  {post.title}
                </Link>
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                {t('by')} {post.author} {t('on')} {new Date(post.date).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })} {/* MODIFIED: Translate 'by' and 'on', use i18n.language for date format */}
              </p>
              <p className="text-gray-700 text-base mb-4">
                {post.excerpt}
              </p>
              <Link to={`/blog/${post.slug}`} className="text-blue-600 hover:text-blue-800 font-medium">
                {t('read_more')} &rarr; {/* MODIFIED: Translate 'Read More' */}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlogPage;