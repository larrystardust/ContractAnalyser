import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // MODIFIED: Import useTranslation
import { useBlogPosts } from '../hooks/useBlogPosts'; // MODIFIED: Import useBlogPosts hook

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation(); // MODIFIED: Destructure i18n
  const { blogPosts, loading, error } = useBlogPosts(); // MODIFIED: Use the hook

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p>{t('loading_blog_post')}...</p> {/* MODIFIED: Add translation key */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-red-600">{t('error_loading_blog_post')}: {error}</p> {/* MODIFIED: Add translation key */}
      </div>
    );
  }

  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('blog_post_not_found')}</h1> {/* MODIFIED: Translate */}
        <p className="text-lg text-gray-700 mb-6">{t('blog_post_not_exist')}.</p> {/* MODIFIED: Translate */}
        <Link to="/blog" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back_to_blog')} {/* MODIFIED: Translate */}
        </Link>
      </div>
    );
  }

  // Helper function to parse markdown-like text for bold and links
  const parseMarkdownText = (text: string, keyPrefix: string) => {
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Regex to find both bold (**text**) and links ([text](url))
    const regex = /(\*\*([^*]+)\*\*)|\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add preceding text as a plain string
      if (match.index > lastIndex) {
        elements.push(text.substring(lastIndex, match.index));
      }

      if (match[3] && match[4]) { // It's a link match: [text](url)
        const linkText = match[3];
        const linkUrl = match[4];
        const isInternalLink = linkUrl.startsWith('/') || linkUrl.startsWith(window.location.origin);
        if (isInternalLink) {
          elements.push(
            <Link key={`${keyPrefix}-link-${match.index}`} to={linkUrl} className="text-blue-600 hover:underline">
              {linkText}
            </Link>
          );
        } else {
          elements.push(
            <a key={`${keyPrefix}-link-${match.index}`} href={linkUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {linkText}
            </a>
          );
        }
      } else if (match[1]) { // It's a bold match: **text**
        const boldContent = match[2];
        // Recursively parse the content inside the bold tags for links or other markdown
        elements.push(
          <strong key={`${keyPrefix}-bold-${match.index}`}>
            {parseMarkdownText(boldContent, `${keyPrefix}-bold-inner-${match.index}`)}
          </strong>
        );
      }
      lastIndex = regex.lastIndex;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      elements.push(text.substring(lastIndex));
    }
    return elements;
  };

  // Function to render content, handling markdown-like headers and lists
  const renderContent = (contentArray: string[]) => {
    return contentArray.map((block, index) => {
      if (block.startsWith('### ')) {
        return <h3 key={index} className="text-2xl font-semibold text-gray-900 mt-8 mb-4">{block.substring(4)}</h3>;
      }
      if (block.startsWith('## ')) {
        return <h2 key={index} className="text-3xl font-bold text-gray-900 mt-10 mb-5">{block.substring(3)}</h2>;
      }
      if (block.startsWith('*   ')) {
        // This is a list item, collect consecutive list items
        const listItems: string[] = [];
        let i = index;
        while (i < contentArray.length && contentArray[i].startsWith('*   ')) {
          listItems.push(contentArray[i].substring(4));
          i++;
        }
        // Render the list and adjust index for the map loop
        const currentListIndex = index;
        index = i - 1; 
        return (
          <ul key={currentListIndex} className="list-disc list-inside text-gray-700 mb-4 space-y-2 pl-5">
            {listItems.map((item, liIndex) => (
              <li key={`${currentListIndex}-li-${liIndex}`}>
                {parseMarkdownText(item, `${currentListIndex}-li-${liIndex}`)}
              </li>
            ))}
          </ul>
        );
      }
      if (block.startsWith('1.  ')) {
        // This is an ordered list item, collect consecutive list items
        const listItems: string[] = [];
        let i = index;
        while (i < contentArray.length && contentArray[i].match(/^\d+\.\s/)) {
          listItems.push(contentArray[i].replace(/^\d+\.\s/, ''));
          i++;
        }
        // Render the list and adjust index for the map loop
        const currentListIndex = index;
        index = i - 1; 
        return (
          <ol key={currentListIndex} className="list-decimal list-inside text-gray-700 mb-4 space-y-2 pl-5">
            {listItems.map((item, liIndex) => (
              <li key={`${currentListIndex}-ol-${liIndex}`}>
                {parseMarkdownText(item, `${currentListIndex}-ol-${liIndex}`)}
              </li>
            ))}
          </ol>
        );
      }
      // Default to paragraph, parsing for bold and links
      return (
        <p key={index} className="text-gray-700 mb-4">
          {parseMarkdownText(block, `p-${index}`)}
        </p>
      );
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/blog" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back_to_blog')}
        </Link>
      </div>

      <article className="bg-white rounded-lg shadow-md p-8 lg:p-12">
        {post.imageUrl && (
          <img src={post.imageUrl} alt={post.title} className="w-full h-80 object-cover rounded-lg mb-8" />
        )}
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{post.title}</h1>
        <p className="text-lg text-gray-600 mb-8">
          {t('by')} {post.author} {t('on')} {new Date(post.date).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })} {/* MODIFIED: Translate 'by' and 'on', use i18n.language for date format */}
        </p>
        <div className="prose prose-lg max-w-none">
          {renderContent(post.content)}
        </div>
      </article>
    </div>
  );
};

export default BlogPostPage;