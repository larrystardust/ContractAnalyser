import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBlogPosts } from '../hooks/useBlogPosts';
import StructuredData from '../components/StructuredData'; // ADDED
import { Helmet } from 'react-helmet-async'; // ADDED: Import Helmet

const BlogPage: React.FC = () => {
  const { t, i18n } = useTranslation(); // MODIFIED: Destructure i18n
  const { blogPosts, loading, error } = useBlogPosts();

  // ADDED: Structured Data for BlogPage
  const blogPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": t('our_blog_title'),
    "description": t('our_blog_description'),
    "url": "https://www.contractanalyser.com/blog",
    "publisher": {
      "@type": "Organization",
      "name": "ContractAnalyser",
      "url": "https://www.contractanalyser.com/"
    },
    "mainEntity": blogPosts.map(post => ({
      "@type": "BlogPosting",
      "headline": post.title,
      "url": `https://www.contractanalyser.com/blog/${post.slug}`,
      "image": post.imageUrl ? [post.imageUrl] : undefined, // Image as an array
      "datePublished": post.date,
      "dateModified": post.date, // Assuming datePublished is also dateModified if not separate
      "author": {
        "@type": "Person",
        "name": post.author
      },
      "description": post.excerpt
    }))
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p>{t('loading_blog_posts')}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-red-600">{t('error_loading_blog_posts')}: {error}</p>
      </div>
    );
  }

  return (
    <>
      <Helmet> {/* ADDED: Helmet for meta description */}
        <html lang={i18n.language} /> {/* ADDED: lang attribute */}
        <title>{t('blog_page_title')}</title> {/* ADDED: Dynamic title */}
        <meta name="description" content={t('blog_page_meta_description')} />
      </Helmet>
      <StructuredData schema={blogPageSchema} /> {/* ADDED */}
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
                  {t('by')} {post.author} {t('on')} {new Date(post.date).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-gray-700 text-base mb-4">
                  {post.excerpt}
                </p>
                <Link to={`/blog/${post.slug}`} className="text-blue-600 hover:text-blue-800 font-medium">
                  {t('read_more')} &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default BlogPage;