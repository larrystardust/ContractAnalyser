import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { blogPosts } from '../data/blogData'; // Import the blog posts data
import { ArrowLeft } from 'lucide-react';

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="container mx-auto px-4 py-6 mt-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Blog Post Not Found</h1>
        <p className="text-lg text-gray-700 mb-6">The post you are looking for does not exist.</p>
        <Link to="/blog" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Blog
        </Link>
      </div>
    );
  }

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
        // Render the list and skip the already processed items
        index = i - 1; // Adjust index for the map loop
        return (
          <ul key={index} className="list-disc list-inside text-gray-700 mb-4 space-y-2 pl-5">
            {listItems.map((item, liIndex) => {
              const parts = item.split('**');
              return (
                <li key={liIndex}>
                  {parts.map((part, pIndex) => {
                    if (pIndex % 2 === 1) {
                      return <strong key={pIndex}>{part}</strong>;
                    }
                    return part;
                  })}
                </li>
              );
            })}
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
        // Render the list and skip the already processed items
        index = i - 1; // Adjust index for the map loop
        return (
          <ol key={index} className="list-decimal list-inside text-gray-700 mb-4 space-y-2 pl-5">
            {listItems.map((item, liIndex) => {
              const parts = item.split('**');
              return (
                <li key={liIndex}>
                  {parts.map((part, pIndex) => {
                    if (pIndex % 2 === 1) {
                      return <strong key={pIndex}>{part}</strong>;
                    }
                    return part;
                  })}
                </li>
              );
            })}
          </ol>
        );
      }
      // Handle bold text within paragraphs
      const paragraphParts = block.split('**');
      return (
        <p key={index} className="text-gray-700 mb-4">
          {paragraphParts.map((part, pIndex) => {
            if (pIndex % 2 === 1) {
              return <strong key={pIndex}>{part}</strong>;
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="mb-6">
        <Link to="/blog" className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Blog
        </Link>
      </div>

      <article className="bg-white rounded-lg shadow-md p-8 lg:p-12">
        {post.imageUrl && (
          <img src={post.imageUrl} alt={post.title} className="w-full h-80 object-cover rounded-lg mb-8" />
        )}
        <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{post.title}</h1>
        <p className="text-lg text-gray-600 mb-8">
          By {post.author} on {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <div className="prose prose-lg max-w-none">
          {renderContent(post.content)}
        </div>
      </article>
    </div>
  );
};

export default BlogPostPage;