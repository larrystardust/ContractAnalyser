import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBlogPosts } from '../hooks/useBlogPosts';
import StructuredData from '../components/StructuredData'; // ADDED

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const { blogPosts, loading, error } = useBlogPosts();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p>{t('loading_blog_post')}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <p className="text-red-600">{t('error_loading_blog_post')}: {error}</p>
      </div>
    );
  }

  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('blog_post_not_found')}</h1>
        <p className="text-lg text-gray-700 mb-6">{t('blog_post_not_exist')}.</p>
        <Link to="/blog" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('back_to_blog')}
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
    const renderedElements: React.ReactNode[] = [];
    let i = 0; // Use a mutable index for the for loop

    while (i < contentArray.length) {
      const block = contentArray[i];

      if (block.startsWith('### ')) {
        renderedElements.push(<h3 key={i} className="text-2xl font-semibold text-gray-900 mt-8 mb-4">{block.substring(4)}</h3>);
        i++;
      } else if (block.startsWith('## ')) {
        renderedElements.push(<h2 key={i} className="text-3xl font-bold text-gray-900 mt-10 mb-5">{block.substring(3)}</h2>);
        i++;
      } else if (block.startsWith('*   ')) {
        const listItems: string[] = [];
        let currentListItemIndex = i;
        while (currentListItemIndex < contentArray.length && contentArray[currentListItemIndex].startsWith('*   ')) {
          listItems.push(contentArray[currentListItemIndex].substring(4));
          currentListItemIndex++;
        }
        renderedElements.push(
          <ul key={i} className="list-disc list-inside text-gray-700 mb-4 space-y-2 pl-5">
            {listItems.map((item, liIndex) => (
              <li key={`${i}-li-${liIndex}`}>
                {parseMarkdownText(item, `${i}-li-${liIndex}`)}
              </li>
            ))}
          </ul>
        );
        i = currentListItemIndex; // Advance the main loop index past the processed list items
      } else if (block.startsWith('1.  ')) {
        const listItems: string[] = [];
        let currentListItemIndex = i;
        while (currentListItemIndex < contentArray.length && contentArray[currentListItemIndex].match(/^\d+\.\s/)) {
          listItems.push(contentArray[currentListItemIndex].replace(/^\d+\.\s/, ''));
          currentListItemIndex++;
        }
        renderedElements.push(
          <ol key={i} className="list-decimal list-inside text-gray-700 mb-4 space-y-2 pl-5">
            {listItems.map((item, liIndex) => (
              <li key={`${i}-ol-${liIndex}`}>
                {parseMarkdownText(item, `${i}-ol-${liIndex}`)}
              </li>
            ))}
          </ol>
        );
        i = currentListItemIndex; // Advance the main loop index past the processed list items
      } else {
        // Default to paragraph, parsing for bold and links
        renderedElements.push(
          <p key={i} className="text-gray-700 mb-4">
            {parseMarkdownText(block, `p-${i}`)}
          </p>
        );
        i++;
      }
    }
    return renderedElements;
  };

  // De-duplication logic for content blocks (still useful for data cleanliness)
  const uniqueContentBlocks: string[] = [];
  const seenBlocks = new Set<string>();

  if (post.content) {
    for (const block of post.content) {
      const normalizedBlock = block.trim();
      if (!seenBlocks.has(normalizedBlock)) {
        uniqueContentBlocks.push(block);
        seenBlocks.add(normalizedBlock);
      }
    }
  }

  // ADDED: Structured Data for BlogPostPage
  const blogPostSchema = {
    "@context": "https://schema.org",
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
    "publisher": {
      "@type": "Organization",
      "name": "ContractAnalyser",
      "url": "https://www.contractanalyser.com/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://www.contractanalyser.com/favicon.ico"
      }
    },
    "description": post.excerpt,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://www.contractanalyser.com/blog/${post.slug}`
    }
  };

  return (
    <>
      <StructuredData schema={blogPostSchema} /> {/* ADDED */}
      <div className="container mx-auto px-4 py-6 mt-16">
        <div className="mb-6">
          <Link to="/blog" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('back_to_blog')}
          </Link>
        </div>

        <article className="bg-white rounded-lg shadow-md p-8 lg:p-12">
          {post.imageUrl && (
            <img src={post.imageUrl} alt={post.title} className="w-full h-80 object-cover object-center rounded-lg mb-8" />
          )}
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{post.title}</h1>
          <p className="text-lg text-gray-600 mb-8">
            {t('by')} {post.author} {t('on')} {new Date(post.date).toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <div className="prose prose-lg max-w-none">
            {renderContent(uniqueContentBlocks)}
          </div>
        </article>
      </div>
    </>
  );
};

export default BlogPostPage;